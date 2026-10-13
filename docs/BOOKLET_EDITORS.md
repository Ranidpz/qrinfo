# Booklet editors — PDF-update delegation

## סיכום בעברית (לרני)

- מנהל־על יכול לתת למשתמש נוסף הרשאה לעדכן את קובץ ה־PDF של חוברות נבחרות. הבעלות לא משתנה, והבעלים ממשיך לעבוד כרגיל.
- מתן הרשאה: כפתור צהוב בכרטיס החוברת (ליד העברת בעלות), או כפתור צהוב בכותרת תיקייה שמעניק הרשאה לכל החוברות שבה במייל אחד.
- המשתמש הנוסף רואה בלוח הבקרה אזור "חוברות לעדכון", ויכול רק להחליף PDF, לראות היסטוריה ולשחזר.
- הוא לא יכול למחוק, להעביר בעלות, לנהל הרשאות, להוסיף פריטים או לגעת בהגדרות. הכול נאכף בשרת.
- כל החלפה נרשמת עם שם המחליף. הקובץ הקודם נשמר לשחזור עד ההחלפה הבאה.
- ההרשאה מתבטלת מיד בביטול ידני, בהעברת בעלות על החוברת, או אם החשבון של המשתמש נדחה.
- בפועל (אוקטובר 2026): הבוט `atias@e.playzones.app` מקבל הרשאה ל־12 חוברות פתאל. נרשם בקוד למייל, החשבון מאושר, וההתחברות נשמרת בדפדפן עד התנתקות יזומה.

## Data

| Where | What | Access |
|---|---|---|
| `bookletEditors/{codeId}__{uid}` | grant: `codeId, uid, ownerId, email, name, grantedBy, grantedAt, revokedAt, revokedBy` | rules `if false`; Admin SDK only |
| `codes/{id}/pdfHistory/{eventId}` | `action` replace / restore / grant / revoke, `actor {uid, via, email, name}`, `next` / `previous` file snapshots (+ `sha256`), `previous.retained` | rules `if false`; Admin SDK only |

A grant is active only while `revokedAt` is null, `ownerId` equals the code's current owner (an ownership
transfer ends it), the code still holds a PDF, and the editor's account is approved (`status` absent or `approved`).

## Server

- `src/lib/booklets/access.ts` — `requireBookletAccess(request, codeId)`: owner → collaborator → super admin →
  active grant. Re-reads the grant on every request.
- `POST /api/codes/[codeId]/pdf` — every caller records history (`replaceCodePdfWithBuffer(..., { history })`).
  Editors: multipart only, `mediaId` required, existing PDF item only, title/source/flags forced.
  Dashboard uploads: target-only conflict check + duplicate (same SHA-256 as live file) refused.
  The intake-key branch is unchanged apart from recording history.
- `GET /api/codes/[codeId]/pdf/history` — editors get names, never emails.
- `POST /api/codes/[codeId]/pdf/restore {eventId}` — only the change that produced the live file can be undone;
  the displaced file is kept, so a restore can be undone too.
- `GET|POST|DELETE /api/admin/booklet-editors` — super admin. `POST {codeIds[], email}` grants in bulk
  (≤100, per-booklet result; idempotent). Refuses super admins and unapproved accounts.
- `GET /api/booklet-editor/booklets` — the caller's active grants, for the dashboard section.

## Storage

Uploads land under the OWNER's key prefix (`{ownerId}/{codeId}/booklets/...`) and are billed to the owner.
Only the PDF a replacement displaced is kept (one per media item); the next replacement deletes it, but never a
URL that is live or being kept. Kept files are not counted in `storageUsed`. Editors cannot delete stored objects
(`canDeleteStoredObject` denies them) and cannot write the code doc (rules).

Known gaps: the Fattal `commit` route still replaces without history (deletes the old file at once);
deleting a code or PDF item leaves its kept file and `pdfHistory` docs behind.

## UI

- `src/components/booklets/BookletEditorsModal.tsx` — one booklet (code page row + dashboard card).
- `src/components/booklets/BookletEditorsBulkModal.tsx` — folder header, the folder's booklets pre-ticked.
- `src/components/booklets/SharedBookletsSection.tsx` — the editor's dashboard section.
- `src/components/booklets/PdfHistoryModal.tsx` — history + restore (owner, super admin, editor).

## Tests

`node --test scripts/tests/booklet-editors.test.mjs` — access (incl. revoke, transfer, rejected account), history +
retention, purge safety, non-PDF handling, restore, duplicate + concurrent replacement, editor route limits,
bulk grant.
