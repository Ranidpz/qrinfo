# Content Intake

Content Intake is the generic layer for automated customer file updates.
The first workflow is `fattal-booklets`: PDF entertainment booklets are matched to existing QR codes before any media is replaced.

For current R2 storage behavior, dashboard badges, and metadata backfill rules, read `docs/R2_STORAGE.md` first.

## Naming Model

- Product feature: Auto Content Updates / Content Intake
- Source connector: WhatsApp, Email, Drive, Manual Upload, API
- Customer workflow: Fattal Booklets

Keep source connectors separate from workflow rules. WhatsApp downloads files; the Fattal workflow decides which hotel QR code each PDF belongs to.

## Preview Endpoint

`POST /api/content-intake/fattal/preview`

This endpoint does not upload files, delete files, or replace QR media. With `saveRun: false` it also does not create a run log. It:

- authenticates a super admin or server integration key
- loads only the explicit Fattal booklet target list for the selected owner
- matches incoming PDF filenames to QR code targets
- returns matched / missing / duplicate / needs-review status
- returns a Hebrew WhatsApp reply draft for after the real commit step

## Authentication

Use one of:

- Firebase Bearer token for a `super_admin`
- `x-content-intake-key: <CONTENT_INTAKE_API_KEY>`

For an automated agent, set:

- `CONTENT_INTAKE_API_KEY`
- `FATTAL_BOOKLETS_OWNER_ID` or `FATTAL_BOOKLETS_OWNER_EMAIL`

## Request Example

```json
{
  "ownerEmail": "playzonest1@gmail.com",
  "receivedAt": "2026-05-24T08:10:00+03:00",
  "files": [
    {
      "name": "לאונרדו קלאב אילת אמצש 24.05.2026.pdf",
      "contentType": "application/pdf",
      "size": 697000,
      "source": "whatsapp",
      "receivedAt": "2026-05-24T08:07:00+03:00"
    }
  ]
}
```

## Response Shape

The response includes `batchProtocolVersion: 1` and:

- `commitReady`: `true` only when every file is confidently matched and no target is missing
- `summary`: counters for matched, needs-review, duplicate, unmatched, and missing targets
- `matches`: per-file confidence, target, reasons, warnings, and detected date
- `missingTargets`: QR codes in the target folders that did not receive a matching file
- `suggestedReplyAfterCommitHe`: draft text for the WhatsApp group after the real update step

## Batch Commit Endpoint

`POST /api/content-intake/fattal/commit`

This endpoint is the manual / connector-safe commit path for a full WhatsApp batch. It rebuilds the preview from the uploaded files, replaces only confidently matched targets, skips ambiguous files, records a run log, and returns the final Hebrew WhatsApp reply.

It supports:

- `multipart/form-data` with one or more `files` / `file` PDF fields
- JSON files with `sourceUrl` for a future connector that stores temporary download URLs

The run is stored in:

- `contentIntakeRuns`: batch status, preview, commit results, suggested reply, parent `batchPreviewRunId`, report email outcome
- `contentIntakeFileUpdates`: per-file dedupe records by target + PDF hash/source message

The Fattal workflow must not scan every QR code owned by `playzonest1@gmail.com`. It uses the explicit target mapping in `src/lib/content-intake/fattal.ts` so other experiences managed by the same user are ignored.

### Multipart Request

```text
files=<PDF file>
files=<PDF file>
ownerEmail=playzonest1@gmail.com
receivedAt=2026-05-24T08:10:00+03:00
source=manual
```

### JSON Request

```json
{
  "ownerEmail": "playzonest1@gmail.com",
  "receivedAt": "2026-05-24T08:10:00+03:00",
  "source": "whatsapp",
  "files": [
    {
      "name": "לאונרדו קלאב אילת אמצש 24.05.2026.pdf",
      "sourceUrl": "https://example.com/temp/leonardo-club.pdf",
      "sourceMessageId": "msg-123"
    }
  ]
}
```

### Batch Commit Behavior

- `matched`: replaces the QR PDF through the R2 storage path and records the update
- `needs_review`, `duplicate`, `unmatched`: skipped, not overwritten
- exact same PDF for the same QR target: skipped as `skipped_duplicate`
- missing target PDFs: reported in `missingTargets` and in `suggestedReplyAfterCommitHe`
- Vercel request bodies are limited; `scripts/fattal-intake.mjs` first tries a batch commit and falls back to one-file commit requests on `413 FUNCTION_PAYLOAD_TOO_LARGE`.
- R2 metadata must stay ASCII-safe; local intake file ids are hash-based and must not include Hebrew filenames.

