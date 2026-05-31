# R2 Media Storage

This document is the current source of truth for The Q media storage after the unified R2 migration.

## Current State

- New media uploads go through `src/lib/media-storage.ts`.
- `MEDIA_STORAGE_PROVIDER=cloudflare-r2` sends new uploads to Cloudflare R2.
- `PDF_STORAGE_PROVIDER` can override PDF uploads. If it is not set, PDFs follow `MEDIA_STORAGE_PROVIDER`.
- Existing Vercel Blob media stays supported for read and delete.
- Existing Blob files are not deleted or moved by this rollout.
- `BLOB_READ_WRITE_TOKEN` must stay configured until every legacy Blob record is migrated or no longer needed.

## Storage Adapter

Code path:

- `src/lib/media-storage.ts`
- `src/lib/r2-storage.ts`
- `src/lib/server-storage.ts`

Rules:

- Do not import `@vercel/blob` directly outside `src/lib/media-storage.ts`.
- Upload routes should call `uploadStoredObject()`.
- Delete routes should call `deleteStoredObjectByUrl()` or `deleteStoredObjectsByPrefix()`.
- Build keys with `buildMediaStorageKey()` so all providers use the same folder structure.
- Persist storage metadata returned by the API whenever a media record is saved to Firestore.

Returned metadata:

- `storageProvider`
- `storageKey`
- `storageBucket`
- `contentType`
- `url`
- `size`
- media-specific fields such as `thumbnailStorageProvider` for Q.Vote thumbnails

## Folder Structure

All new managed media should live under the owner and code:

```text
{ownerId}/{codeId}/{family}/{filename}
```

Current families:

```text
{ownerId}/{codeId}/booklets/{timestamp}_{suffix}.pdf
{ownerId}/{codeId}/gallery/{imageId}.{ext}
{ownerId}/{codeId}/qvote/photos/{photoId}.{ext}
{ownerId}/{codeId}/qvote/thumbs/{photoId}_thumb.{ext}
{ownerId}/{codeId}/avatars/{identifier}_{timestamp}_{suffix}.webp
```

This owner/code prefix is important because storage is sold and reported per user.

## Upload Paths

### General Upload API

Code path:

- `src/app/api/upload/route.ts`

Used by dashboards and editor media flows. It now writes through `uploadStoredObject()` for PDFs, images, audio, and video.

PDF rules:

- A PDF is detected by MIME/filename plus the real PDF signature `%PDF-`.
- PDFs use `PDF_STORAGE_PROVIDER` when present, otherwise `MEDIA_STORAGE_PROVIDER`.

### Gallery

Code path:

- `src/app/api/gallery/route.ts`
- `src/components/viewer/RiddleViewer.tsx`
- `src/components/viewer/SelfiebeamViewer.tsx`

Gallery uploads now write through the adapter and persist storage metadata on the `userGallery` records.

### Q.Vote Photos

Code path:

- `src/app/api/qvote/upload/route.ts`
- `src/app/[locale]/code/[id]/candidates/page.tsx`
- `src/components/viewer/QVoteViewer.tsx`

Candidate photos and thumbnails now write through the adapter. Both the main photo and thumbnail should keep their own storage metadata.

### Avatars

Code path:

- `src/app/api/avatar/upload/route.ts`

Avatar uploads now write through the adapter. Prefix cleanup checks both Vercel Blob and R2 so replacing an avatar works during the mixed-storage period.

### Content Intake / Fattal Agent API

Code path:

- `src/app/api/content-intake/fattal/preview/route.ts`
- `src/app/api/content-intake/fattal/commit/route.ts`
- `src/lib/content-intake/fattal.ts`

Agent flow:

1. Call `POST /api/content-intake/fattal/preview` with all received PDF names.
2. Stop if `commitReady` is false.
3. Commit only explicit matched targets.
4. Only send the customer success reply after all commits return success.

Fattal booklet replacements write PDFs to R2 at `{ownerId}/{codeId}/booklets` and update Firestore with storage metadata.

## Dashboard Badge

The dashboard badge is an editor-only indication for admins.

Badge logic:

- `storageProvider === "cloudflare-r2"` means show `R2`.
- If `storageProvider` is missing but the URL host is `theq-media.playzones.app` or an R2 host, show `R2`.
- Otherwise show `Blob`.

This URL fallback is intentional because older R2 records may not have complete storage metadata.

## Delete Compatibility

All managed-storage deletes should go through the adapter.

Supported delete targets:

- `theq-media.playzones.app`
- `*.r2.cloudflarestorage.com`
- `*.blob.vercel-storage.com`

Do not call `@vercel/blob` delete directly for generic media that may already be on R2.

## Rollback

To send new uploads back to Vercel Blob:

```text
MEDIA_STORAGE_PROVIDER=vercel-blob
PDF_STORAGE_PROVIDER=vercel-blob
```

Rollback does not require changing existing records. R2 URLs remain readable and deletable as long as the R2 env vars stay configured.

## Backfill Recommendation

Backfill should be metadata-first, not file-moving.

Recommended first pass:

- Find media records where `url` points to `theq-media.playzones.app` or an R2 URL.
- Add missing `storageProvider`, `storageKey`, `storageBucket`, and `contentType`.
- Do not change `url`, `size`, `storageUsed`, owner fields, or old Vercel Blob objects.

Do a full file-copy migration only after the unified upload path is stable in production.

## Storage Accounting

This rollout preserves the existing storage accounting behavior. Upload APIs keep returning `size`, and existing quota updates continue using the stored media sizes.

Before using storage totals for strict billing across every media family, run a separate audit that normalizes old records and nested media metadata. Do not mix that accounting cleanup into upload-provider changes.
