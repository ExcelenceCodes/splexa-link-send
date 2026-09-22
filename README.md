# Splexanode Flow

SPLEXANODE V1 — LOVABLE BUILD PROMPT

Build Splexanode, a production-grade data-transfer infrastructure product — not a mockup. Core law:

Splexanode does not sell storage. It sells the movement of data. Users are charged for actual bytes transferred, not subscriptions.

Two products: Splexanode Share (accountless file sharing for anyone) and Splexanode Dev (developer infrastructure for receiving files inside third-party apps).

Design tone: premium infrastructure company + radically simple consumer product. Strong typography, generous whitespace, restrained UI, editorial confidence (think a cleaner Dictionary.com layout philosophy — not its branding). No gradients-everywhere, no emoji UI, no generic SaaS-template look, no card clutter.

1. STACK (Lovable-native, confirmed)

Lovable's default project template (since May 13 2026) is TanStack Start — SSR React with isomorphic routes and createServerFn as the server/client boundary. Use it exactly as originally specified:

Frontend: TanStack Start + React + TypeScript + Tailwind + shadcn/ui. Public marketing/docs routes should qualify for TanStack Start's automatic prerender (flat HTML, no per-request server execution) since they don't depend on per-request data.

Server logic: createServerFn for every security-sensitive operation — signing R2 URLs, verifying origins, enforcing quotas, computing billing, 4-digit code lookups, DNS domain verification. Nothing security-sensitive ever runs client-side.

Control-plane/DB: Supabase — Postgres, Auth, RLS. Supabase is the source of truth for accounts, metadata, usage, and billing.

Object storage: Cloudflare R2, accessed only via presigned URLs issued from a server function. Never store transfer file bytes in Supabase Storage, and never proxy file bytes through the TanStack server.

Data path: Browser ⇄ R2 (bytes) | Browser ⇄ createServerFn ⇄ Supabase (auth, metadata, authorization, billing).

No deviation from the original architecture is needed — this is a native Lovable build.

2. HARD RULES (apply everywhere)

Server is authoritative for: price, usage/bytes, expiry, downloader counts, ownership, origin, app ID, billing debt. Never trust client values for these.

No fake behavior: no mock uploads, no fake progress bars, no placeholder "success" states unless the R2 object truly exists.

No subscriptions. No new backend framework, no second database, no Supabase-Storage-for-files.

All secrets (R2 keys, service role, AI keys) live server-side only. Configure them as real, populated .env variables in the project (not a .env.example placeholder file) — the app must run against actual working credentials, split into PUBLIC_* (client-safe, exposed to the browser bundle) and server-only secrets (read only inside createServerFn). Fail loudly at startup if a required variable is missing — never silently degrade to insecure behavior.

Integer/exact arithmetic only for bytes and money (store money in minor units, e.g. cents-equivalent). No floats for billing.

Every destructive/critical operation (cleanup, expiry, billing) must be idempotent and retry-safe.

3. DATA MODEL (Supabase/Postgres, RLS on every table)

transfers: id, owner_type(anon|app), owner_id, files jsonb (r2 object keys + metadata), total_bytes, created_at, expires_at, max_downloaders, successful_downloads, status(waiting|active|expired|completed|failed), code (4-digit, hashed/rate-limited lookup).

applications: id, developer_id, name, public_key, secret_key(hash), production_domain, domain_status(pending|verified|failed|revoked), dev_origins jsonb.

domain_registry (permanent, decoupled from developer/application lifecycle — see §5D2): domain (unique, normalized/lowercased), first_verified_at, verifying_developer_id (nullable after account deletion), verification_token_hash, status(verified|released_blocked). Rows are never hard-deleted when a developer or application is deleted — see quota-abuse rule below.

widgets: id, application_id, public_widget_id, config jsonb (accept types, max size, file count, theme, phone-upload/QR/code toggles), created_at.

usage_events: id, application_id, transfer_id, bytes, event_type, created_at — append-only, source of truth for billing.

developer_billing: developer_id, free_allowance_bytes (default = 5GB), consumed_bytes, debt_minor_units — derived/recomputed from usage_events, never edited directly by clients.

device_sessions (anon users): signed local identifier only (no file contents) mapping a browser to its active transfer IDs, for refresh-recovery on /share.

4. ROUTES

Public:      /  /home  /products  /about  /docs  /docs/:slug
Anon user:   /share
Mobile:      /to/:code
Auth:        /sign-up /sign-in /verify-email /onboarding /logout /forgot-password /reset-password
Developer:   /apps  /app/:uuid  /sharepage  /usage  /billing  /settings  /analytics
Admin:       /platform   (minimal, restricted to platform admins)


/ = entry chooser (Fast Transfer / Upload from mobile / Enter platform). Primary CTA on /home → /share.

5. CORE FLOWS

A. Share flow (/share, accountless) Select/drag files → optional Transfer Options (max downloaders: 1/5/10/Unlimited) → upload directly to R2 via presigned multipart URLs → result card with share link, QR, 4-digit code, live countdown (default lifetime 5 min). Termination = expires_at reached OR successful_downloads >= max_downloaders, whichever first → server function invalidates access, deletes R2 objects, marks transfer expired. Not just UI-hidden — actually revoked. Live transfer telemetry: real-time speed, rolling average, % complete, smoothed ETA — computed from actual measured throughput, never a fake static number. Clearly label pre-transfer estimates vs. live-measured speed. Refresh recovery via the signed device-session identifier (IndexedDB/local persistence, not localStorage for large state, no file bytes stored).

