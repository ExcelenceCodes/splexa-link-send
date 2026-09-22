import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DevShell, Panel, Stat, formatBytes, money } from "@/components/dev-shell";
import { getDeveloperOverview } from "@/lib/developer.functions";
import { getMyRoles } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Billing,
});

const GIB = 1024 * 1024 * 1024;

function Billing() {
  const overviewFn = useServerFn(getDeveloperOverview);
  const rolesFn = useServerFn(getMyRoles);
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn({}) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn({}) });
  const billing = overview.data?.billing;
  const allowance = Number(billing?.free_allowance_bytes ?? 5 * GIB);
  const consumed = Number(billing?.consumed_bytes ?? 0);
  const billableBytes = Math.max(0, consumed - allowance);

  return <DevShell isAdmin={roles.data?.isAdmin} title="Billing" note="Pricing is computed on the server from recorded bytes. Nothing is charged from the browser.">
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Free allowance" value={formatBytes(allowance)} hint="Shared across all your applications and widgets" />
      <Stat label="Beyond allowance" value={formatBytes(billableBytes)} hint="$1.00 per GB" />
      <Stat label="Recorded balance" value={money(billing?.debt_minor_units ?? 0)} hint="Exact minor units" />
    </div>
    <Panel title="How charges are formed">
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        <li>The 5 GB free allowance is per developer account, never multiplied per application or widget.</li>
        <li>Transfer beyond the allowance is $1.00 per GB, computed from exact byte totals in integer arithmetic.</li>
        <li>Base transfer lifetime is 5 minutes. Extending up to 30 minutes costs $0.50 per additional minute.</li>
        <li>Capacity above 5 GB per application is $0.50 per additional GB per month.</li>
      </ul>
    </Panel>
    <Panel title="Settlement" note="Splexanode is in sponsored beta: usage is recorded exactly, and nothing is collected yet.">
      <p className="text-sm text-muted-foreground">When settlement opens, the recorded balance above is what will be presented for payment. No payment provider is connected in this environment, so no checkout is shown here.</p>
    </Panel>
  </DevShell>;
}
