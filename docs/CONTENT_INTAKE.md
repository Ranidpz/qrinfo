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

This endpoint does not upload files, delete files, or replace QR media. It only:

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

The response includes:

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

- `contentIntakeRuns`: batch status, preview, commit results, suggested reply
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

## Remaining Migration Work

- Existing Fattal PDFs were copied to R2 without deleting old Blob objects. If rerunning `POST /api/content-intake/fattal/migrate-existing`, keep `dryRun: true` first and only use `deleteOld: true` after viewer checks pass.
- Backfill Firestore storage metadata for records whose URL already points to R2 but whose `storageProvider` is missing. This is metadata-only and must not change file URLs, file sizes, `storageUsed`, or delete old Blob objects.
- Move the remaining media upload families (images, gallery, avatars, Q.Vote) to the same storage adapter after PDF rollout is stable.
- Keep Vercel Blob delete/read support until legacy Blob media has either been migrated or intentionally left in place.
