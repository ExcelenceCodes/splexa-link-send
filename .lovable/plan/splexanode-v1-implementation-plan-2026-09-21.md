# Splexanode V1 implementation plan

## Product decisions locked in

- Splexanode sells transferred bytes, never storage subscriptions.
- `PLATFORM_MODE` controls sponsored beta versus paid operation without code changes.
- Sponsored beta still records exact billable usage and supports a real Lemon Squeezy settlement path.
- Anonymous Share uploads allow up to 2 GB and 10 files per transfer.
- Developer uploads default to 5 GB and may be configured up to 25 GB; capacity above 5 GB is billed at 50 US cents per extra GB per month.
- A historically verified production domain cannot be attached to a different developer account. The server blocks it outright.
- Uploaded brand assets define the visual system: Splexanode blue, ink, paper, Space Grotesk, Inter, and JetBrains Mono.

## Delivery sequence

### 1. Production foundation and Share

- Establish the brand system, logo/favicon assets, global navigation, public entry chooser, home, products, about, and the first editorial documentation pages.
- Create the database schema, exact integer billing fields, strict access policies, append-only usage events, signed anonymous device sessions, transfer state transitions, replay protection, code-attempt tracking, and idempotency records.
- Add server-only Cloudflare R2 integration for multipart creation, signed part uploads, multipart completion/abort, signed downloads, object verification, and deletion.
- Build `/share` as a real direct-to-R2 flow with drag/select, transfer options, actual measured progress/speed/ETA, completion verification, share URL, QR, four-digit code, countdown, and IndexedDB recovery metadata.
- Build the public download surface and enforce expiry/downloader limits server-side before issuing every download URL.
- Add retry-safe cleanup for expired transfers and abandoned multipart uploads.

### 2. Mobile bridge

- Build `/to/:code` with rate-limited, enumeration-resistant lookup.
- Show verified requesting-app identity and enforced file constraints.
- Upload directly to R2 and stream waiting/uploading/processing/complete/expired/failed state through database realtime.
- Invalidate codes on expiry or terminal completion.

### 3. Developer identity and control plane

- Implement verified email/password authentication, recovery, session invalidation after reset, onboarding, and protected developer pages.
- Build app creation, public/secret credential separation, developer-wide allowance, local development origins, production-domain DNS verification, explicit subdomain allowlists, and permanent domain history.
- Keep platform-admin roles in a separate protected roles table and restrict `/platform` server-side.

### 4. Widget and SDK

- Ship a framework-neutral script embed backed by an isolated iframe.
- Validate origin → application → widget → transfer on the server for every session.
- Support independent widgets under one verified domain and safe status/completion browser events containing metadata only.
- Enforce server-owned upload constraints regardless of visual customization.

### 5. Usage and billing

- Derive all usage, allowance, and debt from immutable usage events with integer arithmetic.
- Apply one shared 5 GB developer allowance, $1 per transferred GB beyond allowance, and 50 cents per extra lifetime minute up to 30 minutes.
- Add the developer capacity rule: first 5 GB included, 50 cents per additional GB per month up to 25 GB.
- Add Lemon Squeezy checkout/webhook settlement, signature verification, idempotent event handling, and ledger reconciliation; sponsored mode records charges without blocking transfers.

### 6. Public content and hardening

- Complete useful docs, integration guides, security explanations, FAQs, per-route metadata, structured data, sitemap, and robots policy.
- Harden tab-close recovery, interrupted multipart uploads, duplicate callbacks, concurrent download claims, expired-mid-upload behavior, origin replay, and double cleanup.
- Validate each phase in desktop and mobile browsers and run database/security checks before marking it complete.

## Technical design

### Data path

```text
Browser ──────────────── presigned request ────────────────> Cloudflare R2
   │                                                              │
   └── metadata/auth/status ─> TanStack server functions ─> Lovable Cloud
```

File bytes never enter the application server or Cloud storage. Security-sensitive values are read only inside server handlers. Missing required production credentials stop the affected operation with an explicit configuration error.

### Core tables

- `transfers`, `transfer_files`, `transfer_download_claims`, `multipart_uploads`
- `anonymous_device_sessions`, `transfer_code_attempts`, `idempotency_keys`
- `applications`, `application_origins`, `domain_registry`, `widgets`
- `usage_events`, `developer_billing`, `billing_ledger`, `payment_events`
- `profiles`, `user_roles`

The schema uses exact byte counts and minor currency units, row-level access rules on every table, explicit grants, append-only accounting, and database functions for atomic state transitions.

### Runtime configuration

Server-only configuration will cover R2 account/bucket/API credentials, device-session signing, cleanup authentication, Lemon Squeezy credentials and webhook signing, billing product identifiers, and `PLATFORM_MODE`. Browser-visible configuration is limited to non-secret public identifiers.

No fake values will be treated as working credentials. The code can include documented variable names and explicit missing-configuration failures; actual R2 and Lemon Squeezy values must be supplied securely before those loops can be verified end to end.

## Acceptance gates

A phase is complete only when its real server, database, and provider loop is exercised successfully. Visual states alone do not count. Phase 1 requires valid R2 credentials and bucket CORS; the paid-mode billing gate requires valid Lemon Squeezy API, store, product/variant, and webhook credentials.