## Single PDF Commit Endpoint

`POST /api/codes/{codeId}/pdf`

This endpoint replaces the PDF media on one existing QR code, uploads the new PDF to Cloudflare R2 under:

```text
{ownerId}/{codeId}/booklets/{unique-pdf-name}.pdf
```

It updates the QR media with Admin SDK, stores `storageProvider`, `storageKey`, `storageBucket`, `contentType`, `pageCount`, and adjusts the owner `storageUsed` counter by the size delta. If Firestore update fails, the newly uploaded R2 object is deleted.

Use one of:

- Firebase Bearer token for the code owner / `super_admin`
- `x-content-intake-key: <CONTENT_INTAKE_API_KEY>` for Fattal owner only

### Multipart Request

```text
file=<PDF file>
filename=leonardo-club-eilat-2026-05-24.pdf
source=whatsapp
sourceFileId=<provider-file-id>
sourceMessageId=<provider-message-id>
detectedDate=2026-05-24
```

### JSON Request

Use this when the agent has a temporary download URL and the PDF may be too large for normal browser upload limits:

```json
{
  "sourceUrl": "https://example.com/file.pdf",
  "filename": "leonardo-club-eilat-2026-05-24.pdf",
  "source": "whatsapp",
  "sourceFileId": "abc",
  "sourceMessageId": "msg-123",
  "detectedDate": "2026-05-24"
}
```

### Low-Level Commit Flow

1. Call preview with all received PDF names.
2. Prefer `POST /api/content-intake/fattal/commit` for the whole batch.
3. Use `POST /api/codes/{codeId}/pdf` only for one-off manual repair.

## Historical Migration Notes

- Existing Fattal PDFs were copied to R2 without deleting old Blob objects. If rerunning `POST /api/content-intake/fattal/migrate-existing`, keep `dryRun: true` first and only use `deleteOld: true` after viewer checks pass.
- Backfill Firestore storage metadata for records whose URL already points to R2 but whose `storageProvider` is missing. This is metadata-only and must not change file URLs, file sizes, `storageUsed`, or delete old Blob objects.
- Move the remaining media upload families (images, gallery, avatars, Q.Vote) to the same storage adapter after PDF rollout is stable.
- Keep Vercel Blob delete/read support until legacy Blob media has either been migrated or intentionally left in place.


## Runner and batch reporting (September 2026)

The runner and API must be deployed as a compatible pair. The runner checks
`batchProtocolVersion: 1` during preview and stops before a commit on older servers.
The standalone collector is in `tools/whatsapp-intake`; deployment of the matching
server routes is still required. Its installer leaves scheduling and auto-commit off.

1. `preview` saves the complete batch once (`saveRun: true`).
2. Every commit carries its parent `batchPreviewRunId`. Matching is recomputed
   using the entire saved manifest, even when a Vercel 413 requires one-file requests.
   Conflicting PDFs for one hotel stay blocked instead of successively overwriting it.
3. Each chunk gets its own audit record. Reports are deferred, and parent active
   commit counts prevent finalization during an in-flight write.
4. `POST /api/content-intake/fattal/report` with `batchPreviewRunId` and `ownerEmail`
   freezes the parent and aggregates persisted server results. Unconfirmed files
   are failures; ambiguous files are skipped. One report email is sent by the server.
5. Repeating the report request reuses the frozen payload and email idempotency key.
   A stored successful send prevents resending, including beyond Resend's key window.

Preview commands are read-only by default:

```sh
node scripts/fattal-intake.mjs --dir "/path/to/current-pdfs" --base-url https://qr.playzones.app --env-file /path/to/.env.fattal
```

`--commit` enables replacement and the report email. `--report-file /path/report.json`
saves the returned report locally. No old dated folder or temporary production env
file is loaded implicitly. `.env.fattal` needs only `CONTENT_INTAKE_API_KEY` (and an
optional owner email); no Firebase, R2, or Resend credentials are needed on the Mac.
Local server mode explicitly uses `--start-server` and additionally loads `.env.local`.

