# AGENTS.md - The Q
Dynamic QR code platform. Next.js 15 + Firebase + Vercel Pro.
## Environments & Deployment

| | Branch | Firebase Project | Vercel |
|---|--------|-----------------|--------|
| **Production** | `main` | `qrinfo-905c9` | `qr.playzones.app` |
| **Development** | `dev` | `qrinfo-dev` | Preview deployment |

- Both Firebase projects should mirror each other (indexes, rules, structure)
- **"push to main"** = production release → bump version in `src/lib/version.ts` + `package.json`, add changelog entry
- Vercel production is `qrinfo`; duplicate `qr` was disconnected from Git on 2026-09-20 (no successful deployments).
- **"push to dev"** / **"deploy to dev"** = testing only, no version bump needed
- Firestore indexes/rules: deploy to both projects. CLI: `firebase deploy --only firestore:indexes --project <id>`

## Critical Patterns (MUST follow)

### Firebase: Client vs Server split
- **Client SDK** (`src/lib/firebase.ts`) - reads + candidate self-registration only
- **Admin SDK** (`src/lib/firebase-admin.ts`) - all secure writes (votes, verification, rate limits)
- `getAdminAuth()` is in `src/lib/auth.ts`, NOT in firebase-admin.ts

### Auth pattern for admin API routes
```typescript
import { requireCodeOwner, isAuthError } from '@/lib/auth';
const auth = await requireCodeOwner(request, codeId);
if (isAuthError(auth)) return auth.response;
```

### Auth pattern for client dashboard calls
```typescript
import { fetchWithAuth } from '@/lib/fetchWithAuth';
const res = await fetchWithAuth('/api/some-endpoint?codeId=xxx');
```

### Locked collections (ALL client writes = `if false`, Admin SDK only)
`votes`, `verifiedVoters`, `verificationCodes`, `rateLimits`, `qtagGuests`, `qtagStats`, `cellRegistrations` (delete)

### Phone numbers
Always `normalizePhoneNumber()` → `+972...` before storage. Mask with `maskPhoneNumber()` in API responses.

### Security
- QR tokens: `crypto.randomBytes(16)` - NEVER `Date.now() + Math.random()`
- Rate limiting: in-memory (`src/lib/rateLimit.ts`) resets per serverless instance. Use Firestore-based for critical paths.
- WhatsApp/SMS API available via `src/lib/inforu.ts` (INFORU provider). Used for OTP verification and Q.Tag QR delivery.
- Q.Tag WhatsApp QR: `src/lib/qtag-whatsapp.ts` sends entry QR link after registration. Template: `qtag_registration` (UTILITY). Cross-device: `/v/{shortId}?token={qrToken}`.
- Email notifications via `src/lib/resend.ts` (Resend Pro). Sends from `notifications@playzone.co.il`. New user registration triggers email to `info@playzone.co.il` via `/api/notify/new-user`.

### Backup & Disaster Recovery (Production - `qrinfo-905c9`)
- **PITR** enabled (7-day point-in-time recovery, restore to any minute)
- **Scheduled backups**: daily (7d retention) + weekly on Sunday (14w retention)
- **Database delete protection** enabled (prevents accidental DB deletion)
- Manage via REST API (no gcloud CLI installed): use Firebase refresh token from `~/.config/configstore/firebase-tools.json`
- Verify: `GET https://firestore.googleapis.com/v1/projects/qrinfo-905c9/databases/(default)/backupSchedules`

## Routing rules
- `/v/`, `/gallery/`, `/lobby/`, `/packs/` - public, NO locale prefix (excluded from i18n middleware)
- Everything else under `[locale]/` (he/en). Hebrew = RTL.
- API routes: admin-only endpoints need Bearer token + ownership. Public endpoints need rate limiting + origin validation.

