import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const PART_SIZE = 8 * 1024 * 1024;
const publicWidgetId = z.string().trim().regex(/^wgt_[A-Za-z0-9_-]{10,40}$/);
const originInput = z.string().trim().toLowerCase().regex(/^https?:\/\/[a-z0-9.-]+(:\d{2,5})?$/);
const fileSchema = z.object({ name: z.string().min(1).max(240), type: z.string().max(160).default("application/octet-stream"), size: z.number().int().nonnegative() });

function secret() {
  const value = process.env["DEVICE_SESSION_SECRET"];
  if (!value || value.startsWith("replace_") || value.length < 32) throw new Error("DEVICE_SESSION_SECRET is not configured");
  return value;
}
function hmac(input: string) { return createHmac("sha256", secret()).update(input).digest("hex"); }
function sha(input: string) { return createHash("sha256").update(input).digest("hex"); }
function safeEqual(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function publicOrigin() { return process.env["PUBLIC_APP_URL"] || "http://localhost:8080"; }

function headerOrigin() {
  try {
    const headers = getRequest().headers;
    const referer = headers.get("referer");
    if (!referer) return null;
    const url = new URL(referer);
    if (url.origin === publicOrigin()) return null; // our own embed document, not the embedding page
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

type WidgetRow = { id: string; public_widget_id: string; config: unknown; application_id: string };

async function loadWidget(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: widget } = await supabaseAdmin.from("widgets").select("id,public_widget_id,config,application_id").eq("public_widget_id", id).maybeSingle();
  if (!widget) throw new Error("Unknown widget");
  const { data: application } = await supabaseAdmin
    .from("applications")
    .select("id,name,developer_id,domain_status,production_domain,max_upload_bytes")
    .eq("id", (widget as WidgetRow).application_id)
    .single();
  const { data: origins } = await supabaseAdmin.from("application_origins").select("origin,kind").eq("application_id", application.id);
  return { widget: widget as WidgetRow, application, origins: origins ?? [] };
}

/**
 * Opens a widget session. The embedding origin must be registered on the
 * application. When the browser supplies a Referer for the embed document we
 * require it to match the claimed origin, so a claimed value alone is never
 * sufficient on referrer-permitting browsers.
 */
export const openWidgetSession = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ widgetId: publicWidgetId, origin: originInput }).parse(input))
  .handler(async ({ data }) => {
    const { widget, application, origins } = await loadWidget(data.widgetId);
    const evidence = headerOrigin();
    if (evidence && evidence !== data.origin) throw new Error("Embedding origin mismatch");
    const match = origins.find((entry) => entry.origin === data.origin);
    if (!match) throw new Error("This origin is not registered for the application");
    if (match.kind !== "development" && application.domain_status !== "verified") throw new Error("The production domain is not verified");
    const issuedAt = Date.now();
    const payload = `${widget.public_widget_id}|${data.origin}|${issuedAt}`;
    return {
      session: `${issuedAt}.${hmac(payload)}`,
      widget: { id: widget.public_widget_id, config: widget.config },
      application: { name: application.name, domainStatus: application.domain_status },
      environment: match.kind === "development" ? "development" : "production",
      maxUploadBytes: Number(application.max_upload_bytes),
    };
  });

function verifySession(widgetId: string, origin: string, session: string) {
  const [issuedAt, signature] = session.split(".");
  if (!issuedAt || !signature) return false;
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > 30 * 60_000) return false;
  return safeEqual(signature, hmac(`${widgetId}|${origin}|${issuedAt}`));
}

