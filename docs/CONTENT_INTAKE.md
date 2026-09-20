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
This offline check does not prove live target ownership or API compatibility.

The installed configuration keeps `schedule.enabled=false` and `autoCommit=false`.
The Mac's AC power sleep setting was already 0; no global power preference changed.
Intake keys stored as sensitive secrets cannot be retrieved later. Generate a
cryptographically random replacement only with owner authorization, update only
that production secret, and store the same key in the local runner. Verify the
matching server deployment, real replacement and report before enabling automatic writes.

`POST /api/content-intake/fattal/agent-status` records scoped runner state and sends
server-side operational email on changes (login required, failure, no files,
recovery). Repeated unchanged states remain quiet. Offline/shut-down Macs cannot
report their own absence. With explicit customer authorization, `sendGroupReports` sends a concise received/updated/missing summary to the paired business group. Followups at 12:00 and 14:00 stay quiet when nothing new arrived. An outbox records sends before pressing Enter and requires a WhatsApp acknowledgment. `/health` exposes only scoped target-existence/ownership booleans and project consistency, never credentials.

Build the source-only transfer archive with `node tools/whatsapp-intake/src/package.mjs`.
Its explicit allowlist excludes session data, credentials, downloaded PDFs, and
node_modules. Pair separately on Michal's Mac. Run only one scheduled instance
per integration. New customers need a server-scoped credential and target mapping,
not just a different owner email in local configuration.


## Dashboard and per-computer keys (v1.20.5)

`/[locale]/content-intake` manages Fattal connections. `/api/content-intake/connections` requires Firebase Bearer authentication. Regular users can discover/manage their own mapped booklets; super admins can select owners of the explicit Fattal targets. Creation returns a random key once; Firestore `contentIntakeConnections` stores only SHA-256 hashes. Revocation blocks subsequent API requests. The existing Firestore rules default-deny unmatched collections; no client access is granted to connections.

All Fattal endpoints and the single PDF endpoint validate these keys and resolve the owner from the stored key scope. Request parameters cannot change that owner. This release scopes keys to all explicitly mapped Fattal booklets for the selected owner, not arbitrary customer QR codes.

Public downloads contain only the reviewed source installer. `TheQ-connection.json` is generated in-browser on explicit download and contains the one-time secret; it must never enter Git or a shared software archive. The installer imports it for new installations, preserves existing credentials, and offers ImportConnection / EnableUpdates / DisableSchedule launchers. Installation and imports leave scheduled writes disabled.

On September 20 the user identified the correct owner as `biduratias@gmail.com` (בידור). Production `FATTAL_BOOKLETS_OWNER_EMAIL` was configured accordingly. Verify scoped health before running a live replacement. Vercel production project is `qrinfo`; the obsolete `qr` project was disconnected from Git at the user's request. It had no successful deployments and no custom domain.
