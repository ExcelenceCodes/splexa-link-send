import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/logout")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing out — Splexanode" }, { name: "robots", content: "noindex" }] }),
  component: Logout,
});

function Logout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    void (async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      void navigate({ to: "/sign-in", replace: true });
    })();
  }, [navigate, queryClient]);
  return <main className="grid min-h-screen place-items-center px-5"><p className="text-muted-foreground">Signing you out…</p></main>;
}
