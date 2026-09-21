import { createServerFn } from "@tanstack/react-start";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const GIB = 1024n * 1024n * 1024n;
const PART_SIZE = 8 * 1024 * 1024;
const MAX_ANON_BYTES = 2n * GIB;
const transferIdSchema = z.string().uuid();
const fileSchema = z.object({ name: z.string().min(1).max(240), type: z.string().max(160).default("application/octet-stream"), size: z.number().int().nonnegative().max(Number(MAX_ANON_BYTES)) });

function secret() {
  const value = process.env["DEVICE_SESSION_SECRET"];
  if (!value || value.startsWith("replace_") || value.length < 32) throw new Error("DEVICE_SESSION_SECRET is not configured");
  return value;
}
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function codeDigest(value: string) { return createHmac("sha256", secret()).update(`code:${value}`).digest("hex"); }
function tokenDigest(value: string) { return createHmac("sha256", secret()).update(`token:${value}`).digest("hex"); }
function safeEqual(a: string, b: string) { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
function publicOrigin() { return process.env["PUBLIC_APP_URL"] || "http://localhost:8080"; }

export const createAnonymousTransfer = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ files: z.array(fileSchema).min(1).max(10), maxDownloaders: z.union([z.literal(1),z.literal(5),z.literal(10),z.null()]) }).parse(input))
  .handler(async ({ data }) => {
    const total = data.files.reduce((sum, file) => sum + BigInt(file.size), 0n);
    if (total > MAX_ANON_BYTES) throw new Error("Anonymous transfers are limited to 2 GB");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { beginMultipart, signPart } = await import("./r2.server");
    const transferId = crypto.randomUUID();
    const randomCode = crypto.getRandomValues(new Uint32Array(1))[0];
    if (randomCode === undefined) throw new Error("Secure random generation failed");
    const code = String(Math.floor(randomCode % 10000)).padStart(4, "0");
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const rows = data.files.map((file) => ({ id: crypto.randomUUID(), transfer_id: transferId, object_key: `anon/${transferId}/${crypto.randomUUID()}`, original_name: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size }));
    const { error: transferError } = await supabaseAdmin.from("transfers").insert({ id: transferId, owner_type: "anon", total_bytes: Number(total), expires_at: expiresAt, max_downloaders: data.maxDownloaders, code_hash: codeDigest(code), code_hint: Number(code.slice(-2)), session_token_hash: tokenDigest(sessionToken) });
    if (transferError) throw new Error(transferError.message);
    const { error: filesError } = await supabaseAdmin.from("transfer_files").insert(rows);
    if (filesError) throw new Error(filesError.message);
    const uploads = [];
    try {
      for (const row of rows) {
        const uploadId = await beginMultipart(row.object_key, row.mime_type);
        const partCount = Math.max(1, Math.ceil(row.size_bytes / PART_SIZE));
        const parts = await Promise.all(Array.from({ length: partCount }, async (_, index) => ({ partNumber: index + 1, url: await signPart(row.object_key, uploadId, index + 1) })));
        await supabaseAdmin.from("transfer_files").update({ upload_id: uploadId, upload_status: "uploading" }).eq("id", row.id);
        uploads.push({ fileId: row.id, uploadId, partSize: PART_SIZE, parts });
      }
    } catch (error) {
      await supabaseAdmin.from("transfers").update({ status: "failed" }).eq("id", transferId);
      throw error;
    }
    const deviceHash = tokenDigest(sessionToken);
    await supabaseAdmin.from("anonymous_device_sessions").upsert({ device_token_hash: deviceHash, transfer_ids: [transferId], expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }, { onConflict: "device_token_hash" });
    return { transferId, sessionToken, code, expiresAt, shareUrl: `${publicOrigin()}/t/${transferId}`, uploads };
  });

