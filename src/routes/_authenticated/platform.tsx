import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DevShell, Panel, Stat, formatBytes, money } from "@/components/dev-shell";
import { getPlatformOverview } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({ meta: [{ title: "Platform — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Platform,
});

function Platform() {
  const overviewFn = useServerFn(getPlatformOverview);
  const overview = useQuery({ queryKey: ["platform"], queryFn: () => overviewFn({}), refetchInterval: 10_000 });
  const data = overview.data;

  if (overview.error) return <DevShell isAdmin title="Platform"><p className="text-sm text-destructive">{(overview.error as Error).message}</p></DevShell>;

  return <DevShell isAdmin title="Platform" note="Live platform counters, refreshed automatically every ten seconds.">
    <div className="grid gap-4 sm:grid-cols-4">
      <Stat label="Transfers" value={String(data?.transfers.total ?? 0)} hint={`${data?.transfers.active ?? 0} active · ${data?.transfers.waiting ?? 0} waiting`} />
      <Stat label="Developers" value={String(data?.developers ?? 0)} />
      <Stat label="Applications" value={String(data?.applications.total ?? 0)} hint={`${data?.applications.verified ?? 0} verified`} />
      <Stat label="Billable usage" value={money(data?.billableMinorUnits ?? 0)} />
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <Stat label="Uploaded" value={formatBytes(data?.bytes.uploaded ?? 0)} />
      <Stat label="Downloaded" value={formatBytes(data?.bytes.downloaded ?? 0)} />
      <Stat label="Anonymous / app" value={`${data?.transfers.anonymous ?? 0} / ${data?.transfers.application ?? 0}`} />
    </div>
    <Panel title="Recent transfers">
      <div className="divide-y divide-border font-mono text-xs">
        {(data?.recent ?? []).map((transfer) => <div key={transfer.id} className="flex flex-wrap justify-between gap-3 py-3">
          <span>{new Date(transfer.created_at).toLocaleString()}</span>
          <span>{transfer.owner_type}</span>
          <span>{transfer.status}</span>
          <span>{formatBytes(Number(transfer.total_bytes))}</span>
        </div>)}
      </div>
    </Panel>
  </DevShell>;
}
