import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "./ui/button";

export function SiteHeader() {
  return <header className="border-b border-border bg-background/95">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Logo />
      <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="Primary">
        <Link to="/products" activeProps={{ className: "text-primary" }}>Products</Link>
        <Link to="/docs" activeProps={{ className: "text-primary" }}>Docs</Link>
        <Link to="/about" activeProps={{ className: "text-primary" }}>About</Link>
        <Link to="/sign-in" className="text-muted-foreground">Developer sign in</Link>
        <Button asChild size="sm"><Link to="/share">Send files</Link></Button>
      </nav>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation"><Menu /></Button>
    </div>
  </header>;
}