The runner validates PDF signatures/sizes, hashes files and checks for changes
between preview and upload, uses timeouts and rejects HTTP redirects, and holds a
local commit lock keyed by API URL and owner. A leftover lock requires checking
that the previous process stopped before removing it. A nonzero exit indicates
failed/skipped files or an unconfirmed email; absent hotel submissions alone do
not prevent confirmed uploads. After a timeout, inspect the printed batch ID:
no automatic write retry is attempted. A server process killed mid-commit may
leave its parent active; reconcile its media/audit state before recovery.

Integration keys cannot override the configured Fattal owner. The single-PDF route
also checks the explicit target list. PDF replacement rechecks ownership and the
code revision inside its transaction so a concurrent change aborts the upload
and removes the new storage object.

`sourceUrl` requests accept only HTTPS on the configured R2 public host or exact
hosts listed in `CONTENT_INTAKE_SOURCE_HOSTS` (comma-separated). Configure only
trusted storage hosts; redirects are rejected and streamed downloads stop at 25 MB.
Multipart uploads do not require this setting.

Old filename dates more than 14 days from receipt require review. Date fallback
uses Asia/Jerusalem. Folder/area names alone do not identify a hotel. A missing
valid match, including a conflicting pair, is reported as missing.

Offline regression checks (no production access):

```sh
node --test scripts/tests/fattal-intake.test.mjs
```

## WhatsApp connector handoff

| Machine | Business account source | Personal account |
| --- | --- | --- |
| Rani's Mac (first pilot) | Safari Web App `WhatsApp PZ` | Native WhatsApp |
| Michal's Mac mini (planned permanent runner) | Native WhatsApp | WhatsApp Web |

Both machines use a **third, dedicated Chromium business session** for collection,
independent of the apps in this table. Pair using the business phone and confirm
`חוברות QR פתאל`. Never switch to another account as a fallback. Do not read native
`ChatStorage.sqlite` on Rani's machine; it belongs to the personal account.

The Playwright connector, installer, launchers, LaunchAgent template and Hebrew
handoff are in `tools/whatsapp-intake/README_HE.md`. It uses no OpenAI API or Codex
runtime. Keep downloads/profile/credentials in local Application Support and the
browser cache under Library/Caches, outside synced Documents.

Live pilot on 2026-09-20: paired business profile, then downloaded 10 actual PDFs
from Saturday/Sunday headlessly. Repeated successfully from the installed app
without another QR scan. Checked PDF signatures/hashes and reached a dated
history boundary. Owner-confirmed rules now match all 10 files: unqualified Herods, Leonardo Plaza
and Royal map to their explicit Eilat QR targets; any named area takes precedence.
The initial offline check did not prove live target ownership or API compatibility. Later on September 20, live health verified all 12 targets for the confirmed Bidur owner; 10 PDFs were replaced and their public hashes and QR pointers verified. The email report and one WhatsApp summary were confirmed. The pilot schedule was then enabled on Rani's Mac, and a followup correctly made no changes.

New installations still default to `schedule.enabled=false` and `autoCommit=false`.
The Mac's AC power sleep setting was already 0; no global power preference changed.
Intake keys stored as sensitive secrets cannot be retrieved later. Generate a
cryptographically random replacement only with owner authorization, update only
that production secret, and store the same key in the local runner. Verify the
matching server deployment, real replacement and report before enabling automatic writes.

`POST /api/content-intake/fattal/agent-status` records scoped runner state and sends
server-side operational email on changes (login required, failure, no files,
recovery). Repeated unchanged states remain quiet. Offline/shut-down Macs cannot
report their own absence. With explicit customer authorization, `sendGroupReports` sends a concise received/updated/missing summary to the paired business group. Followups at 12:00 and 14:00 stay quiet when nothing new arrived. An outbox records sends before pressing Enter and requires a WhatsApp acknowledgment. `/health` exposes only scoped target-existence/ownership booleans and project consistency, never credentials.

Build the native Mac transfer archive with `node tools/whatsapp-intake/src/package-native.mjs`.
Its explicit allowlist includes the app, collector source and pinned Playwright packages,
but excludes session data, credentials and downloaded PDFs. Pair separately on Michal's Mac. Run only one scheduled instance
per integration. New customers need a server-scoped credential and target mapping,
not just a different owner email in local configuration.


## Dashboard and per-computer keys (v1.20.5)

