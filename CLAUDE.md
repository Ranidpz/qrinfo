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

---
**Claude: update this file at the end of every significant conversation. Keep it under 100 lines. Add to Lessons Learned. Remove anything outdated. If a section grows too large, it means it should be a code comment instead. When pushing to main, bump version + add changelog entry.**
