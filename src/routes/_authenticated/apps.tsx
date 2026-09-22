import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DevShell, Panel, Secret, Stat, formatBytes, money } from "@/components/dev-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApplication, getDeveloperOverview } from "@/lib/developer.functions";
import { getMyRoles } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/apps")({
  head: () => ({ meta: [{ title: "Applications — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Apps,
});

function Apps() {
  const overviewFn = useServerFn(getDeveloperOverview);
  const rolesFn = useServerFn(getMyRoles);
  const createFn = useServerFn(createApplication);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<{ publicKey: string; secretKey: string } | null>(null);
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn({}) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn({}) });
  const create = useMutation({
    mutationFn: (value: string) => createFn({ data: { name: value } }),
    onSuccess: (result) => {
      setIssued({ publicKey: result.application.public_key, secretKey: result.secretKey });
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const billing = overview.data?.billing;
  const consumed = Number(billing?.consumed_bytes ?? 0);
  const allowance = Number(billing?.free_allowance_bytes ?? 0);

  return <DevShell isAdmin={roles.data?.isAdmin} title="Applications" note="Each application owns one verified production domain and any number of independently configured upload widgets.">
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Uploaded" value={formatBytes(overview.data?.usage.uploadedBytes ?? 0)} hint="Exact bytes recorded" />
      <Stat label="Allowance left" value={formatBytes(Math.max(0, allowance - consumed))} hint={`of ${formatBytes(allowance)}`} />
      <Stat label="Recorded amount" value={money(overview.data?.usage.debtMinorUnits ?? 0)} hint="Billable usage to date" />
    </div>

    <Panel title="Create an application" note="The secret key is shown once and never stored in readable form.">
      <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); if (name.trim().length >= 2) create.mutate(name); }}>
        <Input className="h-11 max-w-sm" placeholder="Application name" value={name} onChange={(event) => setName(event.target.value)} />
        <Button className="h-11" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create application"}</Button>
      </form>
      {create.error && <p className="text-sm text-destructive">{(create.error as Error).message}</p>}
      {issued && <div className="space-y-2 border border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-semibold">Save the secret key now. It cannot be shown again.</p>
        <Secret value={`public key  ${issued.publicKey}`} />
        <Secret value={`secret key  ${issued.secretKey}`} />
      </div>}
    </Panel>

    <Panel title="Your applications">
      {overview.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {overview.data?.applications.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
      <div className="divide-y divide-border">
        {(overview.data?.applications ?? []).map((app) => <Link key={app.id} to="/app/$applicationId" params={{ applicationId: app.id }} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-primary">
          <span className="text-lg font-semibold">{app.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{app.production_domain ?? "no domain"} · {app.domain_status}</span>
        </Link>)}
      </div>
    </Panel>
  </DevShell>;
}
