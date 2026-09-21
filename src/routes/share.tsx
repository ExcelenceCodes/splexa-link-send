import { createFileRoute } from "@tanstack/react-router";
import { ShareWorkspace } from "@/components/share-workspace";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/share")({
  head: () => ({ meta: [
    { title: "Send files — Splexanode Share" },
    { name: "description", content: "Send up to 2 GB directly with a temporary link, QR code, and four-digit transfer code." },
    { property: "og:title", content: "Splexanode Share — Send files without an account" },
    { property: "og:description", content: "Temporary, direct-to-cloud file transfers with no storage subscription." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <><SiteHeader/><main><ShareWorkspace/></main></>,
});