/** Creates an application-owned transfer and signs direct-to-storage part URLs. */
export const createWidgetTransfer = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    widgetId: publicWidgetId,
    origin: originInput,
    session: z.string().min(16),
    files: z.array(fileSchema).min(1).max(10),
    lifetimeMinutes: z.number().int().min(5).max(30).default(5),
  }).parse(input))
  .handler(async ({ data }) => {
    if (!verifySession(data.widgetId, data.origin, data.session)) throw new Error("Widget session expired. Reload the page.");
    const evidence = headerOrigin();
    if (evidence && evidence !== data.origin) throw new Error("Embedding origin mismatch");
    const { widget, application } = await loadWidget(data.widgetId);
    const config = (widget.config ?? {}) as { maxFiles?: number; maxBytes?: number; acceptedTypes?: string[] };
    const maxFiles = Math.min(config.maxFiles ?? 5, 10);
    if (data.files.length > maxFiles) throw new Error(`This widget accepts at most ${maxFiles} files`);
    const total = data.files.reduce((sum, file) => sum + file.size, 0);
    const widgetCap = Math.min(config.maxBytes ?? Number(application.max_upload_bytes), Number(application.max_upload_bytes));
    if (total > widgetCap) throw new Error("Selection exceeds the configured transfer size");
    const accepted = config.acceptedTypes ?? [];
    if (accepted.length > 0) {
      for (const file of data.files) {
        const ok = accepted.some((rule) => (rule.endsWith("/*") ? file.type.startsWith(rule.slice(0, -1)) : rule === file.type || rule === `.${file.name.split(".").pop()}`));
        if (!ok) throw new Error(`${file.name} is not an accepted file type`);
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { beginMultipart, signPart } = await import("./r2.server");
    const transferId = crypto.randomUUID();
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    if (random === undefined) throw new Error("Secure random generation failed");
    const code = String(random % 10000).padStart(4, "0");
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + data.lifetimeMinutes * 60_000).toISOString();
    const rows = data.files.map((file) => ({
      id: crypto.randomUUID(),
      transfer_id: transferId,
      object_key: `app/${application.id}/${transferId}/${crypto.randomUUID()}`,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    }));
    const { error: transferError } = await supabaseAdmin.from("transfers").insert({
      id: transferId,
      owner_type: "app",
      owner_id: application.developer_id,
      application_id: application.id,
      widget_id: widget.id,
      total_bytes: total,
      expires_at: expiresAt,
      max_downloaders: 1,
      code_hash: createHmac("sha256", secret()).update(`code:${code}`).digest("hex"),
      code_hint: Number(code.slice(-2)),
      session_token_hash: createHmac("sha256", secret()).update(`token:${sessionToken}`).digest("hex"),
    });
    if (transferError) throw new Error(transferError.message);
    const { error: filesError } = await supabaseAdmin.from("transfer_files").insert(rows);
    if (filesError) throw new Error(filesError.message);
    const uploads = [];
    for (const row of rows) {
      const uploadId = await beginMultipart(row.object_key, row.mime_type);
      const partCount = Math.max(1, Math.ceil(row.size_bytes / PART_SIZE));
      const parts = await Promise.all(Array.from({ length: partCount }, async (_, index) => ({ partNumber: index + 1, url: await signPart(row.object_key, uploadId, index + 1) })));
      await supabaseAdmin.from("transfer_files").update({ upload_id: uploadId, upload_status: "uploading" }).eq("id", row.id);
      uploads.push({ fileId: row.id, uploadId, partSize: PART_SIZE, parts });
    }
    return { transferId, sessionToken, code, expiresAt, handoffUrl: `${publicOrigin()}/to/${code}`, uploads };
  });

/** Verifies stored object sizes, activates the transfer, and records exact usage. */
export const completeWidgetTransfer = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    transferId: z.string().uuid(),
    sessionToken: z.string().min(32),
    files: z.array(z.object({ fileId: z.string().uuid(), uploadId: z.string().min(1), parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1) })).min(1) })).min(1).max(10),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { finishMultipart, inspectObject } = await import("./r2.server");
    const { data: transfer } = await supabaseAdmin.from("transfers").select("id,session_token_hash,expires_at,total_bytes,application_id,owner_id").eq("id", data.transferId).maybeSingle();
    if (!transfer || !safeEqual(transfer.session_token_hash, createHmac("sha256", secret()).update(`token:${data.sessionToken}`).digest("hex"))) throw new Error("Transfer not found");
    if (new Date(transfer.expires_at).getTime() <= Date.now()) throw new Error("Transfer expired");
    const { data: files } = await supabaseAdmin.from("transfer_files").select("id,object_key,size_bytes,upload_id").eq("transfer_id", data.transferId);
    if (!files || files.length !== data.files.length) throw new Error("File manifest mismatch");
    for (const completion of data.files) {
      const file = files.find((candidate) => candidate.id === completion.fileId);
      if (!file || file.upload_id !== completion.uploadId) throw new Error("Upload does not belong to this transfer");
      await finishMultipart(file.object_key, completion.uploadId, completion.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })));
      const object = await inspectObject(file.object_key);
      if (BigInt(object.ContentLength ?? -1) !== BigInt(file.size_bytes)) throw new Error("Stored object size does not match the signed manifest");
      await supabaseAdmin.from("transfer_files").update({ upload_status: "uploaded" }).eq("id", file.id);
    }
    await supabaseAdmin.from("transfers").update({ status: "active" }).eq("id", data.transferId).eq("status", "waiting");
    await supabaseAdmin.from("usage_events").upsert({
      transfer_id: data.transferId,
      application_id: transfer.application_id,
      developer_id: transfer.owner_id,
      bytes: transfer.total_bytes,
      event_type: "upload",
      amount_minor_units: 0,
      idempotency_key: `upload:${data.transferId}`,
    }, { onConflict: "idempotency_key" });
    if (transfer.owner_id) await supabaseAdmin.rpc("recompute_developer_billing", { _developer_id: transfer.owner_id });
    return { ok: true };
  });

/** Safe status projection the embedding application may read. */
export const getWidgetTransferStatus = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ transferId: z.string().uuid(), sessionToken: z.string().min(32) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: transfer } = await supabaseAdmin.from("transfers").select("id,status,total_bytes,expires_at,session_token_hash,successful_downloads").eq("id", data.transferId).maybeSingle();
    if (!transfer || !safeEqual(transfer.session_token_hash, createHmac("sha256", secret()).update(`token:${data.sessionToken}`).digest("hex"))) return null;
    const { data: files } = await supabaseAdmin.from("transfer_files").select("id,original_name,mime_type,size_bytes,upload_status,checksum_sha256").eq("transfer_id", data.transferId);
    return {
      transferId: transfer.id,
      status: transfer.status,
      totalBytes: Number(transfer.total_bytes),
      expiresAt: transfer.expires_at,
      files: (files ?? []).map((file) => ({ id: file.id, name: file.original_name, type: file.mime_type, size: Number(file.size_bytes), status: file.upload_status })),
      fingerprint: sha(transfer.id).slice(0, 16),
    };
  });
