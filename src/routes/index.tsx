import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Code2, Smartphone, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Splexanode — Choose your transfer path" },
    { name: "description", content: "Send files instantly, continue a transfer from your phone, or enter the developer platform." },
    { property: "og:title", content: "Splexanode — Move data" },
    { property: "og:description", content: "Fast temporary file sharing and developer transfer infrastructure." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col bg-ink text-ink-foreground">
      <header className="flex h-20 items-center justify-between px-5 lg:px-8"><Logo className="text-ink-foreground"/><Link to="/home" className="text-sm text-ink-muted hover:text-ink-foreground">About Splexanode</Link></header>
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-12 lg:px-8">
        <p className="eyebrow text-ink-muted">Where should the bytes go?</p>
        <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-none sm:text-7xl">Move data.<br/>Choose the shortest path.</h1>
        <div className="mt-14 grid gap-px bg-ink-border md:grid-cols-3">
          <Link to="/share" className="entry-group"><Zap className="size-6 text-primary"/><span className="entry-kicker">Fast transfer</span><strong>Send files now</strong><p>No account. Up to 2 GB. Five-minute default lifetime.</p><ArrowRight className="mt-auto size-5 transition-transform group-hover:translate-x-1"/></Link>
          <Link to="/to/$code" params={{code:"0000"}} className="entry-group"><Smartphone className="size-6 text-primary"/><span className="entry-kicker">Mobile bridge</span><strong>Upload from phone</strong><p>Scan a QR or open a four-digit request from another device.</p><ArrowRight className="mt-auto size-5 transition-transform group-hover:translate-x-1"/></Link>
          <Link to="/sign-in" className="entry-group"><Code2 className="size-6 text-primary"/><span className="entry-kicker">Splexanode Dev</span><strong>Enter platform</strong><p>Configure verified apps, widgets, usage, and billing.</p><ArrowRight className="mt-auto size-5 transition-transform group-hover:translate-x-1"/></Link>
        </div>
      </section>
      <footer className="flex items-center justify-between border-t border-ink-border px-5 py-5 font-mono text-xs text-ink-muted lg:px-8"><span>TRANSFER, NOT STORAGE.</span><Button asChild variant="inverse" size="sm"><Link to="/share">Start moving</Link></Button></footer>
    </main>
  );
}