B. Mobile bridge (/to/:code) Shows requesting app identity + what's expected (file type, size limit, count) → user uploads from phone → states: waiting → uploading → processing → complete/expired/failed → requesting app receives live status updates (no polling if avoidable — use Supabase Realtime). 4-digit codes: short-lived, single-transfer-scoped, rate-limited against brute force, invalidated on expiry/completion.

C. Developer onboarding & account recovery /sign-up → /verify-email → /onboarding → /apps → /app/:uuid. Supabase Auth, email verification required. /forgot-password: email entry → Supabase Auth sends a signed, short-lived reset link (never reveal whether an email exists — same response either way). /reset-password: consumes the reset token server-side, enforces a password policy, invalidates the token and all other active sessions after a successful reset.

D. Origin/domain binding model — read carefully, this replaces any "simple allowed-origins list" assumption:

One application (one API key) = one verified production domain, but that single app can power unlimited independently-configured widgets under that domain. Never require a new app per upload field.

Production domain verification via DNS TXT record (_splexanode.<domain> → verification token), checked server-side by a server function/cron. States: pending / verified / failed / revoked. Never trust a typed-in domain without DNS proof.

Local development origins (localhost:*, 127.0.0.1:*) are registered separately, explicitly flagged as dev, rate/quota-limited, and can never become or bypass production verification.

Optional explicit subdomain allowlist (e.g. app.example.com) — never silently assume all subdomains are trusted.

Every widget request is checked server-side: verified origin → application → widget config → transfer session. The browser-supplied origin/app ID is never trusted alone.

Public widget/app identifiers (safe to embed in browser) are distinct from secret server credentials — a leaked public ID must not grant billing or admin access.

D2. Domain permanence — anti quota-abuse rule (critical, do not skip): A verified production domain is recorded permanently in domain_registry, independent of the developer account or application that verified it. When a developer deletes their account, or deletes/transfers the application that owned the domain, the domain_registry row must persist — it is never deleted, only unlinked (verifying_developer_id set to null, status kept as verified or moved to released_blocked per policy). Before granting a new free allowance or accepting a new domain verification, the server function must check domain_registry first: if the domain has already been verified by any account historically, it cannot be used to spin up a fresh developer account/application purely to re-claim a new 5 GB free allowance. Re-attaching a previously-verified domain to a new developer account is either blocked outright or requires manual/flagged review — this must be an explicit, server-enforced policy decision in the Edge/server function, not left implicit. This closes the loop where deleting-and-recreating an account with the same domain would otherwise reset billing quota.

E. Widget/SDK Framework-agnostic embed (<script> + small config object or data-splexanode-widget attribute), iframe-isolated core so it works with any stack. Emits splexanode:transfer-complete (and waiting/uploading/error) events with safe metadata only. Customizable: theme, labels, accepted types, size/file limits, QR/code visibility, language — customization must not be able to alter security-sensitive config.

F. Usage & billing /usage: bytes uploaded/downloaded, transfer count, allowance remaining, current debt — all derived from usage_events. /billing: free allowance 5 GB (shared across all of a developer's apps/widgets — never multiplied per app), rate $1/GB after allowance, extended transfer lifetime up to 30 min (base 5 min) billed at $0.50/extra minute, computed server-side only. No fake "payment integrated" UI if it isn't — track debt accurately and leave settlement pluggable.

6. SECURITY CHECKLIST (enforced inside createServerFn boundaries only)

Signed short-lived R2 upload/download URLs · transfer ownership checks · 4-digit code brute-force/rate limiting · request & MIME/size validation · origin verification (per §5D) · RLS on every table · CSRF/XSS mitigations · secure headers · secret isolation · replay protection · enumeration resistance · abuse throttling · idempotent cleanup jobs for expired/abandoned multipart uploads.

7. AI (V1, non-security-sensitive only)

Use AI for: docs/answer assistant, SDK/widget configuration help, natural-language error explanations, troubleshooting guidance. AI must never decide authorization, billing, ownership, deletion, or security policy — those stay deterministic. AI provider/model/key comes from server config, swappable without code changes.

8. SEO / PUBLIC CONTENT

Public routes (/, /home, /products, /about, /docs*) must be crawlable/SSR-friendly within Lovable's rendering model: semantic HTML, unique titles/descriptions, canonical URLs, Open Graph + Twitter cards, schema.org where relevant, sitemap.xml, robots.txt, strong heading hierarchy, real editorial content (how-it-works, security docs, integration guides, FAQs) around: temporary file sharing, developer file upload, upload-from-phone, QR transfer, resumable uploads, R2-backed transfer, direct-to-cloud upload. Genuinely useful writing, not keyword stuffing. Authenticated app can remain a full SPA.

9. BUILD ORDER (do not skip ahead — each phase must be a real working loop before the next)

/share: select files → create transfer → presigned R2 upload → link + QR + 4-digit code → real expiry/deletion enforcement.

/to/:code: mobile upload → live status → completion, with rate-limited code lookup.

Developer auth → onboarding → app creation → domain DNS verification → dev origins.

Widget/SDK: origin-verified embed → mobile bridge handoff → completion event → file handoff to developer app.

Usage accounting: 5GB allowance, byte-accurate tracking, debt calculation, lifetime-extension billing.

Polish: docs content, SEO, analytics, /platform (minimal), edge-case hardening (tab close, network loss, duplicate webhooks, double cleanup runs, expired-mid-upload).

Do not mark a phase complete until the underlying R2/Supabase flow actually works end-to-end — no visual-only "done."  the typography and brand settings read from uploaded files, and from them make site brand and brand assets. end to end, for any clarifications just ask, as well as you are free to put place holders in .env so as I can add the missing next time
