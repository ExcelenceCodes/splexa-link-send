import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { DevShell, Panel } from "@/components/dev-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding, getDeveloperOverview } from "@/lib/developer.functions";
import { getMyRoles } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Settings,
});

function Settings() {
  const overviewFn = useServerFn(getDeveloperOverview);
  const rolesFn = useServerFn(getMyRoles);
  const saveFn = useServerFn(completeOnboarding);
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => overviewFn({}) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => rolesFn({}) });
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordNote, setPasswordNote] = useState("");

  useEffect(() => {
    if (!overview.data?.profile) return;
    setDisplayName(overview.data.profile.display_name ?? "");
    setCompanyName(overview.data.profile.company_name ?? "");
  }, [overview.data?.profile]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { displayName, companyName: companyName || undefined } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["overview"] }),
  });

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordNote("");
    const { error } = await supabase.auth.updateUser({ password });
    setPassword("");
    setPasswordNote(error ? error.message : "Password updated. Other sessions were signed out.");
    if (!error) await supabase.auth.signOut({ scope: "others" });
  }

  return <DevShell isAdmin={roles.data?.isAdmin} title="Settings" note="Your profile and account credentials.">
    <Panel title="Profile">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <label className="block"><span className="label">Display name</span><Input className="mt-2 h-11 max-w-md" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label>
        <label className="block"><span className="label">Company (optional)</span><Input className="mt-2 h-11 max-w-md" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
        <Button className="h-11" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
        {save.isSuccess && <p className="text-sm text-muted-foreground">Profile saved.</p>}
        {save.error && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
      </form>
    </Panel>
    <Panel title="Password" note="Minimum 12 characters. Changing it signs out every other session.">
      <form className="space-y-4" onSubmit={changePassword}>
        <Input className="h-11 max-w-md" type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Button className="h-11" variant="outline">Update password</Button>
        {passwordNote && <p className="text-sm text-muted-foreground">{passwordNote}</p>}
      </form>
    </Panel>
  </DevShell>;
}