export const completeAnonymousTransfer = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ transferId: transferIdSchema, sessionToken: z.string().min(32), files: z.array(z.object({ fileId: z.string().uuid(), uploadId: z.string().min(1), parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1) })).min(1) })).min(1).max(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { finishMultipart, inspectObject } = await import("./r2.server");
    const { data: transfer } = await supabaseAdmin.from("transfers").select("id,session_token_hash,status,expires_at,total_bytes").eq("id", data.transferId).maybeSingle();
    if (!transfer || !safeEqual(transfer.session_token_hash, tokenDigest(data.sessionToken))) throw new Error("Transfer not found");
    if (new Date(transfer.expires_at).getTime() <= Date.now()) throw new Error("Transfer expired");
    const { data: files } = await supabaseAdmin.from("transfer_files").select("id,object_key,size_bytes,upload_id").eq("transfer_id", data.transferId);
    if (!files || files.length !== data.files.length) throw new Error("File manifest mismatch");
    for (const completion of data.files) {
      const file = files.find((candidate) => candidate.id === completion.fileId);
      if (!file || file.upload_id !== completion.uploadId) throw new Error("Upload does not belong to this transfer");
      await finishMultipart(file.object_key, completion.uploadId, completion.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })));
      const object = await inspectObject(file.object_key);
      if (BigInt(object.ContentLength ?? -1) !== BigInt(file.size_bytes)) throw new Error("Uploaded object size does not match the signed manifest");
      await supabaseAdmin.from("transfer_files").update({ upload_status: "uploaded" }).eq("id", file.id);
    }
    await supabaseAdmin.from("transfers").update({ status: "active" }).eq("id", data.transferId).eq("status", "waiting");
    await supabaseAdmin.from("usage_events").upsert({ transfer_id: data.transferId, bytes: transfer.total_bytes, event_type: "upload", idempotency_key: `upload:${data.transferId}` }, { onConflict: "idempotency_key" });
    return { ok: true };
  });

export const getTransfer = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ transferId: transferIdSchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: transfer } = await supabaseAdmin.from("transfers").select("id,total_bytes,expires_at,max_downloaders,successful_downloads,status,created_at").eq("id", data.transferId).maybeSingle();
    if (!transfer) return null;
    const { data: files } = await supabaseAdmin.from("transfer_files").select("id,original_name,mime_type,size_bytes").eq("transfer_id", data.transferId).eq("upload_status", "uploaded");
    return { ...transfer, files: files ?? [] };
  });

export const resolveTransferCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string().regex(/^\d{4}$/), clientNonce: z.string().min(16).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const networkHash = digest(data.clientNonce);
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin.from("transfer_code_attempts").select("id", { count: "exact", head: true }).eq("network_hash", networkHash).gte("attempted_at", since);
    if ((count ?? 0) >= 8) throw new Error("Too many attempts. Try again later.");
    const codeHash = codeDigest(data.code);
    const { data: candidates } = await supabaseAdmin.from("transfers").select("id,code_hash").eq("code_hint", Number(data.code.slice(-2))).eq("status", "active").gt("expires_at", new Date().toISOString()).limit(20);
    const transfer = candidates?.find((candidate) => safeEqual(candidate.code_hash, codeHash));
    await supabaseAdmin.from("transfer_code_attempts").insert({ network_hash: networkHash, code_hint: Number(data.code.slice(-2)), succeeded: Boolean(transfer) });
    return transfer ? { transferId: transfer.id } : null;
  });

export const claimTransferDownload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ transferId: transferIdSchema, fingerprint: z.string().min(16).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const claim = randomBytes(24).toString("base64url");
    const { data: allowed, error } = await supabaseAdmin.rpc("claim_transfer_download", { _transfer_id: data.transferId, _claim_hash: digest(claim), _fingerprint_hash: digest(data.fingerprint) });
    if (error || !allowed) throw new Error("This transfer is no longer available");
    const { data: files } = await supabaseAdmin.from("transfer_files").select("id,object_key,original_name,size_bytes").eq("transfer_id", data.transferId).eq("upload_status", "uploaded");
    const { signDownload } = await import("./r2.server");
    const downloads = await Promise.all((files ?? []).map(async (file) => ({ id: file.id, name: file.original_name, size: file.size_bytes, url: await signDownload(file.object_key, file.original_name) })));
    const bytes = (files ?? []).reduce((sum, file) => sum + file.size_bytes, 0);
    await supabaseAdmin.from("usage_events").upsert({ transfer_id: data.transferId, bytes, event_type: "download", idempotency_key: `download:${data.transferId}:${digest(data.fingerprint)}` }, { onConflict: "idempotency_key" });
    return { downloads };
  });
