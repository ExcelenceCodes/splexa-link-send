import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link to="/" className={cn("inline-flex items-center gap-2.5 text-foreground", className)} aria-label="Splexanode home">
    <svg viewBox="0 0 100 100" fill="none" className="size-8 text-primary" aria-hidden="true">
      <rect x="7" y="7" width="86" height="86" rx="20" stroke="currentColor" strokeWidth="7" />
      <path d="M30 70 C30 62 38 60 44 60 C52 60 52 52 44 50 C36 48 36 40 44 38 C48 36 52 36 56 36 L64 30" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="70,14 82,24 70,34" fill="currentColor" transform="rotate(-35 76 24)" />
    </svg>
    {!compact && <span className="font-display text-lg font-bold">Splexanode</span>}
  </Link>;
}
