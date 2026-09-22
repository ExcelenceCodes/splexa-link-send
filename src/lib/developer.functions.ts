import { createServerFn } from "@tanstack/react-start";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GIB = 1024 * 1024 * 1024;
const MIN_CAPACITY = 5 * GIB;
const MAX_CAPACITY = 25 * GIB;

function secret() {
  const value = process.env["DEVICE_SESSION_SECRET"];
  if (!value || value.startsWith("replace_") || value.length < 32) throw new Error("DEVICE_SESSION_SECRET is not configured");
  return value;
}
function hmac(input: string) { return createHmac("sha256", secret()).update(input).digest("hex"); }
function sha(input: string) { return createHash("sha256").update(input).digest("hex"); }

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Enter a bare domain such as example.com");
const uuid = z.string().uuid();

export function domainToken(applicationId: string, domain: string) {
  return `splexanode-verify=${hmac(`domain:${applicationId}:${domain}`).slice(0, 40)}`;
}

/** Profile, allowance, and exact byte accounting for the signed-in developer. */
export const getDeveloperOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: billing }, { data: apps }, { data: events }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,company_name,onboarding_complete").eq("id", userId).maybeSingle(),
      supabase.from("developer_billing").select("*").eq("developer_id", userId).maybeSingle(),
      supabase.from("applications").select("id,name,domain_status,production_domain,created_at").eq("developer_id", userId).order("created_at", { ascending: false }),
      supabase.from("usage_events").select("bytes,event_type,amount_minor_units,created_at").eq("developer_id", userId).order("created_at", { ascending: false }).limit(500),
    ]);
    const rows = events ?? [];
    const sum = (type: string) => rows.filter((row) => row.event_type === type).reduce((total, row) => total + Number(row.bytes), 0);
    return {
      profile: profile ?? null,
      billing: billing ?? { developer_id: userId, free_allowance_bytes: MIN_CAPACITY, consumed_bytes: 0, debt_minor_units: 0, capacity_bytes: MIN_CAPACITY },
      applications: apps ?? [],
      usage: {
        uploadedBytes: sum("upload"),
        downloadedBytes: sum("download"),
        transferCount: new Set(rows.map((row) => row.created_at)).size,
        debtMinorUnits: rows.reduce((total, row) => total + Number(row.amount_minor_units), 0),
        recent: rows.slice(0, 40),
      },
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ displayName: z.string().trim().min(2).max(80), companyName: z.string().trim().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      display_name: data.displayName,
      company_name: data.companyName ?? null,
      onboarding_complete: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creates an application and returns the secret key exactly once. */
export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const publicKey = `pk_live_${randomBytes(18).toString("base64url")}`;
    const secretKey = `sk_live_${randomBytes(32).toString("base64url")}`;
    const { data: app, error } = await context.supabase
      .from("applications")
      .insert({ developer_id: context.userId, name: data.name, public_key: publicKey, secret_key_hash: sha(secretKey) })
      .select("id,name,public_key")
      .single();
    if (error) throw new Error(error.message);
    return { application: app, secretKey };
  });

export const rotateApplicationSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const secretKey = `sk_live_${randomBytes(32).toString("base64url")}`;
    const { error } = await context.supabase
      .from("applications")
      .update({ secret_key_hash: sha(secretKey) })
      .eq("id", data.applicationId)
      .eq("developer_id", context.userId);
    if (error) throw new Error(error.message);
    return { secretKey };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app } = await context.supabase.from("applications").select("id,production_domain").eq("id", data.applicationId).maybeSingle();
    if (!app) throw new Error("Application not found");
    // Verified-domain history survives application deletion; it is only unlinked.
    if (app.production_domain) {
      await supabaseAdmin.from("domain_registry").update({ verifying_developer_id: null, status: "released_blocked" }).eq("domain", app.production_domain);
    }
    const { error } = await context.supabase.from("applications").delete().eq("id", data.applicationId).eq("developer_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: application } = await supabase.from("applications").select("*").eq("id", data.applicationId).eq("developer_id", userId).maybeSingle();
    if (!application) return null;
    const [{ data: origins }, { data: widgets }] = await Promise.all([
      supabase.from("application_origins").select("id,origin,kind,created_at").eq("application_id", application.id).order("created_at"),
      supabase.from("widgets").select("id,public_widget_id,config,created_at").eq("application_id", application.id).order("created_at"),
    ]);
    return {
      application,
      origins: origins ?? [],
      widgets: widgets ?? [],
      verificationRecord: application.production_domain ? { host: `_splexanode.${application.production_domain}`, value: domainToken(application.id, application.production_domain) } : null,
    };
  });

/** Binds one bare production domain to the application and issues the TXT challenge. */
export const setProductionDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid, domain: domainSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: history } = await supabaseAdmin.from("domain_registry").select("domain,verifying_developer_id,status").eq("domain", data.domain).maybeSingle();
    if (history && history.verifying_developer_id !== context.userId) {
      throw new Error("This domain has already been verified on Splexanode and cannot be attached to another account.");
    }
    const { error } = await context.supabase
      .from("applications")
      .update({ production_domain: data.domain, domain_status: "pending" })
      .eq("id", data.applicationId)
      .eq("developer_id", context.userId);
    if (error) throw new Error(error.message);
    return { host: `_splexanode.${data.domain}`, value: domainToken(data.applicationId, data.domain) };
  });

