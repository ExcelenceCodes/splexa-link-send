import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DevShell, Panel, Secret, formatBytes } from "@/components/dev-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addApplicationOrigin, deleteApplication, deleteWidget, getApplication, removeApplicationOrigin,
  rotateApplicationSecret, saveWidget, setProductionDomain, setUploadCapacity, verifyProductionDomain,
} from "@/lib/developer.functions";
import { getMyRoles } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/app/$applicationId")({
  head: () => ({ meta: [{ title: "Application — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: AppDetail,
});

type WidgetConfig = {
  label: string; hint: string; theme: "light" | "dark"; language: "en"; acceptedTypes: string[];
  maxFiles: number; maxBytes: number; allowPhoneHandoff: boolean; showCode: boolean; accentColor: string; customCss: string;
};

const blank: WidgetConfig = {
  label: "Upload files", hint: "", theme: "light", language: "en", acceptedTypes: [],
  maxFiles: 5, maxBytes: 2 * 1024 * 1024 * 1024, allowPhoneHandoff: true, showCode: true,
  accentColor: "#2F86FF", customCss: "",
};

function AppDetail() {
  const { applicationId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useServerFn(getApplication);
  const rolesFn = useServerFn(getMyRoles);
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn({}) });
  const app = useQuery({ queryKey: ["app", applicationId], queryFn: () => load({ data: { applicationId } }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["app", applicationId] });

  const rotateFn = useServerFn(rotateApplicationSecret);
  const domainFn = useServerFn(setProductionDomain);
  const verifyFn = useServerFn(verifyProductionDomain);
  const originFn = useServerFn(addApplicationOrigin);
  const removeOriginFn = useServerFn(removeApplicationOrigin);
  const widgetFn = useServerFn(saveWidget);
  const deleteWidgetFn = useServerFn(deleteWidget);
  const capacityFn = useServerFn(setUploadCapacity);
  const deleteAppFn = useServerFn(deleteApplication);

  const [secretKey, setSecretKey] = useState("");
  const [domain, setDomain] = useState("");
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<{ id?: string; config: WidgetConfig } | null>(null);

  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: () => { void refresh(); },
    onError: (error: Error) => setMessage(error.message),
  });
  const run = (fn: () => Promise<unknown>) => { setMessage(""); action.mutate(fn); };

  const data = app.data;
  const application = data?.application;

  return <DevShell isAdmin={roles.data?.isAdmin} title={application?.name ?? "Application"} note="API keys, verified domain, origins, and upload widgets.">
    {message && <p className="border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}

    <Panel title="Keys" note="The public key is safe in a browser. The secret key is only shown when created or rotated.">
      <Secret value={`public key  ${application?.public_key ?? "…"}`} />
      {secretKey && <Secret value={`secret key  ${secretKey}`} />}
      <Button variant="outline" onClick={() => { setMessage(""); void rotateFn({ data: { applicationId } }).then((result) => setSecretKey(result.secretKey)).catch((error: Error) => setMessage(error.message)); }}>Rotate secret key</Button>
    </Panel>

    <Panel title="Production domain" note="One verified domain per application, proven by a DNS TXT record.">
      <p className="text-sm text-muted-foreground">Current: <span className="font-mono">{application?.production_domain ?? "none"}</span> · status <span className="font-mono">{application?.domain_status ?? "—"}</span></p>
      <div className="flex flex-wrap gap-3">
        <Input className="h-11 max-w-sm" placeholder="example.com" value={domain} onChange={(event) => setDomain(event.target.value)} />
        <Button className="h-11" onClick={() => run(() => domainFn({ data: { applicationId, domain } }))}>Save domain</Button>
        <Button className="h-11" variant="outline" onClick={() => run(async () => { const result = await verifyFn({ data: { applicationId } }); setMessage(result.verified ? "" : "TXT record not found yet. DNS can take a few minutes."); })}>Verify now</Button>
      </div>
      {data?.verificationRecord && <div className="space-y-2">
        <Secret value={`TXT host   ${data.verificationRecord.host}`} />
        <Secret value={`TXT value  ${data.verificationRecord.value}`} />
      </div>}
    </Panel>

    <Panel title="Origins" note="Development origins (localhost) need no verification. Production origins must sit under the verified domain over HTTPS.">
      <div className="flex flex-wrap gap-3">
        <Input className="h-11 max-w-sm" placeholder="http://localhost:5173" value={origin} onChange={(event) => setOrigin(event.target.value)} />
        <Button className="h-11" onClick={() => run(() => originFn({ data: { applicationId, origin } }))}>Add origin</Button>
      </div>
      <div className="divide-y divide-border">
        {(data?.origins ?? []).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3 font-mono text-xs">
          <span>{entry.origin} · {entry.kind}</span>
          <button type="button" className="text-destructive" onClick={() => run(() => removeOriginFn({ data: { originId: entry.id } }))}>Remove</button>
        </div>)}
      </div>
    </Panel>

    <Panel title="Capacity" note="5 GB is included. Each additional GB is $0.50 per month.">
      <p className="text-sm text-muted-foreground">Current cap: {formatBytes(Number(application?.max_upload_bytes ?? 0))}</p>
      <div className="flex flex-wrap gap-2">
        {[5, 10, 15, 25].map((gigabytes) => <Button key={gigabytes} variant="outline" onClick={() => run(() => capacityFn({ data: { applicationId, gigabytes } }))}>{gigabytes} GB</Button>)}
      </div>
    </Panel>

    <Panel title="Upload widgets" note="Each widget has its own labels, limits, accent colour, and custom CSS for the mobile upload modal.">
      <Button variant="outline" onClick={() => setEditing({ config: blank })}>New widget</Button>
      <div className="divide-y divide-border">
        {(data?.widgets ?? []).map((widget) => {
          const config = { ...blank, ...(widget.config as Partial<WidgetConfig>) };
          return <div key={widget.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">{config.label}</span>
              <span className="flex gap-4 text-xs">
                <button type="button" className="text-primary" onClick={() => setEditing({ id: widget.id, config })}>Edit</button>
                <button type="button" className="text-destructive" onClick={() => run(() => deleteWidgetFn({ data: { widgetId: widget.id } }))}>Delete</button>
              </span>
            </div>
            <Secret value={`<script src="${typeof window === "undefined" ? "" : window.location.origin}/splexanode.js" data-splexanode-widget="${widget.public_widget_id}" defer></script>`} />
          </div>;
        })}
      </div>
      {editing && <WidgetEditor
        value={editing.config}
        onCancel={() => setEditing(null)}
        onSave={(config) => run(async () => { await widgetFn({ data: { applicationId, ...(editing.id ? { widgetId: editing.id } : {}), config } }); setEditing(null); })}
      />}
    </Panel>

    <Panel title="Delete application" note="Verified domain history is kept permanently to prevent allowance abuse; the domain is only unlinked.">
      <Button variant="outline" className="text-destructive" onClick={() => run(async () => { await deleteAppFn({ data: { applicationId } }); void navigate({ to: "/apps" }); })}>Delete application</Button>
    </Panel>
  </DevShell>;
}

function WidgetEditor({ value, onSave, onCancel }: { value: WidgetConfig; onSave: (config: WidgetConfig) => void; onCancel: () => void }) {
  const [config, setConfig] = useState(value);
  const patch = (next: Partial<WidgetConfig>) => setConfig((current) => ({ ...current, ...next }));
  return <form className="space-y-4 border border-primary/40 bg-primary/5 p-5" onSubmit={(event) => { event.preventDefault(); onSave(config); }}>
    <label className="block"><span className="label">Label</span><Input className="mt-2 h-11" value={config.label} onChange={(event) => patch({ label: event.target.value })} required /></label>
    <label className="block"><span className="label">Hint</span><Input className="mt-2 h-11" value={config.hint} onChange={(event) => patch({ hint: event.target.value })} /></label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block"><span className="label">Max files</span><Input className="mt-2 h-11" type="number" min={1} max={10} value={config.maxFiles} onChange={(event) => patch({ maxFiles: Number(event.target.value) })} /></label>
      <label className="block"><span className="label">Max size (GB)</span><Input className="mt-2 h-11" type="number" min={1} max={25} value={Math.max(1, Math.round(config.maxBytes / (1024 ** 3)))} onChange={(event) => patch({ maxBytes: Number(event.target.value) * 1024 ** 3 })} /></label>
      <label className="block"><span className="label">Accent colour</span><Input className="mt-2 h-11" type="color" value={config.accentColor} onChange={(event) => patch({ accentColor: event.target.value })} /></label>
    </div>
    <label className="block"><span className="label">Accepted types (comma separated)</span><Input className="mt-2 h-11" value={config.acceptedTypes.join(",")} onChange={(event) => patch({ acceptedTypes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="image/*, application/pdf" /></label>
    <div className="flex flex-wrap gap-6 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={config.allowPhoneHandoff} onChange={(event) => patch({ allowPhoneHandoff: event.target.checked })} />Allow phone handoff</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={config.showCode} onChange={(event) => patch({ showCode: event.target.checked })} />Show four-digit code</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={config.theme === "dark"} onChange={(event) => patch({ theme: event.target.checked ? "dark" : "light" })} />Dark modal</label>
    </div>
    <label className="block"><span className="label">Custom modal CSS</span><Textarea className="mt-2 font-mono text-xs" rows={6} value={config.customCss} onChange={(event) => patch({ customCss: event.target.value })} placeholder=".spx-modal { border-radius: 18px; }" /></label>
    <div className="flex gap-3"><Button className="h-11">Save widget</Button><Button type="button" variant="outline" className="h-11" onClick={onCancel}>Cancel</Button></div>
  </form>;
}
