import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, File, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { claimTransferDownload, getTransfer } from "@/lib/transfers.functions";

export const Route = createFileRoute("/t/$transferId")({
  loader: async ({ params }) => { const transfer = await getTransfer({ data: { transferId: params.transferId } }); if (!transfer) throw notFound(); return transfer; },
  head: () => ({ meta: [{ title: "Receive files — Splexanode" }, { name: "description", content: "Receive a temporary Splexanode file transfer." }, { property: "og:title", content: "A Splexanode transfer is waiting" }, { property: "og:description", content: "Open this temporary transfer before it expires." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TransferDownload,
});
function TransferDownload() {
  const transfer = Route.useLoaderData(); const claim = useServerFn(claimTransferDownload); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const expired = transfer.status !== "active" || new Date(transfer.expires_at).getTime() <= Date.now();
  async function download() { setBusy(true); setError(""); try { let fingerprint = sessionStorage.getItem("splexanode-download-device"); if (!fingerprint) { fingerprint = crypto.randomUUID()+crypto.randomUUID(); sessionStorage.setItem("splexanode-download-device", fingerprint); } const result = await claim({ data: { transferId: transfer.id, fingerprint } }); for (const file of result.downloads) { const link = document.createElement("a"); link.href = file.url; link.click(); } } catch (e) { setError(e instanceof Error ? e.message : "Download unavailable"); } finally { setBusy(false); } }
  return <><SiteHeader/><main className="mx-auto max-w-3xl px-5 py-16 lg:py-24"><p className="eyebrow">Incoming transfer</p><h1 className="mt-4 text-4xl font-bold sm:text-6xl">{expired ? "This transfer has closed." : "Files are ready."}</h1><p className="mt-5 text-lg text-muted-foreground">{expired ? "Its lifetime ended or its downloader limit was reached." : `Available until ${new Date(transfer.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`}</p><div className="mt-10 border-y border-border">{transfer.files.map((file) => <div key={file.id} className="flex items-center gap-4 border-b border-border py-4 last:border-0"><File className="size-4 text-primary"/><span className="min-w-0 flex-1 truncate font-medium">{file.original_name}</span><span className="font-mono text-xs text-muted-foreground">{(file.size_bytes/1024/1024).toFixed(1)} MB</span></div>)}</div>{error && <p className="mt-5 text-sm text-destructive">{error}</p>}<div className="mt-8 flex items-center gap-4"><Button size="lg" disabled={expired || busy} onClick={download}><Download/>{busy ? "Preparing…" : "Download files"}</Button><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4"/>Short-lived signed access</span></div></main></>;
}