`/[locale]/content-intake` manages Fattal connections. `/api/content-intake/connections` requires Firebase Bearer authentication. Management is super-admin-only, including GET/POST/DELETE and the page/sidebar. Super admins can select owners of the explicit Fattal targets. Creation returns a random key once; Firestore `contentIntakeConnections` stores only SHA-256 hashes. Revocation blocks subsequent API requests. The existing Firestore rules default-deny unmatched collections; no client access is granted to connections.

All Fattal endpoints and the single PDF endpoint validate these keys and resolve the owner from the stored key scope. Request parameters cannot change that owner. This release scopes keys to all explicitly mapped Fattal booklets for the selected owner, not arbitrary customer QR codes.

Public downloads contain the native Mac application and reviewed collector payload. `TheQ-connection.json` is generated in-browser on explicit download and contains the one-time secret; it must never enter Git or a shared software archive. The native application selects this file through a standard file picker. Fresh installation and key imports leave scheduled writes disabled; upgrades preserve existing activation and credentials. Legacy command launchers remain for maintenance only.

On September 20 the user identified the correct owner as `biduratias@gmail.com` (בידור). Production `FATTAL_BOOKLETS_OWNER_EMAIL` was configured accordingly. Verify scoped health before running a live replacement. Vercel production project is `qrinfo`; the obsolete `qr` project was disconnected from Git at the user's request. It had no successful deployments and no custom domain.


## Planned expansion: user-configured customer automations

User direction, September 20, 2026: Fattal entertainment booklets are the first customer workflow. In a later phase, every user should be able to configure an automation for their own customer and folder; a super admin should also be able to set it up on behalf of other users. This is a future requirement, not functionality shipped by the current Fattal-specific workflow.

Configuration should distinguish the customer's folder and selected QR destinations in The Q from the local Mac download directory. Each connection should include the owner account, customer label, source WhatsApp group, explicit file-to-QR mapping, download location, timezone/schedule and reporting preferences. Local retention/cleanup also needs a defined policy; the current collector retains downloaded PDFs.

Future generalization must remain server-enforced; current access is restricted to super admins (September 20 decision). The acting admin selects the customer owner and is recorded in the audit. Each key is limited to the connection's selected destinations. Folder membership changes must not silently broaden an existing key. Fattal hotel-name inference belongs to the Fattal workflow and must not affect other customers.

Keep each connection's credentials, download ledger, pending runs, schedules and report outbox isolated. Preserve separately paired business sessions, and allow only one active scheduler for a given connection when transferring between computers. Reuse the same Mac package with per-installation configuration; never distribute a customer's key or logged-in WhatsApp profile in the package.


## Auditable email rows (v1.20.7)

Each updated booklet is reported with separate experience title and exact uploaded filename, QR identifier, status, the server-recorded replacement timestamp (Israel time including seconds), and links to the PDF and current QR experience. A duplicate retains its original update time; missing historical timestamps are explicitly marked unavailable. Failed/skipped inputs are labeled received rather than uploaded.

The PDF transaction returns the actual code title and the same timestamp written into `media.contentIntake.updatedAt`. These are copied into `contentIntakeRuns.commitResults` and `contentIntakeFileUpdates` (`title`, `filename`, `replacedAt`, hash, owner/code/run identifiers and URL). The file audit's `updatedAt` remains a Firestore server timestamp. Batched reports preserve the per-file values from committed chunks. Already-sent reports are not automatically resent.


## Weekly schedule and filename contract (1.20.8 / runner 0.4.0)

Super admins edit independent weekday/time pairs in the dashboard (1–28 unique checks, Israel timezone). Settings are owner/workflow-scoped, shared by installations for that owner; only one active installation per workflow is supported. `contentIntakeSettings/fattal-<ownerId>` stores checks, revision, effectiveAfter, updatedBy and server updatedAt. PATCH requires the revision last read (409 on concurrent edit). Newly saved schedules apply only to future slots, preventing accidental immediate catchup of newly added past times.

The Mac polls `/fattal/config` before calculating any scheduled slot, every five minutes while its LaunchAgent is enabled. Its authenticated key derives the owner; it cannot choose another owner. The config endpoint only returns schedule fields. Sync preserves local activation, autoCommit, reporting, credentials, paths and account confirmation. `/fattal/config` POST acknowledges the applied revision in `contentIntakeAgents`; dashboard refresh shows applied/pending plus the last sync timestamp. `sync-config` provides a no-collection/no-upload synchronization check. Network/auth/validation/ack failures prevent a run using stale settings, recorded in local `schedule-sync.json` (also shown by doctor). Offline Macs cannot deliver heartbeat warnings remotely. `DisableSchedule.command` stops polling as well as updates.

