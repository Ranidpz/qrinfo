# Content Intake

Content Intake is the generic layer for automated customer file updates.
The first workflow is `fattal-booklets`: PDF entertainment booklets are matched to existing QR codes before any media is replaced.

## Naming Model

- Product feature: Auto Content Updates / Content Intake
- Source connector: WhatsApp, Email, Drive, Manual Upload, API
- Customer workflow: Fattal Booklets

Keep source connectors separate from workflow rules. WhatsApp downloads files; the Fattal workflow decides which hotel QR code each PDF belongs to.

## Preview Endpoint

`POST /api/content-intake/fattal/preview`

This endpoint does not upload files, delete files, or replace QR media. It only:

- authenticates a super admin or server integration key
- loads the selected owner's QR codes in the Fattal folders
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
  "ownerEmail": "support@example.com",
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

## PDF Commit Endpoint

`POST /api/codes/{codeId}/pdf`

This endpoint is the first R2-backed commit path. It replaces the PDF media on one existing QR code, uploads the new PDF to Cloudflare R2 under:

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

### Commit Flow For The Agent

1. Call preview with all received PDF names.
2. Stop if `commitReady` is false and send the suggested review reply.
3. For each matched file, call `POST /api/codes/{codeId}/pdf`.
4. Send the Hebrew success reply only after every commit returned `success: true`.

## Remaining Migration Work

- Existing Fattal PDFs can be copied with `POST /api/content-intake/fattal/migrate-existing`. It is `super_admin` only and defaults to `dryRun: true`; send `{ "dryRun": false, "deleteOld": false }` to copy to R2 without deleting old Blob objects, then rerun with `deleteOld: true` only after viewer checks pass.
- Add a batch commit endpoint that accepts the full preview result and writes a run log.
- Move the remaining media upload families (images, gallery, avatars, Q.Vote) to the same storage adapter after PDF rollout is stable.
- Keep Vercel Blob delete/read support until legacy Blob media has either been migrated or intentionally left in place.
