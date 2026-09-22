import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/apps", label: "Applications" },
  { to: "/usage", label: "Usage" },
  { to: "/billing", label: "Billing" },
  { to: "/settings", label: "Settings" },
] as const;

const adminLinks = [
  { to: "/platform", label: "Platform" },
  { to: "/platform-settings", label: "Platform settings" },
] as const;

export function formatBytes(value: number) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let index = -1;
  let scaled = bytes;
  while (scaled >= 1024 && index < units.length - 1) { scaled /= 1024; index += 1; }
  return `${scaled.toFixed(scaled < 10 ? 2 : 1)} ${units[index]}`;
}

export function money(minorUnits: number) {
  const units = BigInt(Math.trunc(Number(minorUnits ?? 0)));
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  return `${sign}$${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function DevShell({ title, note, actions, children, isAdmin }: { title: string; note?: string; actions?: React.ReactNode; children: React.ReactNode; isAdmin?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/sign-in", replace: true });
  }
  return <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="flex flex-col gap-8 border-b border-border bg-ink px-5 py-6 text-ink-foreground lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
      <Logo className="text-ink-foreground" />
      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:flex-col lg:gap-2" aria-label="Developer">
        {links.map((link) => <Link key={link.to} to={link.to} activeProps={{ className: "text-ink-foreground font-semibold" }} className="text-ink-muted hover:text-ink-foreground">{link.label}</Link>)}
        {isAdmin && adminLinks.map((link) => <Link key={link.to} to={link.to} activeProps={{ className: "text-ink-foreground font-semibold" }} className="text-ink-muted hover:text-ink-foreground">{link.label}</Link>)}
      </nav>
      <div className="mt-auto space-y-3">
        <Link to="/docs" className="block text-sm text-ink-muted hover:text-ink-foreground">Documentation</Link>
        <button type="button" onClick={signOut} className="text-sm text-ink-muted hover:text-ink-foreground">Sign out</button>
        <p className="font-mono text-[10px] text-ink-muted">TRANSFER, NOT STORAGE.</p>
      </div>
    </aside>
    <main className="px-5 py-10 lg:px-10 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
        <div>
          <h1 className="text-4xl font-bold">{title}</h1>
          {note && <p className="mt-2 max-w-2xl text-muted-foreground">{note}</p>}
        </div>
        {actions}
      </header>
      <div className="mt-9 max-w-5xl">{children}</div>
    </main>
  </div>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="border border-border p-5">
    <p className="eyebrow">{label}</p>
    <p className="mt-3 font-display text-3xl font-bold">{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>;
}

export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="mt-10 border border-border p-6">
    <h2 className="text-xl font-semibold">{title}</h2>
    {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
    <div className="mt-5 space-y-4">{children}</div>
  </section>;
}

export function Secret({ value }: { value: string }) {
  return <code className="block overflow-x-auto break-all border border-border bg-muted px-3 py-2 font-mono text-xs">{value}</code>;
}
