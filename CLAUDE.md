# CLAUDE.md - The Q

Dynamic QR code platform. Next.js 15 + Firebase + Vercel Pro.

## Environments & Deployment

| | Branch | Firebase Project | Vercel |
|---|--------|-----------------|--------|
| **Production** | `main` | `qrinfo-905c9` | `qr.playzones.app` |
| **Development** | `dev` | `qrinfo-dev` | Preview deployment |

- Both Firebase projects should mirror each other (indexes, rules, structure)
- **"push to main"** = production release → bump version in `src/lib/version.ts` + `package.json`, add changelog entry
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
- Image uploads: `convertToWebp: true` via Sharp → Vercel Blob. Exception: logos with transparency — upload as PNG (no server-side Sharp) with `preserveAlpha: true` in `compressImage()`. Users have storage quotas (see `STORAGE_LIMITS` in types).
- Firestore: `serverTimestamp()` for doc create, `Timestamp.now()` for nested objects
- i18n: `useTranslations()` from next-intl. Both `en.json` and `he.json` must be updated together.

## Gotchas
- `node_modules 2` dir appears randomly - delete it, causes build failures
- Firebase CLI `deploy --only firestore:indexes` silently skips indexes - always verify in Console
- `jsdom` and `xlsx` in `serverExternalPackages` (next.config.ts) - `jsdom` needed for isomorphic-dompurify. `xlsx` kept but Excel export moved client-side.
- Q.Tag WhatsApp templates: `src/lib/qtag-whatsapp.ts` sends QR links via INFORU after registration/verification

