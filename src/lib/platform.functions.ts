import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function requireAdmin(context: Ctx) {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Platform administrators only");
}

/** Tells the app whether the signed-in developer is also a platform administrator. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((row: { role: string }) => row.role);
    return { roles, isAdmin: roles.includes("admin") };
  });

/** Live platform-wide counters and the most recent transfers. Administrators only. */
export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [transfers, apps, developers, usage, recent] = await Promise.all([
      supabaseAdmin.from("transfers").select("status,total_bytes,owner_type,created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("applications").select("id,domain_status"),
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("usage_events").select("bytes,event_type,amount_minor_units").limit(2000),
      supabaseAdmin.from("transfers").select("id,status,owner_type,total_bytes,created_at,expires_at").order("created_at", { ascending: false }).limit(25),
    ]);
    const rows = transfers.data ?? [];
    const events = usage.data ?? [];
    const bytes = (type: string) => events.filter((e) => e.event_type === type).reduce((t, e) => t + Number(e.bytes), 0);
    return {
      transfers: {
        total: rows.length,
        active: rows.filter((r) => r.status === "active").length,
        waiting: rows.filter((r) => r.status === "waiting").length,
        expired: rows.filter((r) => r.status === "expired").length,
        anonymous: rows.filter((r) => r.owner_type === "anon").length,
        application: rows.filter((r) => r.owner_type === "app").length,
      },
      applications: { total: (apps.data ?? []).length, verified: (apps.data ?? []).filter((a) => a.domain_status === "verified").length },
      developers: (developers.data ?? []).length,
      bytes: { uploaded: bytes("upload"), downloaded: bytes("download") },
      billableMinorUnits: events.reduce((t, e) => t + Number(e.amount_minor_units), 0),
      recent: recent.data ?? [],
    };
  });

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data } = await context.supabase.from("platform_settings").select("key,value,updated_at").order("key");
    return data ?? [];
  });

export const savePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ key: z.string().trim().min(2).max(60), value: z.string().min(2).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let parsed: unknown;
    try { parsed = JSON.parse(data.value); } catch { throw new Error("Value must be valid JSON"); }
    const { error } = await context.supabase.from("platform_settings").upsert({ key: data.key, value: parsed });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
