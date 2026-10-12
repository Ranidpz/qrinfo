# The Q — security rules for every new experience and feature

This is the contract. Follow it and a new experience needs no separate security audit.
`npm run security:check` enforces most of it automatically (also run by `/push`).
Exceptions go in `scripts/security-allowlist.json` with a written reason, never silently in code.

> Replaces the old Q.Vote-era `docs/SECURITY_CHECKLIST.md` (merged below).

## סיכום בעברית (לרני)

- נתונים של משתתפים (טלפונים, טוקנים, תוצאות) נשמרים רק דרך השרת. הדפדפן לא כותב ולא קורא אותם ישירות.
- כל נתיב שרת חדש: בעלים בלבד, או הגבלת קצב ובדיקת קלט. הודעות שגיאה כלליות בלבד.
- אסור לשים סודות (קוד PIN, טוקן, קישור צוות) במסמך הקוד הציבורי.
- כל הודעת וואטסאפ או SMS בתשלום יוצאת דרך פונקציה אחת עם מכסה והגבלה.
- כל העלאת קובץ עוברת דרך נתיב אחד עם התחברות ומכסת אחסון.
- תוכן HTML מסונן תמיד, וקישורים של משתמשים עוברים בדיקה.
- טלפונים מוצגים מוסתרים, דפי לקוחות לא נכנסים לגוגל.
- לפני כל שחרור רצה בדיקה אוטומטית שעוצרת את הדחיפה אם נכנסה פרצה מוכרת.

## 1. Data: where experience data lives

- Participant data (phones, OTP state, tokens, scores, entries) lives in a Firestore
  **subcollection under the code** (`codes/{id}/<experience>Entries`), written and read only via the
  **Admin SDK** behind a store module (`src/lib/<experience>/store.ts`). Pattern: `src/lib/qbet/store.ts`.
- Rules for that subcollection are always:
  ```
  match /myExperienceEntries/{entryId} { allow read, write: if false; }
  ```
- The owner reads participant data through an owner route (`requireCodeOwner`), never a client listener —
  unless the rule is explicitly `isCodeOwnerOrAdmin(codeId)` and the data has no secrets.
- Default to Firebase (no new databases).

## 2. No secrets on the public code doc

`codes/{id}` is world-readable (every `/v/` viewer reads it). Never put a PIN, token, staff link,
answer key or API key in `media[].<config>`.

- Put per-media secrets in `codes/{id}/private/secrets` → add the field to `SECRET_FIELDS` in
  `src/lib/codeSecrets.ts`. `db.ts` then splits it off on every save, owner editors get it back via
  `hydrateCodeSecrets`, servers read it with `resolveMediaSecret`.
- The browser never compares a secret. It sends what the user typed / the URL param to an API that
  answers yes/no (`/api/selfiebeam/photographer`, `/api/qtag/scanner-guests`).
- Public server pages pass media through `stripSecretsForPublic`.
- Generate tokens with `crypto.randomUUID()` / `crypto.randomBytes(16)` — never `Math.random()` / `Date.now()`.
- `security:check` fails on any new `*token* / *pin* / *secret* / *password* / *apiKey*` field in `src/types`.

## 3. API route templates

**Owner-only route**
```ts
import { requireCodeOwner, isAuthError } from '@/lib/auth';
export async function POST(request: NextRequest) {
  const { codeId } = await request.json();
  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;
  // ... Admin SDK work
}
```
Client: `fetchWithAuth('/api/...')` (never plain `fetch` for owner routes).

**Public route (participants)**
```ts
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`my-exp:${getClientIp(request)}`, RATE_LIMITS.API); // GAME for crowd endpoints
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = await request.json();
  if (typeof body.codeId !== 'string' || !body.codeId) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  // validate every field (type, length, enum); derive ownerId from the code doc, NEVER from the body
}
```
- In-memory limits reset per serverless instance; anything that costs money or guards a secret needs a
  durable (Firestore) limit or attempt counter as well.
- Errors: `console.error('[route]', error)` server-side, return a generic message. Never
  `String(error)`, `error.message` or provider error details in a response.
- Phones / tokens in URLs → use POST bodies instead (URLs end up in logs).
- Server code uses the **Admin SDK** only: `getAdminDb()`, and `src/lib/server/*-rtdb.ts` for RTDB.
  The client SDK on the server is unauthenticated and the rules deny it.

## 4. Paid messages (WhatsApp / SMS via INFORU)

Only through `src/lib/messaging/paidSend.ts`: `guardedSendOTP`, `guardedSendTemplate`, `guardedSendQTagQR`.
They apply durable per-phone and per-code caps, count the owner's `messageQuota`, and write `messageLogs`.
Importing `sendOTP` / `sendTemplateMessage` / `sendQTagQRWhatsApp` anywhere else fails `security:check`.
Owner-triggered sends pass `ownerTriggered: true`. Owner-limit enforcement: `MESSAGE_QUOTA_ENFORCE=true`.

