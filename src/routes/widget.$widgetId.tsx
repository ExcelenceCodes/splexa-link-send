import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { completeWidgetTransfer, createWidgetTransfer, getWidgetTransferStatus, openWidgetSession } from "@/lib/widget.functions";

export const Route = createFileRoute("/widget/$widgetId")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ origin: String(search.origin ?? "") }),
  head: () => ({ meta: [{ title: "Splexanode upload" }, { name: "robots", content: "noindex" }] }),
  component: Widget,
});

type Config = { label?: string; hint?: string; theme?: "light" | "dark"; acceptedTypes?: string[]; maxFiles?: number; maxBytes?: number; allowPhoneHandoff?: boolean; showCode?: boolean; accentColor?: string; customCss?: string };
type Handoff = { transferId: string; sessionToken: string; code: string; handoffUrl: string; expiresAt: string };

function emit(type: string, detail: unknown) {
  window.parent?.postMessage({ source: "splexanode", type, detail }, "*");
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let index = -1; let scaled = value;
  while (scaled >= 1024 && index < units.length - 1) { scaled /= 1024; index += 1; }
  return `${scaled.toFixed(1)} ${units[index]}`;
}

function Widget() {
  const { widgetId } = Route.useParams();
  const { origin } = Route.useSearch();
  const openFn = useServerFn(openWidgetSession);
  const createFn = useServerFn(createWidgetTransfer);
  const completeFn = useServerFn(completeWidgetTransfer);
  const statusFn = useServerFn(getWidgetTransferStatus);

  const [session, setSession] = useState<{ session: string; config: Config; appName: string; maxUploadBytes: number } | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "waiting" | "complete">("idle");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [qr, setQr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void openFn({ data: { widgetId, origin } })
      .then((result) => { setSession({ session: result.session, config: result.widget.config as Config, appName: result.application.name, maxUploadBytes: result.maxUploadBytes }); emit("ready", { widgetId }); })
      .catch((cause: Error) => { setError(cause.message); emit("error", { message: cause.message }); });
  }, [widgetId, origin, openFn]);

  const config = session?.config ?? {};
  const style = useMemo(() => ({ "--spx-accent": config.accentColor ?? "#2F86FF" } as React.CSSProperties), [config.accentColor]);

  async function startUpload() {
    if (!session || files.length === 0) return;
    setError(""); setState("uploading"); emit("uploading", { files: files.length });
    try {
      const manifest = await createFn({ data: { widgetId, origin, session: session.session, files: files.map((file) => ({ name: file.name, type: file.type || "application/octet-stream", size: file.size })) } });
      const total = files.reduce((sum, file) => sum + file.size, 0);
      let sent = 0;
      const completions = [];
      for (const [index, upload] of manifest.uploads.entries()) {
        const file = files[index];
        if (!file) throw new Error("File manifest mismatch");
        const parts = [];
        for (const part of upload.parts) {
          const start = (part.partNumber - 1) * upload.partSize;
          const blob = file.slice(start, Math.min(start + upload.partSize, file.size));
          const response = await fetch(part.url, { method: "PUT", body: blob });
          if (!response.ok) throw new Error("Upload failed");
          const etag = response.headers.get("etag");
          if (!etag) throw new Error("Storage CORS must expose the ETag response header");
          parts.push({ partNumber: part.partNumber, etag });
          sent += blob.size;
          setProgress(Math.round((sent / total) * 100));
        }
        completions.push({ fileId: upload.fileId, uploadId: upload.uploadId, parts });
      }
      await completeFn({ data: { transferId: manifest.transferId, sessionToken: manifest.sessionToken, files: completions } });
      setState("complete");
      emit("transfer-complete", { transferId: manifest.transferId, totalBytes: total, files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })) });
    } catch (cause) {
      setState("idle");
      setError((cause as Error).message);
      emit("error", { message: (cause as Error).message });
    }
  }

  async function startHandoff() {
    if (!session) return;
    setError("");
    try {
      const manifest = await createFn({ data: { widgetId, origin, session: session.session, files: [{ name: "from-phone", type: "application/octet-stream", size: 0 }] } });
      setHandoff({ transferId: manifest.transferId, sessionToken: manifest.sessionToken, code: manifest.code, handoffUrl: manifest.handoffUrl, expiresAt: manifest.expiresAt });
      setState("waiting");
      emit("waiting", { code: config.showCode === false ? undefined : manifest.code, handoffUrl: manifest.handoffUrl });
      const qrcode = await import("qrcode");
      setQr(await qrcode.toDataURL(manifest.handoffUrl, { margin: 1, width: 240 }));
    } catch (cause) {
      setError((cause as Error).message);
      emit("error", { message: (cause as Error).message });
    }
  }

  useEffect(() => {
    if (!handoff || state !== "waiting") return;
    const timer = setInterval(() => {
      void statusFn({ data: { transferId: handoff.transferId, sessionToken: handoff.sessionToken } }).then((status) => {
        if (!status) return;
        if (status.status === "active" || status.status === "completed") {
          setState("complete");
          emit("transfer-complete", { transferId: status.transferId, totalBytes: status.totalBytes, files: status.files });
        }
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [handoff, state, statusFn]);

  const dark = config.theme === "dark";

  return <div className={`spx-root ${dark ? "spx-dark" : ""}`} style={style}>
    <style>{`
      .spx-root{font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:16px;background:transparent}
      .spx-modal{width:100%;max-width:460px;background:#fff;color:#0B0F19;border:1px solid #e6e6e6;border-radius:14px;padding:22px}
      .spx-dark .spx-modal{background:#0B0F19;color:#fafaf9;border-color:#23283a}
      .spx-title{font-size:20px;font-weight:700;margin:0}
      .spx-hint{font-size:13px;opacity:.7;margin:6px 0 0}
      .spx-drop{margin-top:18px;border:1px dashed currentColor;opacity:.9;border-radius:12px;padding:26px;text-align:center;cursor:pointer;font-size:14px}
      .spx-btn{margin-top:14px;width:100%;border:0;border-radius:10px;padding:12px;font-size:14px;font-weight:600;color:#fff;background:var(--spx-accent);cursor:pointer}
      .spx-btn[disabled]{opacity:.6;cursor:default}
      .spx-ghost{background:transparent;color:inherit;border:1px solid currentColor}
      .spx-file{display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.25)}
      .spx-bar{height:6px;border-radius:99px;background:rgba(128,128,128,.25);margin-top:14px;overflow:hidden}
      .spx-bar span{display:block;height:100%;background:var(--spx-accent)}
      .spx-code{font-family:ui-monospace,monospace;font-size:30px;letter-spacing:.3em;text-align:center;margin-top:14px}
      .spx-error{color:#c0392b;font-size:13px;margin-top:12px}
      .spx-qr{display:block;margin:14px auto 0;width:200px;height:200px}
    `}</style>
    {config.customCss && <style>{config.customCss}</style>}
    <div className="spx-modal">
      {error && !session && <p className="spx-error">{error}</p>}
      {session && <>
        <h1 className="spx-title">{config.label ?? "Upload files"}</h1>
        <p className="spx-hint">{config.hint || `${session.appName} · up to ${bytes(Math.min(config.maxBytes ?? session.maxUploadBytes, session.maxUploadBytes))}, ${config.maxFiles ?? 5} files`}</p>

        {state === "idle" && <>
          <div className="spx-drop" onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFiles(Array.from(event.dataTransfer.files).slice(0, config.maxFiles ?? 5)); }}>
            Drop files here or click to choose
          </div>
          <input ref={input} type="file" multiple hidden accept={(config.acceptedTypes ?? []).join(",") || undefined} onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, config.maxFiles ?? 5))} />
          {files.map((file) => <div key={file.name} className="spx-file"><span>{file.name}</span><span>{bytes(file.size)}</span></div>)}
          <button className="spx-btn" disabled={files.length === 0} onClick={startUpload}>Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}</button>
          {config.allowPhoneHandoff !== false && <button className="spx-btn spx-ghost" onClick={startHandoff}>Upload from phone</button>}
        </>}

        {state === "uploading" && <>
          <p className="spx-hint">Transferring {progress}% — measured from actual throughput.</p>
          <div className="spx-bar"><span style={{ width: `${progress}%` }} /></div>
        </>}

        {state === "waiting" && handoff && <>
          <p className="spx-hint">Scan with your phone to continue. Waiting for the phone to upload.</p>
          {qr && <img className="spx-qr" src={qr} alt="Scan to upload from your phone" />}
          {config.showCode !== false && <p className="spx-code">{handoff.code}</p>}
          <p className="spx-hint">Expires {new Date(handoff.expiresAt).toLocaleTimeString()}</p>
        </>}

        {state === "complete" && <p className="spx-hint">Transfer complete. You can close this.</p>}
        {error && <p className="spx-error">{error}</p>}
      </>}
    </div>
  </div>;
}