Recommended sender filename: `שם המלון - עיר או אזור - DD.MM.YYYY.pdf` with the program start date, e.g. `לאונרדו פלאזה - ים המלח - 20.09.2026.pdf`. The original name remains in the audit. Existing recognized aliases remain valid. Explicit area overrides approved Eilat defaults; ambiguous, conflicting, duplicate or stale candidates stop for review. All 12 target names with full dates have regression coverage.

September 20 verification: all 10 published PDFs and QR pointers were rechecked against local SHA-256. Text extraction confirmed hotel names in eight PDFs; both Herods PDFs show the brand but do not explicitly name the city in their content. Their city mapping remains based on the sender filename and the user-approved unqualified-Herods=Eilat rule, not independent textual proof of city. Missing U Splash Eilat and Leonardo Club Tiberias were not replaced.


## WhatsApp Agent computers and calendar UI (1.20.9 / runner 0.5.0)

The page/sidebar is named WhatsApp Agent. The full-width weekly day picker applies a shared set of editable times to selected days. Different existing schedules are grouped only when their times match exactly; additional day groups preserve distinct timing. Changes remain drafts until Save, using the existing server checks schema and concurrency revision.

Fresh Mac installs generate a random `mac-<UUID>` config id; upgrades preserve the existing id/profile. Version 0.5.0 registers hostname (or the server key's computer name), version, local activation/commit flags and server heartbeat time in `contentIntakeAgents`. Each dashboard key binds to one agent id at first registration; another id is rejected. UI shows last contact and flags from the report, with stale status after ten minutes, never an unconditional online claim.

Super-admin-only `/computers` PATCH transaction pauses/reallows the agent and its matching key. Disabled scoped keys fail authentication across intake endpoints. A revoked key cannot be reenabled through computer controls. Registration cannot clear disabled status; acknowledgment rechecks both records and the schedule revision in the transaction. Legacy pilot key disconnection is enforced by the upgraded runner's config preflight (schedule and manual update/resume/report commands); it does not globally revoke the historical legacy key. Already running work may complete. Disconnection preserves the local app/profile; polls resume only if reallowed and locally enabled. Machines with an older app must upgrade for roster controls.

Michal handoff: create a separate key, install the new package and pair her dedicated business-browser session, preview mapping, disable/disconnect Rani before enabling her schedule, verify one real update/report and keep only one machine active for that group. Never transfer Rani's profile or key. Michal's physical install is not yet verified.

## Native Mac setup and local files (1.20.10 / runner 0.6.0)

`macos/` is a SwiftUI application for macOS 14+, built as a universal arm64/x86_64 executable. The normal flow is Prepare, select the connection JSON, connect business WhatsApp, confirm and preview the experience/file mapping, then explicitly enable updates. The user does not run terminal commands or install Node manually. Prepare downloads pinned Node 24.21.0 from nodejs.org with architecture-specific SHA-256 verification, installs the bundled pinned Playwright dependencies and dedicated browser, then verifies the installed runner version. Native bridge entry guards canonicalize symlinks (`/var` vs `/private/var`) to avoid silent no-op installs. Setup holds installation and runner locks; upgrades preserve the profile/key/config and reload an enabled LaunchAgent with the private runtime.

The application and each dashboard computer card show `~/Library/Application Support/TheQContentIntake/<agent-id>/downloads`; PDFs live below message-hash subdirectories with their original filenames. The native Open Folder button opens the actual absolute path. Files remain after upload; automatic cleanup and a user-selectable download directory are not implemented. Credentials and the paired browser stay in the same per-agent directory, outside the distributed app. Closing the application does not stop enabled scheduled checks. The Mac must remain logged in, powered and awake; the UI links to energy settings without changing system power policy.

Packaging: `node tools/whatsapp-intake/src/package-native.mjs` emits `TheQ-WhatsApp-Agent-0.6.0.zip` and SHA-256. The current build is ad-hoc signed, **not** Developer ID signed or notarized. No signing identity is installed on the development Mac. Complete Apple Developer ID signing and notarization before broad customer distribution; do not disable Gatekeeper or strip quarantine as a workaround.

Verification: both architectures compiled and code-signature integrity checked; native preparation executed on Rani's Apple Silicon Mac, installed 0.6.0 and preserved the active schedule/profile. Intel execution and Michal's physical installation remain unverified. Native UI visually checked; 36 server/collector regressions cover scoped writes, mapping, scheduling, browser downloads and bridge status/entry behavior. This setup release did not intentionally run another live PDF replacement or group report.

## Workflow overview (1.20.11)

The page introduces a general WhatsApp-to-experience workflow with group submission, explicit file matching, weekly checks and completion/missing reports. Keep Fattal out of the product header, but disclose the currently supported Fattal PDF scope in connection setup. This copy change does not implement self-service customer/group mapping or arbitrary file types. Requirements include a logged-in awake Mac, internet, a paired WhatsApp account in the group and one active computer per connection.

## Leonardo Club Eilat default (1.20.12)

On September 23 the owner reconfirmed that an identified hotel without an explicit area means Eilat, including `לאונרדו קלאב אמצש 2209.pdf`. The server default now includes Leonardo Club (Hebrew/English), restricted to mapped target `jKptn6`; explicit Dead Sea/Tiberias filenames retain their own targets. Generic or unidentified hotel filenames do not acquire an Eilat target. Existing Mac 0.6.0 installations rerun Preview to obtain the server fix; no local package update is needed.

## 0.7.0 — partial updates and file assignment (2026-09-24)

Michal's installed runner is not changed by a server/code update.
Deploy the compatible preview API before distributing the runner. Test on Michal's Mac in Preview
before enabling the new runner. An upgrade from 0.6.0 pauses scheduling, keeps the business
profile/key/PDFs, and requires a new Preview and explicit Enable Updates.

- Preserve the full batch in the saved server preview/report; upload only `matched` files.
  Unmatched, conflicting or manually excluded files produce deliberate `skipped` results, not
  failed uploads. Unexpected skips, missing receipts, HTTP timeouts, upload failures and failed
  email still leave a pending batch requiring reconciliation; no blind retry is introduced.
- Compare SHA-256 **per mapped target**. Identical bytes can pass together; server deduplication
  updates once. Different bytes for one target block those files only; do not infer "latest wins".
  Saved previews pin source message ID, size, name and SHA-256, including transport splitting.
- Only real document thumbnails count as attachments. Quoted document previews are excluded.
  Each completed scan uses observed attachments, excluding cached quote-only/deleted entries.
- A caption or exact same-sender reply can supply a short, exact configured experience alias.
  A reply needs an explicit full source-message identity exposed in the DOM. Filename equality,
  display name, proximity, screenshots and file sizes do not establish a reply relationship.
  **Actual quote-ID availability on Michal's WhatsApp remains to be verified.** Current tests
  exercise fixtures with/without these attributes; unsupported replies remain unresolved.
  Conflicting hints/areas, negative/free-form text, stale dates and unknown targets stay blocked.
- The Mac "שיוך…" dialog assigns or excludes one message+hash, with a timestamp. It never adds
  a global filename rule. The target must remain in this owner's configured allowlist.
  Keeping one of two different versions requires explicitly excluding the other.
- Original filenames are retained on disk, in storage and in the email, alongside experience,
  source message ID, assignment reason and the server-recorded update time.
- Checkpoints include evidence fingerprints. A new clarification/manual choice or a removed
  conflicting attachment is re-evaluated at the next slot; an unchanged batch stays quiet.
- A single group report lists updated, already-updated, missing and unresolved items. Correction
  wording is generic: reply with the experience name as shown in the system, or resend with that
  name in the filename. There is no automatic DM or tagging a particular person.
- "יצוא דוח בדיקה" exports bounded attachment/reply metadata and preview matches for inspection,
  without keys, credentials, browser profile or unrelated chat messages.

Validation: server matching/manifest regressions, browser DOM fixtures, mixed-batch runner tests,
manual-choice integrity tests, TypeScript/ESLint, SwiftPM build. Production PDF writes and group
messages are not part of automated tests. A real preview, then a controlled scheduled update and
report/PDF verification on the destination Mac are still required for rollout acceptance.

## 0.7.1 — scan and diagnostic reliability (2026-09-24)

Michal's 07:59 diagnostic export reported runner 0.7.0 but had hashless preview rows and only two reply observations. That export omitted scan/state timestamps, so stale preview is a supported hypothesis, not a confirmed live diagnosis. The two Royal files have equal sizes, which does not prove byte equality. Neither quoted reply includes an explicit source-message reference or sender identity; leave it unresolved.

The collector now accepts unquoted sibling filename labels without title attributes and nested inline spans; quote-only messages still cannot become files. An attachment thumbnail without a readable name stops with an explicit extraction error. The UI hides stale matches after failed/empty/newer scans. Exports include actual installed version, scan/preview timestamps, protocol versions, pending state and collection hashes; no credentials or browser profile. Fractional ISO timestamps render in Israel time. Upgrade components, run a fresh preview, and inspect the new report before re-enabling scheduling. Live Michal verification remains pending.

## 0.7.2 — history completeness (2026-09-24)

The user's screenshots confirm Club Dead Sea and both Royal messages still exist; their absence from the 08:21 0.7.1 preview is a scan gap, not deduplication or deletion. The previous collector used a single bottom scroll and 800 ms wait and only verified the older cutoff. The new collector stabilizes the newest boundary, selects the message scroll ancestor, handles negative column-reverse offsets, requires overlap between pages, and revisits the newest boundary after scanning. Previously cached in-window message IDs must be observed again (including deletion stubs) or the scan stops before any uploads. This guard can require intervention if a message is removed entirely rather than represented by a deletion stub. Do not re-add unseen cached attachments as a fallback.

Diagnostic exports now contain `scan` boundaries, position, observed count and failure code. Tests model delayed loading/anchor restoration, reverse scrolling, unstable latest boundaries and disappearance of the three known attachments. Live validation on Michal's Mac is still required; UI fixture tests do not establish complete access to her chat.


## 0.8.0 — independent delivery, pending recovery and Update Now (2026-09-24)

The Mac runner finalizes data with `POST /fattal/report` and `sendEmail:false`, persists the server-derived result and a durable delivery queue, checkpoints file evidence, then clears the pending marker before sending notifications. `sendEmail` remains opt-out for older callers. Email and WhatsApp delivery errors do not revoke a confirmed file outcome or block later slots. Retry email with the original batch key only within 20 hours of preview generation, conservatively inside [Resend's 24-hour idempotency window](https://resend.com/changelog/idempotency-keys); older ambiguous mail needs operator review.

`GET /fattal/report?batchPreviewRunId=...&ownerEmail=...` is authenticated, owner-scoped and read-only. It returns recovery protocol 1 and frozen results only for a finalized parent batch. Recovery may finalize an inactive parent from existing child receipts, never upload the files again. Require a complete, unique result for every manifest item before removing `pending.json`. Active chunks, failed or missing write confirmations remain blocked and require diagnostics. This release does not add atomic per-file receipts/fencing or reset active-commit counters on elapsed time.

`delivery-queue.json` isolates report retries. Preserve legacy outbox text exactly; short text applies only to new batches. Existing outgoing acknowledgements are found through bounded history search. A sending/uncertain outbox is never blindly resent. Older-day reports are reconcile-only. New summaries include a compact timestamp to distinguish otherwise identical updates, updated titles, grouped held filenames, the requested correction and missing targets. No agent UI or internal IDs appear in new group text.

Native controls: **עדכון עכשיו** uses the same locked runner as the schedule; **בדיקת הפעולה הקודמת** verifies old results without new uploads. Read-only preview is allowed with pending state. Upgrade pause is explicit; users re-enable after recovery/preview. Activity shows next check in Israel time, last scan, data confirmation time, outcome and outstanding reports. Review export includes bounded attempt history, pending ID, server report, delivery state and activation reason. Heartbeats report the actual package version.

Verification: local fixtures cover morning delivery failure followed by noon corrected upload and quiet 14:00, manual runs preserving slots, dropped finalization response, active/incomplete batch refusal, inactive-parent recovery, old outgoing message recognition without Enter, email retry cutoff, scoped GET authorization and deferred report email. No live PDFs or group messages are changed by these tests. Production package availability is separate from installation acceptance: recover and verify the actual Michal batch, run a fresh preview and an explicit update, compare server/file outcomes, then observe a scheduled follow-up. Server-side missing-heartbeat alerts and automatic resolution of abandoned write chunks remain future work; see the reliability plan.