## 5. Uploads and stored files

- Owner uploads: `/api/upload` with `fetchWithAuth`. The uid comes from the token; the quota is
  enforced server-side; `storageUsed` is updated by the server only (`src/lib/storage-guard.ts`).
- Participant uploads (galleries): an experience route that derives the owner from the code, caps size/type,
  and returns a signed `deleteToken` (`signObjectDeleteToken`) so the participant can delete only their own file.
- Every object key starts with the owner uid: `{uid}/{codeId}/...`. Deletes check ownership
  (`canDeleteStoredObject` / `keyBelongsToCode`).
- Large files: compress client-side first (Vercel body limit 4.5MB).

## 6. HTML, URLs, embedding

- `dangerouslySetInnerHTML` only with `sanitizeRichText` (owner rich text) or DOMPurify; JSON-LD via `JSON.stringify`.
- Any user-supplied URL that is navigated to or put in `href`: `isSafeLinkUrl` (`src/lib/safeUrl.ts`) —
  http(s), tel, mailto, sms, whatsapp only. Check on save AND before use.
- Proxies (`pdf-proxy` style) accept only our own storage hosts (`isOwnStorageUrl`) and force the content type.
- New frameable routes must be added explicitly to the `frame-ancestors` CSP in `next.config.ts`
  (today only `/v/*` for TVzone). Everything else stays `X-Frame-Options: SAMEORIGIN`.
- Customer pages (`/v`, `/gallery`, `/raffle`, …) are `noindex` (next.config headers).

## 7. Realtime Database

- Server-owned nodes (leaderboards, records, stats, phases) → `.write: false`; write from API routes via
  `src/lib/server/*-rtdb.ts`.
- Display screens may only create a missing session node (`".write": "!data.exists()"` + `.validate`).
- Only peer-to-peer game state written by anonymous players may stay writable, with `.validate` on shape/size.

## 8. Privacy

- Mask phones in API responses (`maskPhoneNumber`) unless the caller is the owner.
- No full phones, OTPs or tokens in `console.*` logs (mask / truncate to 4 chars).
- `users/{uid}`: users can edit only `displayName`; quotas/roles are server/admin-only.

## 9. Rules changes and releases

- Test `firestore.rules` / `database.rules.json` on `qrinfo-dev` first; deploy to BOTH projects together
  with the code that needs them (REST deploy — see project memory).
- Live clients depend on: Fattal hotel booklets (PDF viewer, `/api/codes/[codeId]/pdf`,
  `/api/content-intake/**` — do not change their auth contracts), Q.Tag, Q.Vote, Selfie Beam, raffle, 10 בול.
- `/push` runs `npm run security:check` and `tsc`; never push on failure.

## 10. Environment secrets

Required (Vercel, both environments): `FIREBASE_SERVICE_ACCOUNT_KEY`, `BLOB_READ_WRITE_TOKEN`,
`CLOUDFLARE_R2_*`, `OTP_HASH_SALT` (random 32+ chars, unique per project — never commit it),
`MEDIA_TOKEN_SECRET` (random 32+ chars; signs gallery delete tokens), `INFORU_API_USER`,
`INFORU_API_TOKEN`, `INFORU_SENDER_ID`, `CRON_SECRET`, `RESEND_API_KEY`.
Optional: `EXTRA_STORAGE_HOSTNAMES` (old storage hosts still holding live files), `MESSAGE_QUOTA_ENFORCE`.
Never commit a real value to the repo (docs included).

## 11. Pre-event checks (from the old checklist)

- [ ] Send an OTP to a real phone; it arrives within 30 seconds
- [ ] Rapid repeated sends to one phone are refused (per-phone cap)
- [ ] 5 wrong codes lock the attempt
- [ ] The door scanner opens with the PIN and refuses a wrong one
- [ ] The big-screen link opens; the public QR does not open the operator screen

## 12. Open items (tracked in `scripts/security-allowlist.json` as FOLLOW-UP)

- Q.Challenge routes still use the client SDK (hidden experience; broken in prod) — move to Admin SDK before enabling.
- Legacy client writes: `candidates` (Q.Vote self-registration), `qhunt_players` / `qhunt_scans`,
  analytics logs, gamification packs — move behind API routes.
- `isGalleryUpdate` lets anyone rewrite `userGallery` on a code doc — move gallery writes server-side.
- Q.Games peer state is writable by anonymous players — add anonymous auth + per-player rules.
- Q.Stage judge voting is disabled (no token check existed) — implement server-side before re-enabling.
- CSP: add a Report-Only policy with a report endpoint, then enforce.
