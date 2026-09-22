import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeOnboarding } from "@/lib/developer.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your account — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const saveFn = useServerFn(completeOnboarding);
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const save = useMutation({
    mutationFn: () => saveFn({ data: { displayName, companyName: companyName || undefined } }),
    onSuccess: () => navigate({ to: "/apps" }),
  });

  return <main className="mx-auto max-w-lg px-5 py-20">
    <Logo />
    <h1 className="mt-12 text-4xl font-bold">Tell us who is building.</h1>
    <p className="mt-3 text-muted-foreground">This appears on transfer requests your users see, so keep it recognisable.</p>
    <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <label className="block"><span className="label">Display name</span><Input className="mt-2 h-11" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label>
      <label className="block"><span className="label">Company (optional)</span><Input className="mt-2 h-11" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
      {save.error && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
      <Button className="h-11 w-full" disabled={save.isPending}>{save.isPending ? "Saving…" : "Continue"}</Button>
    </form>
  </main>;
}