## Lessons Learned
<!-- Add bugs, root causes, and solutions here. Keep entries one-line when possible. -->
- Excel export: ALWAYS generate xlsx **client-side** (`XLSX.writeFile()` in browser), NEVER server-side in API routes. The `xlsx` package is unreliable on Vercel serverless even with `serverExternalPackages`. Pattern: build rows from state → `XLSX.utils.json_to_sheet()` → `XLSX.writeFile()`. See `QVoteVotersModal.tsx` and `QTagGuestsModal.tsx` for reference.
- Quick-add modal must use `fixed` positioning (not `absolute`) to work across scanner/list view modes
- Scanner PIN gate: check `pinUnlocked` before initializing camera to avoid wasted camera starts
- INFORU template example field has char limit - short examples (e.g. `jnCSYdJ?token=A`) are fine for Meta review
- Desktop scanner: use `matchMedia('(min-width: 1024px)')` to detect wide screen and always init camera in split view
- Vercel Pro body size limit is 4.5MB - large image uploads (>3MB) MUST use client-side `compressImage()` before sending to `/api/upload`
- New i18n keys for MediaUploader tabs (tooltip/description/create) must be added to both locale files or console warns MISSING_MESSAGE
- Experience name gate: `MediaUploader` has a required `experienceName` field (shown for every tab except `upload`). Every create callback now takes `(name)`; link/raffle use it directly, modal types stash it in dashboard `pendingExperienceName` (set when the create callback opens the modal) and each create handler uses `pendingExperienceName.trim() || <default>` as the code title. Edit handlers (`handleQTagEdit`/`handleWeeklyCalEdit`) are separate and untouched. Staleness is a non-issue — every create `router.push`es away and remounts the dashboard.
- Link sub-types Instagram/Facebook: `linkMode` 'instagram'/'facebook' in MediaUploader build a profile URL (full URL or bare @handle via `buildSocialProfileUrl`); the card type is re-derived in `CodeCard.detectLinkType` from the hostname (instagram.com / facebook.com / fb.me etc.) and shows the brand icon in the type badge via `getLinkBadgeIcon`. Link sub-type pill labels resolve from the `media` namespace (`tMedia(labelKey)`), NOT `uploader`.
- Firestore transactions: ALL reads (`transaction.get()`) MUST happen before ANY writes (`transaction.update/set/delete`) - even with Admin SDK. Use `Promise.all` to batch reads upfront.
- Q.Tag registration with verification: guest record is created ONLY after OTP verification (not on form submit). Pending data stored in `verificationCodes` doc's `pendingRegistration` field.
- Never return `details: String(error)` in API responses — leaks internal stack traces. Log server-side only.
- INFORU WhatsApp URL buttons: must be in separate `Buttons` array with `FieldName` matching button label, NOT in `TemplateParameters`. Error -2505 = missing buttons.
- Vercel serverless: never use fire-and-forget (`.catch()` without `await`). Function terminates after response, killing background ops. Always `await` inside try-catch.
- `fetchWithAuth` must use `onAuthStateChanged` (not `auth.currentUser` directly) — on mobile, Firebase Auth init is slow and `currentUser` is null during early interactions.
- Mobile scanner UX: always `window.scrollTo({ top: 0 })` when switching view modes or opening modals — prevents user seeing a confusing mid-scroll position.
- Q.Tag modal exists on BOTH `dashboard/page.tsx` AND `code/[id]/page.tsx` — each has its own save handler. Fixes must be applied to BOTH files.
- Canvas `toBlob('image/webp', quality)` at quality < 1.0 destroys alpha. For transparent images, use PNG format. `compressImage({ preserveAlpha: true })` handles this.
- iOS Safari < 17 CANNOT encode WebP via `canvas.toBlob` — it silently ignores `'image/webp'` and returns a large PNG (~2-3MB for a 1000px photo). This tripped the `/api/gallery` size limit → Selfie Beam photographer uploads failed on old iPhones but worked on desktop. `cropImageToSquareWebp` (`src/lib/imageCrop.ts`) now checks the returned `blob.type` and re-encodes to JPEG when WebP wasn't produced; `/api/gallery` size limit raised 1MB→2MB for headroom. Server derives the stored extension from `file.type` (mime), so a `.webp` multipart filename with JPEG bytes still stores correctly. Note: photo COUNT is metadata-bound (userGallery is one Firestore doc, ~1600 entries), NOT file-size-bound — only the URL is stored, images live in R2. `cropImageToSquareWebp` also caps output at `TARGET_MAX_BYTES` (450KB, re-encodes heavy outliers at q0.7) so JPEG's larger size never bloats the beam. The just-uploaded thumbnail shows INSTANTLY from the local blob (`UserGalleryImage.localPreview` object URL) instead of waiting on the R2 round-trip; `mergePreviews` in the `myUploadedImages` effect preserves it across the Firestore snapshot, and a hidden preloader `<img src={url} onLoad={releaseLocalPreview}>` revokes the blob once R2 has cached (unmount also revokes via `previewUrlsRef`).
- `refreshUser()` creates a new user object reference → triggers `useEffect([user])` → resets page state. Don't call after modal saves.
- Q.Vote tablet/kiosk mode: vote API MUST skip fingerprint dedup when `tabletMode.enabled` (same device = same fingerprint). Client `resetForNextVoter` MUST regenerate `visitorId` in localStorage (prevents vote doc ID collisions). ALL success paths in `submitVoteWithCredentials` MUST call `setSubmitting(false)` before starting the tablet countdown.
- WhatsApp in-app browser (SFSafariViewController on iOS): has isolated localStorage — `visitorId` and player sessions are lost. Detect with `isInAppBrowser()` in `QGamesRegistration.tsx` and show "Open in browser" banner. iOS detection: `!('safari' in window)` on iOS UA.
- Satori (next/og `ImageResponse`) does NOT support RTL Hebrew text — renders chars in reverse. Avoid Hebrew text in OG images; use logos instead.
- ViewerClient.tsx content wrapper uses `min-h-screen` (commit 8444ec5, for QHunt scroll) — direct children that use Tailwind `h-full` collapse to 0px since CSS `height: 100%` requires an explicit parent `height`, not `min-height`. PDFFlipBookViewer & MultiPDFViewer outer wrappers MUST use `h-screen` (not `h-full`) so the flipbook container gets a real height. Same gotcha applies to any new viewer with `h-full` as the root class.
- Version updates: `UpdateNotification.tsx` polls `/api/version` every 5min + on `visibilitychange`. Floating button (bottom-right), not auto-popup. Two modes: `changelog` (fresh bundle, user hasn't acknowledged) → "Got it" sets `qr_last_seen_version`; `refresh` (server has newer version than bundle) → "Refresh now" → `window.location.reload()`. Endpoint is `force-dynamic` + `no-store`. Both server endpoint and bundle ship from the same deploy — that's how stale bundles detect a new version.
- Selfie Beam = 3 surfaces sharing `codes/{id}.userGallery`: editor modal (admin bulk drop) → `SelfiebeamViewer` (participant capture + `SquareImageCropper` pinch/zoom → 1000px square webp via `cropImageToSquareWebp`) → `GalleryClient` `/gallery/{shortId}` shuffle mode (the actual big-screen beam). Admin seed photos go to `userGallery` (NOT `content.images`) so they mix into the beam. Bulk admin uploads MUST use `uploadQueue.uploadBatch` (3 concurrent + retry) — never a sequential per-file loop (429-crashes on >10 files). `/gallery`+`userGallery` are shared with Riddle — keep changes backward-compatible.
- Selfie Beam country flags + photographer mode (v1.16.0): per-photo `country` tag (`{code,name,flag}`, flags in `/public/flags/*.svg`, list in `src/lib/selfiebeam/countries.ts`). `/api/gallery` now FORCES R2 when configured + stores under `{ownerId}/{eventName}-{shortId}/gallery/` + increments owner `storageUsed` server-side (participants are unauthenticated, can't write `users/*`). Photographer mode = `SelfiebeamContent.photographerToken`: staff link `/v/{shortId}?pk={token}` is unlimited + streamlined; public link stays capped. Token persists INSTANTLY on toggle (modal writes `codes/{id}.media`, falls back to `type==='selfiebeam'` when `mediaId` absent). Viewer edit popup = single Save (name+flag+re-shot photo); deletes need 2nd confirm; "my uploads" uses localStorage in photographer mode (survives tab-close). ALL viewer-side userGallery edits go through `mutateGallery` (raw getDoc read-modify-write — preserves every field). When adding a SelfiebeamContent field, update BOTH `handleSaveSelfiebeam` reconstructions (code page + dashboard) or it's silently dropped on Save. PWA fix (v1.16.1): the dynamic manifest at `/v/{shortId}/manifest.json/route.ts` now carries `?pk=` into `start_url`/`id` (read from `generateMetadata` searchParams → manifest `<link>` URL), so an installed photographer PWA launches unlimited; viewer also remembers the token in `localStorage` (`pk_{codeId}`). `photographerOnly` hides the public upload (`canUpload = galleryEnabled && (!photographerOnly || photographerMode)`). Load ceiling: `userGallery` is ONE doc (~1MB) ≈ **~1600 photos** (~646 bytes/entry with country+storage fields) — hundreds are safe, thousands need a subcollection.
- Selfie Beam beam page (`/gallery/{shortId}` `GalleryClient.tsx`) per-screen LOCAL settings: a draggable `BeamControlPanel.tsx` (opened by a gear INSIDE the header — NOT `isOwner`-gated; the gear sits in the header next to the title link and hides WITH the header via `headerHidden`/Ctrl, so the big event screen stays clean) edits all 13 `GallerySettings` LOCALLY. Effective = `{ ...experienceDefaults, ...firestore gallerySettings, ...localOverridesRef.current }` (local wins); overrides persist to `localStorage['beam-settings-{codeId}']` (debounced), panel drag pos to `beam-panel-pos-{codeId}`. The panel does NOT write Firestore — the dashboard editor (`SelfiebeamBeamSettings`) is the sole GLOBAL default + the Reset target. `onSnapshot` calls `applyEffective(fb)` every time (idempotent; same-value setStates bail out) so editor changes flow live to non-overridden fields. `experienceDefaults` is `useMemo`'d (stable dep for `applyEffective`). No localStorage key → behavior identical to before (Riddle galleries unaffected). `headerHidden` (Ctrl/Cmd toggle) is now a local override too.
- Selfie Beam shuffle randomization (v1.17.4, `GalleryClient.tsx` `pickNextImage`): with FEWER photos than grid cells the old code repeated a near-constant image with no adjacency check → identical photos clustered. Now `pickNextImage(slot, allowAdjacent)` picks the image with the LOWEST on-grid count whose CONTENT key (`keyOf` = `fileHash||url||id`) is not in the slot's 4 orthogonal neighbours (nor the cell's own current). `fillGrid` passes the slot (fills row-major, so left+top are honoured → no orthogonal dup); `allowAdjacent=true` lets it fall back to a dup ONLY to keep the grid full. `swapOne(exclude)` calls `pickNextImage(slot,false)` (returns null rather than a dup) and retries up to 12 random slots, else SKIPS the tick — never creates a visible adjacent dup. `swapBatch` (GallerySettings 1-4, per-screen local only, default 1) runs N cascaded swaps ~220ms apart per tick. Pool ≥ cells → all-distinct (unchanged). Verified with a standalone replica (scratchpad) across photo counts + batch: 0 adjacent-identical always. `gridColsRef`/`gridRowsRef` keep `pickNextImage` dependency-free.
- Selfie Beam editor modal = save-and-stay-open: `SelfiebeamModal.handleSave` does NOT close — the code-page `handleSaveSelfiebeam` returns the persisted `SelfiebeamContent` (instead of closing) so the modal adopts the final logo URLs, clears `logoFiles` (no re-upload on a 2nd Save), and flashes `common.saved`. Don't call `refreshUser()` after the save (it re-runs the `loadCode` effect and churns the page mid-edit) — `updateUserStorage` already persists the storage delta server-side. On FIRST save of a new item the handler sets `editingSelfiebeamId` so a follow-up Save edits instead of creating a duplicate. The modal's init `useEffect` is gated by `initKeyRef` (keyed on `mediaId`) so a post-save `setCode` (new `initialContent` ref) doesn't reset the active tab/fields. Dashboard create flow stays close-then-`router.push` (returns void → modal won't flash "saved").
- QBet "הימור" (qbet, NOT deployed): participant data (registration/OTP/prediction) lives in the FIRESTORE subcollection `codes/{id}/qbetEntries/{phoneDigits}` — Admin SDK only via `src/lib/qbet/store.ts` (doc id = normalized phone digits → one entry per phone for free; re-register merge-set re-issues OTP WITHOUT wiping verified/prediction). Rules: `qbetEntries` read+write `if false` (added to firestore.rules — deploy to BOTH projects with the feature). Supabase was fully removed (user reversed the choice, same as raffle — DEFAULT TO FIREBASE for new experiences). Config stays on codes media (`qbetConfig` — whitelisted in db.ts `updateQRCode`; don't forget that whitelist for any new experience). WhatsApp OTP reuses `sendOTP` (inforu); `/api/qbet/status` is POST so phones never appear in URL logs; verify mints a rotating `entry_token` (localStorage `qbet_{codeId}`). QBetModal mounts ONLY on the code page (raffle-style: dashboard `handleCreateQBet` creates immediately + router.push; modal `initialConfig` falls back to the existing qbet media so the toolbar button edits instead of resetting). Winners = exact score + verified (client-side); Excel export client-side XLSX; flags reuse `/flags/*.svg` + SELFIEBEAM_COUNTRIES. Landing composition: poster + transparent-PNG logo (`preserveAlpha`, Q.Games pattern) + `landingTitle` overlay + animated CTA (`buttonGradient` 2-4 colors, keyframes in `QBET_STYLE`); winners→raffle bridge creates a SEPARATE raffle code via `/api/raffle/participants` — NEVER add raffle media to the qbet code itself (`/v` redirects any raffle-bearing code to the big screen). v2: entrance animations in `QBET_STYLE` (Ken Burns + bounce/rise, transform/opacity only, `prefers-reduced-motion` respected); `allowChangePrediction` (server-enforced in predict route) + `disclaimerText` (`undefined`=default, `''`=hidden — modal init deep-merges DEFAULT_QBET_CONFIG so old configs inherit new defaults); entries tab has wa.me links + pick-time. v3 (v1.18.2): he/en icon-only language switch; kickoff auto-lock (`kickoffAt`+`autoLockMinutes`, `isBettingLocked` server+client); optional `regulationsUrl` link under the disclaimer. **Presentational helpers (FlagImg/MatchHeader/Stepper/etc.) MUST live at MODULE scope, not inside the component — inline components get a new identity every render → React remounts them → their entrance animation replays ("jumping" flags). Header is rendered OUTSIDE the `key={step}` wrapper so it animates once; step content is keyed so it re-rises per step. Tall steps: content column uses `overflow-y-auto` + `my-auto` so it centers when short and scrolls (not clips) when tall.**
- In-app browser gate (v1.17.1): `src/lib/inAppBrowser.ts` (`isInAppBrowser()` UA check + `openCurrentUrlInBrowser()` target=_blank trick) is SHARED by `QGamesRegistration` + `SelfiebeamViewer`. SelfiebeamViewer renders a full-screen "open in browser" gate when `inAppBrowser && canUpload && !bannerDismissed` (dismissible; pure viewers never blocked) — WhatsApp's SFSafariViewController isolates localStorage + breaks camera/upload, so the photographer `?pk=` link especially fails on iOS. Banner strings live in `uploadTranslations` (`publicTranslations.ts`); detection runs in the mount `useEffect`, early-return sits after all hooks.

---
**Claude: update this file at the end of every significant conversation. Keep it under 100 lines. Add to Lessons Learned. Remove anything outdated. If a section grows too large, it means it should be a code comment instead. When pushing to main, bump version + add changelog entry.**
