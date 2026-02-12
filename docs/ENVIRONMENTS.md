# סביבות פיתוח ופרודקשיין

> תיעוד ההפרדה בין סביבות Production ו-Development
> עודכן: 2026-02-12

---

## Firebase Projects

| סביבה | Firebase Project | שימוש |
|--------|-----------------|-------|
| **Production** | `qrinfo-905c9` | אתר חי - main branch |
| **Development** | `qrinfo-dev` | פיתוח ובדיקות - dev/feature branches |

### החלפת סביבה ב-Firebase CLI

```bash
# עבודה עם סביבת פיתוח
firebase use dev

# חזרה לפרודקשיין
firebase use default

# בדיקת סביבה נוכחית
firebase use
```

---

## Vercel Environments

| Vercel Scope | Branch | Firebase Project | דומיין |
|-------------|--------|-----------------|--------|
| **Production** | `main` | `qrinfo-905c9` | `qrinfo-git-main-*.vercel.app` |
| **Preview** | `dev`, feature branches | `qrinfo-dev` | `qrinfo-*.vercel.app` |

---

## Environment Variables

### Vercel Scope Mapping

| משתנה | Production | Preview | הערות |
|--------|:----------:|:-------:|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `qrinfo-905c9` | `qrinfo-dev` | ערכים שונים לכל סביבה |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `qrinfo-905c9` | `qrinfo-dev` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `qrinfo-905c9` | `qrinfo-dev` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `qrinfo-905c9` | `qrinfo-dev` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `qrinfo-905c9` | `qrinfo-dev` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `qrinfo-905c9` | `qrinfo-dev` | |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | `qrinfo-905c9` | `qrinfo-dev` | |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | `qrinfo-905c9` | `qrinfo-dev` | Service Account JSON |
| `BLOB_READ_WRITE_TOKEN` | All Environments | | אותו ערך |
| `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` | All Environments | | אותו ערך |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | All Environments | | אותו ערך |
| `INFORU_API_USER` | All Environments | | אותו ערך |
| `INFORU_API_TOKEN` | All Environments | | אותו ערך |
| `INFORU_SENDER_ID` | All Environments | | אותו ערך |
| `INFORU_WHATSAPP_TEMPLATE_HE` | All Environments | | אותו ערך |
| `INFORU_WHATSAPP_TEMPLATE_EN` | All Environments | | אותו ערך |
| `OTP_HASH_SALT` | All Environments | | אותו ערך |

### איפה למצוא את הערכים

**Firebase Client vars** (`NEXT_PUBLIC_FIREBASE_*`):
> Firebase Console → Project → Project Settings → General → Your apps → Firebase SDK snippet

**Firebase Service Account** (`FIREBASE_SERVICE_ACCOUNT_KEY`):
> Firebase Console → Project → Project Settings → Service Accounts → Generate New Private Key
> הדביקו את כל ה-JSON בשורה אחת

---

## הגדרת סביבה מקומית

### מפתח חדש - שלב אחר שלב

1. **Clone the repo**
   ```bash
   git clone <repo-url> && cd qr
   ```

2. **התקנת dependencies**
   ```bash
   npm install
   ```

3. **הגדרת environment variables**
   ```bash
   cp .env.local.example .env.local
   # מלאו את כל הערכים מ-Firebase Console (project: qrinfo-dev)
   ```

4. **הגדרת Firebase CLI**
   ```bash
   firebase login
   firebase use dev
   ```

5. **הרצה מקומית**
   ```bash
   npm run dev
   ```

---

## Firestore Rules Deployment

ה-security rules צריכים להתפרס לשני ה-projects:

```bash
# Deploy ל-dev
firebase deploy --only firestore:rules --project dev

# Deploy ל-production
firebase deploy --only firestore:rules --project default
```

> **חשוב:** תמיד לבדוק rules על dev לפני deploy ל-production.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐
│  main branch    │────▶│  Vercel Production │───▶ Firebase: qrinfo-905c9
└─────────────────┘     └──────────────────┘
┌─────────────────┐     ┌──────────────────┐
│  dev / feature  │────▶│  Vercel Preview    │───▶ Firebase: qrinfo-dev
└─────────────────┘     └──────────────────┘
```

### Server-Side (API Routes → Admin SDK)
- Votes, verification, rate limiting → `src/lib/firebase-admin.ts`
- Uses `FIREBASE_SERVICE_ACCOUNT_KEY`

### Client-Side (Browser → Firebase SDK)
- Auth, Firestore reads, candidates, analytics → `src/lib/firebase.ts`
- Uses `NEXT_PUBLIC_FIREBASE_*` vars
