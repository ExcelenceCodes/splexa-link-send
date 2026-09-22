import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DevShell, Panel, Stat, formatBytes, money } from "@/components/dev-shell";
import { getDeveloperOverview } from "@/lib/developer.functions";
import { getMyRoles } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({ meta: [{ title: "Usage — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Usage,
});

function Usage() {
  const overviewFn = useServerFn(getDeveloperOverview);
  const rolesFn = useServerFn(getMyRoles);
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn({}) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn({}) });
  const usage = overview.data?.usage;
  const billing = overview.data?.billing;
  const allowance = Number(billing?.free_allowance_bytes ?? 0);
  const consumed = Number(billing?.consumed_bytes ?? 0);

  return <DevShell isAdmin={roles.data?.isAdmin} title="Usage" note="Every number here is derived from append-only usage events measured in exact bytes.">
    <div className="grid gap-4 sm:grid-cols-4">
      <Stat label="Uploaded" value={formatBytes(usage?.uploadedBytes ?? 0)} />
      <Stat label="Downloaded" value={formatBytes(usage?.downloadedBytes ?? 0)} />
      <Stat label="Allowance used" value={formatBytes(consumed)} hint={`of ${formatBytes(allowance)}`} />
      <Stat label="Recorded amount" value={money(usage?.debtMinorUnits ?? 0)} />
    </div>
    <Panel title="Recent events" note="Newest first. Events are never edited or deleted.">
      {(usage?.recent ?? []).length === 0 && <p className="text-sm text-muted-foreground">No usage recorded yet.</p>}
      <div className="divide-y divide-border font-mono text-xs">
        {(usage?.recent ?? []).map((event, index) => <div key={index} className="flex flex-wrap justify-between gap-3 py-3">
          <span>{new Date(event.created_at).toLocaleString()}</span>
          <span>{event.event_type}</span>
          <span>{formatBytes(Number(event.bytes))}</span>
          <span>{money(Number(event.amount_minor_units))}</span>
        </div>)}
      </div>
    </Panel>
  </DevShell>;
}