## Conventions
- ES imports only, no `require()` (ESLint enforced)
- `@/*` → `./src/*`
- Dark mode: `dark` class on `<html>`
- Media uploads: route writes/deletes through `src/lib/media-storage.ts`; only that adapter imports `@vercel/blob`. `MEDIA_STORAGE_PROVIDER=cloudflare-r2` sends new uploads to R2 while legacy Blob read/delete stays supported. Preserve `storageProvider/storageKey/storageBucket/contentType` metadata and user quota sizes.
- Firestore: `serverTimestamp()` for doc create, `Timestamp.now()` for nested objects
- i18n: `useTranslations()` from next-intl. Both `en.json` and `he.json` must be updated together.
## Gotchas
- `node_modules 2` dir appears randomly - delete it, causes build failures
- Firebase CLI `deploy --only firestore:indexes` silently skips indexes - always verify in Console
- `jsdom` and `xlsx` in `serverExternalPackages` (next.config.ts) - `jsdom` needed for isomorphic-dompurify. `xlsx` kept but Excel export moved client-side.
- Q.Tag WhatsApp templates: `src/lib/qtag-whatsapp.ts` sends QR links via INFORU after registration/verification
## Lessons Learned
- Dashboard folder state stays in the locale-preserving URL; filter selection is user-scoped in sessionStorage and hero dismissal persists in localStorage. Editor back uses code.folderId; super admins must load all folders, including customer-owned folders.
- Content intake expansion: future user-owned customer/folder automations and super-admin setup on behalf of users are specified in `docs/CONTENT_INTAKE.md`; currently only the explicit Fattal workflow is shipped. Oct 1 semantic intake proposal: `docs/WHATSAPP_SEMANTIC_INTAKE_PLAN.md` (not implemented). Screenshot-name replay matched 5/6 locally; verify actual scan/period/receipts before attributing missing targets to aliases. AI needs verified message/PDF evidence; preserve strict download identity, cycle-scoped no-file declarations and confirmed server outcomes. Oct 1 user reports remaining booklets updated manually; exact cutoff and live content unverified, so do not infer a cycle reset or replay old PDFs. Oct 1 review confirms only 5 collected/matched/updated files, empty sender IDs and missing reply links; diagnose collection before blaming aliases or adding AI. Evidence and diagnostic gaps are recorded in the semantic plan. Download label and URLs derive from the agent package version via `agent-release.ts`; never hardcode versions in translations. Agent 0.9.4 adds semantic document-card reading with strict preview/download identity, content-aware latest-boundary checks and bounded all-row diagnostics; live Michal acceptance remains required. Agent 0.9.5 scans viewport-intersecting messages and waits for visible shells to hydrate; never let offscreen empty data-id wrappers overwrite observations or prove the history boundary. Latest-boundary changes remain blocking and export differences. 0.9.6 may recover a saved receipt date only for a live same-ID/group-key/exact-name PDF after a fresh download matches its saved SHA-256; never infer from filename or adjacent messages. Export date provenance and raw date inputs. Oct 4 review 6 confirms 0.9.6 completed 11 server PDF updates and sent the current group/email reports; U Splash alone was not collected. Native RUN_LOCKED alerts can persist after completion because refresh updates snapshot but not local error; do not treat this stale banner as a failed commit or clear a real process lock. Oct 4 13:53 read-only production check confirms Michal 0.9.6 ready, scheduleEnabled/autoCommit true and heartbeat 13:51. 14:00 execution still needs its own receipt. Replaying old plus new same-target PDFs confirms identical hashes remain matched, while different hashes both become duplicate; a later timestamp alone does not select a replacement. Oct 4 dots evaluation is a proposal only: official docs support cloud browser/schedules, but existing WhatsApp group/PDF/reply access and unattended reliability remain unverified. Pilot read-only first; retain server receipts/dedupe and a single authorized writer; do not migrate or disable the live agent based on cloud availability alone. User requested a cloud-only business-QR pilot with proactive disconnect alerts. Dot model switching is not documented (Astra-powered); setup/check schedule details are in the semantic plan. User reports starting a Dot on Oct 4; its connection, saved monitoring schedule and read-only results have not been independently verified. Oct 4 correction patch is LOCAL, not released: verified-preview uses owner-scoped server receipts plus the current PDF URL to allow one later same-name/dated revision; baseline URL is rechecked in the replacement transaction. See semantic plan for tests, Dot interpretation rules and same-day checkpoint retry limitation. Oct 4 19:08 Israel read-only production check: Michal heartbeat 19:07, 0.9.6, scheduleEnabled/autoCommit true, review_required since 14:07; default-v1 Sun/Thu 10:05/12:00/14:00. Thursday Oct 8 is scheduled, not a verified future success. Keep one authorized writer during handover; Oct 8 user rejects Michal Mac as the long-term executor and reports no reliable autonomous success. Oct 8 user reports WhatsApp logout/device-slot pressure and Geva manual update; do not replay or infer a cycle cutoff. Verified gap: heartbeat is not WhatsApp health; no 08:00 probe or independent intake watchdog exists. User now wants Sun/Thu 08:00 readiness plus 10/12/14 runs, not hourly checks. See semantic plan for single-writer cloud handover and disconnect/missing-run alert acceptance; not implemented. Oct 8 official docs confirm Grok Bot also has a persistent cloud computer and routines; neither provider has proven this WhatsApp group workflow or lower cost. Recommend completing the existing Dot cloud pilot with scoped The Q tools and independent monitoring. User also wants context-aware group replies; real-time WhatsApp event delivery is unverified and requires an explicit trigger/polling design, not only three daily scans. Portable human/agent operating instructions are now in `docs/FATTAL_CLOUD_AGENT_PLAYBOOK_HE.md` (v1.2, cloud setup still planning): prefer a restricted API connector over website admin credentials; keep secrets separate from the MD, verify cloud receipt of revisions, preserve cloud browser state, and test phone-based reconnection. It covers aliases, dates, reply evidence, revisions, manual updates, incident recovery and acceptance cases. Oct 8 offline security review found retained-PDF quota undercount (medium) and missing reciprocal agent/connection binding (low, same-owner). Oct 8 user chose deletion after successful replacement, no archive. Local ordinary-PDF fix removes retention flags, charges full new bytes until deletion, and persists cleanup debt; not deployed, no historical cleanup or automatic cleanup worker. Agent binding remains unpatched. Existing keys are long-lived writers, not read-only; implement expiry/action scopes, correct charged cleanup and server-enforced tools before cloud writes. WhatsApp browser access is account-wide; MD rules are not isolation. No key, cloud upload, schedule or watcher was activated.
- Fattal intake: explicit targets only (`src/lib/content-intake/fattal.ts`) for the configured owner (`biduratias@gmail.com` confirmed Sep 20); R2 PDF updates and server-side Resend reports. Runner requires `--dir`, reads `.env.fattal` or explicit `--env-file`, and checks `batchProtocolVersion` before committing. Split uploads share a saved preview; `/fattal/report` finalizes one server-derived report. Never retry uncertain writes automatically. Status emails use the registered computer name and plain outcome/action; no_files is informational. Snapshot authenticated computerName on runs; never infer a machine for legacy reports. Intake email rows must pair actual experience title + exact filename with the stored replacement time in Israel timezone; duplicates retain their original timestamp (see `docs/CONTENT_INTAKE.md`).
- Fattal WhatsApp: `tools/whatsapp-intake` uses a separate business Chromium profile on both Macs; never reuse personal/native sessions. Installed pilot lives under `~/Library/Application Support/TheQContentIntake`, browser cache outside Documents. Owner confirmed unqualified Herods, Leonardo Plaza, Leonardo Club and Royal mean Eilat (reconfirmed Sep 23); explicit areas always override. Sep 20 pilot updated and hash-verified 10 real PDFs; explicit group reporting uses a durable outbox, with quiet followups on editable weekly slots (default 12:00/14:00); enable scheduling only after live commit/report verification. Owner clarified as biduratias@gmail.com; verify live health before writes. Dashboard and management APIs are super-admin-only; /content-intake issues hashed, revocable owner-scoped keys; never bundle connection files. Use headless shell with compatible UA (full Chromium headless PDF save crashed); verify UI date order (current MDY), group header and history boundary; sent-text comparison must preserve emoji image alt text. Transfer only packaged source, never profiles/keys. Runner 0.6.0 syncs schedules/heartbeats every 5 minutes; fresh installs use UUIDs and bind one key per machine. Super admins can disconnect/reallow computers; never restore revoked keys. Calendar groups must preserve distinct day schedules; edits apply to future slots. General workflow copy must distinguish the currently supported Fattal PDF scope from future self-service connections. Native SwiftUI setup auto-installs a pinned verified runtime; PDFs remain in the displayed downloads directory. Distribution is ad-hoc signed pending Apple notarization. 0.9.1 adds explicit audited manual-completion cutoff for scans and slot catchup (preserve evidence, no pending writes), and verified per-user caffeinate -i while enabled; pause removes helper, login required after reboot. Never infer manual completion or suppress newer missing-message errors. Runner 0.7.2 verifies latest/history overlap and fails when known in-window messages vanish; never restore unseen cached files. 0.7.1 hides stale previews and exports scan/protocol/hash provenance; attachment names can be unquoted sibling labels without titles. 0.7.0 adds partial commits, same-target byte dedupe and per-message manual assignment; Michal reply-DOM verification is still pending. Quote thumbnails must not become attachments; only explicit reply identity plus matching sender is usable. Preserve full batch ambiguity and pending uncertain writes. See CONTENT_INTAKE.md for setup rules; 0.8.0 separates confirmed data from durable report delivery, adds owner-scoped GET recovery and native Update Now/recovery controls; never clear pending without full server results. New group text must not expose agent UI/IDs; 0.8.1 preserves legacy outbox text for reconciliation only, never resend. 0.8.2 scans visible message ancestors with bounded layout wait, exports layout metrics, and shows app/runtime versions; verify pending recovery separately from preview. 0.9.0 adds guided native steps/fixed footer/Settings; excludes quoted IDs and retries incomplete reads once, never writes. Persist missing-message diagnostics; do not drop unseen cache records to bypass safety. 0.9.2 verifies complete preview/download names after whitespace/bidi/NFC normalization and bounded label wait, excludes quoted IDs/thumbs, and exports scan.attachment failure evidence. Never use substring or fuzzy checks for download identity; Michal live verification remains required. AI-assisted target matching is proposed, not shipped; file-local collection failures need isolation without bypassing history completeness or same-target conflicts. 0.9.3 adds explicit same-account reconnection audit and guided confirmation: preserve cycle.at/cache/receipts; pause required and uncertain writes or changed owner/group/integration remain blocked. Reconnection does not declare manual completion. docs/WHATSAPP_RELIABILITY_PLAN.md tracks remaining limits.
- Excel export: ALWAYS generate xlsx **client-side** (`XLSX.writeFile()` in browser), NEVER server-side in API routes. The `xlsx` package is unreliable on Vercel serverless even with `serverExternalPackages`. Pattern: build rows from state → `XLSX.utils.json_to_sheet()` → `XLSX.writeFile()`. See `QVoteVotersModal.tsx` and `QTagGuestsModal.tsx` for reference.
- Quick-add modal must use `fixed` positioning (not `absolute`) to work across scanner/list view modes
- Scanner PIN gate: check `pinUnlocked` before initializing camera to avoid wasted camera starts
- INFORU template example field has char limit - short examples (e.g. `jnCSYdJ?token=A`) are fine for Meta review
- Desktop scanner: use `matchMedia('(min-width: 1024px)')` to detect wide screen and always init camera in split view
- Vercel Pro body size limit is 4.5MB - large image uploads (>3MB) MUST use client-side `compressImage()` before sending to `/api/upload`
- New i18n keys for MediaUploader tabs (tooltip/description/create) must be added to both locale files or console warns MISSING_MESSAGE
- Firestore transactions: ALL reads (`transaction.get()`) MUST happen before ANY writes (`transaction.update/set/delete`) - even with Admin SDK. Use `Promise.all` to batch reads upfront.
- Q.Tag registration with verification: guest record is created ONLY after OTP verification (not on form submit). Pending data stored in `verificationCodes` doc's `pendingRegistration` field.
- Never return `details: String(error)` in API responses — leaks internal stack traces. Log server-side only.
- INFORU WhatsApp URL buttons: must be in separate `Buttons` array with `FieldName` matching button label, NOT in `TemplateParameters`. Error -2505 = missing buttons.
- Vercel serverless: never use fire-and-forget (`.catch()` without `await`). Function terminates after response, killing background ops. Always `await` inside try-catch.
- `fetchWithAuth` must use `onAuthStateChanged` (not `auth.currentUser` directly) — on mobile, Firebase Auth init is slow and `currentUser` is null during early interactions.
- Mobile scanner UX: always `window.scrollTo({ top: 0 })` when switching view modes or opening modals — prevents user seeing a confusing mid-scroll position.
- Q.Tag modal exists on BOTH `dashboard/page.tsx` AND `code/[id]/page.tsx` — each has its own save handler. Fixes must be applied to BOTH files.
- Canvas `toBlob('image/webp', quality)` at quality < 1.0 destroys alpha. For transparent images, use PNG format. `compressImage({ preserveAlpha: true })` handles this.
- `refreshUser()` creates a new user object reference → triggers `useEffect([user])` → resets page state. Don't call after modal saves.
- Q.Vote tablet/kiosk mode: vote API MUST skip fingerprint dedup when `tabletMode.enabled` (same device = same fingerprint). Client `resetForNextVoter` MUST regenerate `visitorId` in localStorage (prevents vote doc ID collisions). ALL success paths in `submitVoteWithCredentials` MUST call `setSubmitting(false)` before starting the tablet countdown.
- WhatsApp in-app browser (SFSafariViewController on iOS): has isolated localStorage — `visitorId` and player sessions are lost. Detect with `isInAppBrowser()` in `QGamesRegistration.tsx` and show "Open in browser" banner. iOS detection: `!('safari' in window)` on iOS UA.
- Satori (next/og `ImageResponse`) does NOT support RTL Hebrew text — renders chars in reverse. Avoid Hebrew text in OG images; use logos instead.
**Codex: update this file at the end of every significant conversation. Keep it under 100 lines. Add to Lessons Learned. Remove anything outdated. If a section grows too large, it means it should be a code comment instead. When pushing to main, bump version + add changelog entry.**
