import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DevShell, Panel } from "@/components/dev-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getPlatformSettings, savePlatformSetting } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/platform-settings")({
  head: () => ({ meta: [{ title: "Platform settings — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: PlatformSettings,
});

function PlatformSettings() {
  const listFn = useServerFn(getPlatformSettings);
  const saveFn = useServerFn(savePlatformSetting);
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: () => listFn({}) });
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const save = useMutation({
    mutationFn: () => saveFn({ data: { key, value } }),
    onSuccess: () => { setKey(""); setValue(""); void queryClient.invalidateQueries({ queryKey: ["platform-settings"] }); },
  });

  if (settings.error) return <DevShell isAdmin title="Platform settings"><p className="text-sm text-destructive">{(settings.error as Error).message}</p></DevShell>;

  return <DevShell isAdmin title="Platform settings" note="Values are JSON and are read by the server only. They never change security enforcement.">
    <Panel title="Current values">
      <div className="space-y-4">
        {(settings.data ?? []).map((row) => <div key={row.key} className="space-y-2">
          <p className="font-mono text-xs">{row.key}</p>
          <pre className="overflow-x-auto border border-border bg-muted p-3 font-mono text-xs">{JSON.stringify(row.value, null, 2)}</pre>
          <Button variant="outline" size="sm" onClick={() => { setKey(row.key); setValue(JSON.stringify(row.value, null, 2)); }}>Edit</Button>
        </div>)}
      </div>
    </Panel>
    <Panel title="Save a value">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <label className="block"><span className="label">Key</span><Input className="mt-2 h-11 max-w-sm font-mono" value={key} onChange={(event) => setKey(event.target.value)} required /></label>
        <label className="block"><span className="label">JSON value</span><Textarea className="mt-2 font-mono text-xs" rows={8} value={value} onChange={(event) => setValue(event.target.value)} required /></label>
        <Button className="h-11" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save setting"}</Button>
        {save.error && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
      </form>
    </Panel>
  </DevShell>;
}
