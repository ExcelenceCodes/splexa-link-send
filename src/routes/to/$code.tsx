import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Smartphone } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { resolveTransferCode } from "@/lib/transfers.functions";

export const Route = createFileRoute("/to/$code")({
  head: () => ({ meta: [{ title: "Open transfer code — Splexanode" }, { name: "description", content: "Open a short-lived Splexanode transfer code from your phone." }, { property: "og:title", content: "Open a Splexanode transfer" }, { property: "og:description", content: "Continue a secure temporary transfer from this device." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: CodeBridge,
});
function CodeBridge() { const { code } = Route.useParams(); const resolve = useServerFn(resolveTransferCode); const navigate = useNavigate(); const [message,setMessage]=useState("Checking this code…");
 useEffect(() => { let nonce=sessionStorage.getItem("splexanode-code-device"); if(!nonce){nonce=crypto.randomUUID()+crypto.randomUUID();sessionStorage.setItem("splexanode-code-device",nonce)} void resolve({data:{code,clientNonce:nonce}}).then((found)=>{if(found) void navigate({to:"/t/$transferId",params:{transferId:found.transferId}});else setMessage("This code is invalid or has expired.")}).catch((e)=>setMessage(e instanceof Error?e.message:"Code lookup failed")); },[code,navigate,resolve]);
 return <main className="flex min-h-screen flex-col bg-ink text-ink-foreground"><div className="p-5"><Logo className="text-ink-foreground"/></div><div className="flex flex-1 items-center justify-center px-5"><div className="w-full max-w-md text-center"><Smartphone className="mx-auto size-8 text-primary"/><p className="eyebrow mt-8 text-ink-muted">Mobile bridge</p><h1 className="mt-4 font-mono text-6xl font-semibold tracking-[0.15em]">{code}</h1><p className="mt-6 text-ink-muted">{message}</p><Button variant="inverse" className="mt-8" asChild><a href="/share">Start another transfer<ArrowRight/></a></Button></div></div></main> }