/** Server-side DNS TXT proof. A typed-in domain is never trusted. */
export const verifyProductionDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: application } = await context.supabase.from("applications").select("id,production_domain").eq("id", data.applicationId).eq("developer_id", context.userId).maybeSingle();
    if (!application?.production_domain) throw new Error("Add a production domain first");
    const domain = application.production_domain;
    const expected = domainToken(application.id, domain);
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(`_splexanode.${domain}`)}&type=TXT`, { headers: { accept: "application/dns-json" } });
    if (!response.ok) throw new Error("DNS lookup failed. Try again shortly.");
    const payload = (await response.json()) as { Answer?: Array<{ data: string }> };
    const records = (payload.Answer ?? []).map((answer) => answer.data.replace(/^"|"$/g, "").replace(/""/g, ""));
    const matched = records.some((record) => record.trim() === expected);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!matched) {
      await context.supabase.from("applications").update({ domain_status: "failed" }).eq("id", application.id);
      return { verified: false, records };
    }
    await supabaseAdmin.from("domain_registry").upsert({
      domain,
      first_verified_at: new Date().toISOString(),
      verifying_developer_id: context.userId,
      verification_token_hash: sha(expected),
      status: "verified",
    }, { onConflict: "domain" });
    await context.supabase.from("applications").update({ domain_status: "verified" }).eq("id", application.id);
    const productionOrigin = `https://${domain}`;
    const { data: existingOrigin } = await context.supabase.from("application_origins").select("id").eq("application_id", application.id).eq("origin", productionOrigin).maybeSingle();
    if (!existingOrigin) {
      await context.supabase.from("application_origins").insert({ application_id: application.id, origin: productionOrigin, kind: "production_subdomain" });
    }
    return { verified: true, records };
  });

const originSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^https?:\/\/[a-z0-9.-]+(:\d{2,5})?$/, "Use a full origin such as http://localhost:5173");

export const addApplicationOrigin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid, origin: originSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: application } = await context.supabase.from("applications").select("id,production_domain,domain_status").eq("id", data.applicationId).eq("developer_id", context.userId).maybeSingle();
    if (!application) throw new Error("Application not found");
    const host = new URL(data.origin).hostname;
    const isDev = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
    if (!isDev) {
      if (application.domain_status !== "verified" || !application.production_domain) throw new Error("Verify the production domain before adding production origins");
      const verified = application.production_domain;
      if (host !== verified && !host.endsWith(`.${verified}`)) throw new Error(`Production origins must sit under ${verified}`);
      if (!data.origin.startsWith("https://")) throw new Error("Production origins must use HTTPS");
    }
    const { error } = await context.supabase.from("application_origins").insert({ application_id: application.id, origin: data.origin, kind: isDev ? "development" : "production_subdomain" });
    if (error) throw new Error(error.message);
    return { ok: true, kind: isDev ? "development" : "production_subdomain" };
  });

export const removeApplicationOrigin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ originId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("application_origins").delete().eq("id", data.originId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const widgetConfigSchema = z.object({
  label: z.string().trim().min(1).max(80).default("Upload files"),
  hint: z.string().trim().max(200).default(""),
  theme: z.enum(["light", "dark"]).default("light"),
  language: z.enum(["en"]).default("en"),
  acceptedTypes: z.array(z.string().trim().max(120)).max(30).default([]),
  maxFiles: z.number().int().min(1).max(10).default(5),
  maxBytes: z.number().int().min(1024).max(MAX_CAPACITY).default(2 * GIB),
  allowPhoneHandoff: z.boolean().default(true),
  showCode: z.boolean().default(true),
  accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#2F86FF"),
  // Presentation-only CSS for the embedded modal. Security limits stay server-owned.
  customCss: z.string().max(4000).default(""),
});

export const saveWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid, widgetId: uuid.optional(), config: widgetConfigSchema }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.widgetId) {
      const { error } = await context.supabase.from("widgets").update({ config: data.config }).eq("id", data.widgetId);
      if (error) throw new Error(error.message);
      return { widgetId: data.widgetId };
    }
    const publicWidgetId = `wgt_${randomBytes(12).toString("base64url")}`;
    const { data: widget, error } = await context.supabase
      .from("widgets")
      .insert({ application_id: data.applicationId, public_widget_id: publicWidgetId, config: data.config })
      .select("id,public_widget_id")
      .single();
    if (error) throw new Error(error.message);
    return { widgetId: widget.id, publicWidgetId: widget.public_widget_id };
  });

export const deleteWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ widgetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("widgets").delete().eq("id", data.widgetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Upload capacity above the 5 GB allowance is billed; the server owns the number. */
export const setUploadCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: uuid, gigabytes: z.number().int().min(5).max(25) }).parse(input))
  .handler(async ({ data, context }) => {
    const bytes = data.gigabytes * GIB;
    const { error } = await context.supabase
      .from("applications")
      .update({ max_upload_bytes: bytes })
      .eq("id", data.applicationId)
      .eq("developer_id", context.userId);
    if (error) throw new Error(error.message);
    return { maxUploadBytes: bytes, extraGigabytes: Math.max(0, (bytes - MIN_CAPACITY) / GIB) };
  });
