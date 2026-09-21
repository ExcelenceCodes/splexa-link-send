import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Copy, FileUp, Link2, Plus, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createAnonymousTransfer, completeAnonymousTransfer } from "@/lib/transfers.functions";
import { saveRecovery } from "@/lib/indexed-db";

const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`;
const formatTime = (seconds: number) => seconds < 60 ? `${Math.max(1, Math.round(seconds))} sec` : `${Math.ceil(seconds / 60)} min`;

type Result = { transferId: string; code: string; expiresAt: string; shareUrl: string; qr: string };

export function ShareWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const createTransfer = useServerFn(createAnonymousTransfer);
  const completeTransfer = useServerFn(completeAnonymousTransfer);
  const [files, setFiles] = useState<File[]>([]);
  const [maxDownloaders, setMaxDownloaders] = useState<1 | 5 | 10 | null>(1);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(0);
  const [eta, setEta] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 10);
    setFiles(next);
    setError(next.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES ? "This transfer exceeds the 2 GB Share limit." : "");
  }

  async function upload() {
    if (!files.length || totalBytes > MAX_BYTES) return;
    setState("uploading"); setError(""); setProgress(0);
    try {
      const created = await createTransfer({ data: { files: files.map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size })), maxDownloaders } });
      await saveRecovery({ transferId: created.transferId, sessionToken: created.sessionToken, expiresAt: created.expiresAt });
      let uploaded = 0;
      const started = performance.now();
      const completions = [];
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex]; const plan = created.uploads[fileIndex];
        if (!file || !plan) throw new Error("Upload manifest mismatch");
        const parts = [];
        for (const part of plan.parts) {
          const start = (part.partNumber - 1) * plan.partSize;
          const body = file.slice(start, Math.min(start + plan.partSize, file.size));
          const response = await fetch(part.url, { method: "PUT", body });
          if (!response.ok) throw new Error(`Upload failed for ${file.name}`);
          const etag = response.headers.get("etag");
          if (!etag) throw new Error("R2 CORS must expose the ETag response header");
          parts.push({ partNumber: part.partNumber, etag });
          uploaded += body.size;
          const elapsed = Math.max(0.1, (performance.now() - started) / 1000);
          const bytesPerSecond = uploaded / elapsed;
          setRate(bytesPerSecond); setProgress((uploaded / totalBytes) * 100); setEta((totalBytes - uploaded) / bytesPerSecond);
        }
        completions.push({ fileId: plan.fileId, uploadId: plan.uploadId, parts });
      }
      await completeTransfer({ data: { transferId: created.transferId, sessionToken: created.sessionToken, files: completions } });
      const qr = await QRCode.toDataURL(created.shareUrl, { width: 320, margin: 1, color: { dark: "#0B0F19", light: "#FAFAF9" } });
      setResult({ transferId: created.transferId, code: created.code, expiresAt: created.expiresAt, shareUrl: created.shareUrl, qr });
      setState("done");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Transfer failed"); setState("error"); }
  }

  if (state === "done" && result) return <section className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
    <div className="mb-10 flex size-12 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="size-5" /></div>
    <p className="eyebrow">Transfer ready</p><h1 className="mt-3 max-w-2xl text-4xl font-bold sm:text-6xl">Your files are moving.</h1>
    <p className="mt-5 text-lg text-muted-foreground">Anyone with the link or code can download until the five-minute window closes.</p>
    <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-[1fr_220px]">
      <div className="bg-background p-6 sm:p-8">
        <p className="label">Share link</p><div className="mt-3 flex items-center gap-3 border-b border-border pb-4"><Link2 className="size-4 text-primary"/><span className="min-w-0 flex-1 truncate font-mono text-sm">{result.shareUrl}</span><Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(result.shareUrl)} aria-label="Copy share link"><Copy /></Button></div>
        <p className="label mt-8">Four-digit code</p><p className="mt-3 font-mono text-4xl font-semibold tracking-[0.18em]">{result.code}</p>
        <div className="mt-8 flex gap-3"><Button onClick={() => { setFiles([]); setResult(null); setState("idle"); }}>New transfer</Button><Button variant="outline" asChild><a href={result.shareUrl}>Open link</a></Button></div>
      </div>
      <div className="flex items-center justify-center bg-surface p-7"><img src={result.qr} alt="QR code for this transfer" className="aspect-square w-full max-w-40" /></div>
    </div>
  </section>;

  return <section className="mx-auto grid max-w-7xl gap-12 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
    <div className="pt-4"><p className="eyebrow">Splexanode Share</p><h1 className="mt-4 max-w-xl text-5xl font-bold sm:text-7xl">Send files.<br/>Nothing else.</h1><p className="mt-6 max-w-md text-lg leading-8 text-muted-foreground">No account. No storage plan. Your files exist only long enough to move from here to there.</p>
      <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-border pt-6"><div><dt className="label">Default lifetime</dt><dd className="mt-2 font-mono text-xl">05:00</dd></div><div><dt className="label">Share limit</dt><dd className="mt-2 font-mono text-xl">2 GB</dd></div></dl>
    </div>
    <div>
      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="flex min-h-72 flex-col items-center justify-center border border-dashed border-strong bg-surface px-6 text-center transition-colors hover:border-primary">
        <div className="flex size-12 items-center justify-center border border-border bg-background"><FileUp className="size-5 text-primary" /></div><h2 className="mt-6 text-xl font-semibold">Drop files here</h2><p className="mt-2 text-sm text-muted-foreground">or select up to 10 files from your device</p><Button className="mt-6" onClick={() => inputRef.current?.click()}><Plus/>Select files</Button><input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
      </div>
      {files.length > 0 && <div className="border-x border-b border-border bg-background p-5 sm:p-7">
        <div className="flex items-center justify-between"><p className="label">{files.length} {files.length === 1 ? "file" : "files"}</p><span className="font-mono text-sm">{formatBytes(totalBytes)}</span></div>
        <ul className="mt-4 divide-y divide-border">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-4 py-3"><span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span><span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span><Button variant="ghost" size="icon" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X/></Button></li>)}</ul>
        <details className="mt-5 border-t border-border pt-5"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Transfer options <ChevronDown className="size-4"/></summary><div className="mt-5"><p className="label">Maximum downloaders</p><div className="mt-3 flex flex-wrap gap-2">{([1,5,10,null] as const).map((value) => <Button key={String(value)} variant={maxDownloaders === value ? "default" : "outline"} size="sm" onClick={() => setMaxDownloaders(value)}>{value ?? "Unlimited"}</Button>)}</div></div></details>
        {state === "uploading" && <div className="mt-6 border-t border-border pt-5"><div className="flex justify-between text-sm"><span>Uploading directly to transfer storage</span><span className="font-mono">{Math.round(progress)}%</span></div><Progress className="mt-3" value={progress}/><div className="mt-3 flex justify-between font-mono text-xs text-muted-foreground"><span>Live {formatBytes(rate)}/s</span><span>ETA {formatTime(eta)}</span></div></div>}
        {state === "idle" && <p className="mt-5 text-xs text-muted-foreground">Pre-transfer estimate appears after upload begins; live speed uses measured throughput.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <Button size="lg" className="mt-6 w-full" disabled={state === "uploading" || Boolean(error)} onClick={upload}>{state === "uploading" ? "Moving bytes…" : "Create transfer"}</Button>
      </div>}
      {!files.length && <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><QrCode className="size-4"/>Every completed transfer includes a link, QR code, and four-digit code.</div>}
    </div>
  </section>;
}
