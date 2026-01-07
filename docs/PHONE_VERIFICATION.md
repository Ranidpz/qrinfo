# מערכת אימות טלפון (Phone Verification)

תיעוד מלא למימוש אימות טלפון באמצעות WhatsApp/SMS עבור חוויות במערכת QR.

---

## תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [משתני סביבה נדרשים](#משתני-סביבה-נדרשים)
4. [Firebase Collections](#firebase-collections)
5. [Firebase Security Rules](#firebase-security-rules)
6. [Firebase Indexes](#firebase-indexes)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [איך להוסיף אימות לחוויה חדשה](#איך-להוסיף-אימות-לחוויה-חדשה)
10. [Rate Limiting](#rate-limiting)
11. [Tablet/Kiosk Mode](#tabletkiosk-mode)

---

## סקירה כללית

המערכת מאפשרת אימות משתמשים באמצעות קוד OTP שנשלח ב-WhatsApp (עדיפות ראשונה) או SMS (fallback).

**תכונות עיקריות:**
- שליחת OTP ב-WhatsApp או SMS
- Rate limiting מבוסס Firestore (עובד עם serverless)
- הגבלת מספר הצבעות לפי מספר טלפון
- תמיכה בקטגוריות (הצבעה אחת לקטגוריה)
- מצב טאבלט/קיוסק עם איפוס אוטומטי
- תמיכה בעברית ואנגלית

---

## ארכיטקטורה

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Routes     │────▶│   INFORU API    │
│   Component     │     │   (Next.js)      │     │   (WhatsApp/SMS)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌──────────────────┐
        └──────────────▶│   Firestore      │
                        │   Collections    │
                        └──────────────────┘
```

**Flow:**
1. משתמש מזין מספר טלפון
2. Frontend קורא ל-`/api/verification/send`
3. API בודק rate limits, יוצר OTP, שולח ב-WhatsApp/SMS
4. משתמש מזין קוד
5. Frontend קורא ל-`/api/verification/verify`
6. API מאמת קוד, יוצר session
7. משתמש מצביע עם ה-session token

---

## משתני סביבה נדרשים

```bash
# .env.local

# INFORU API (לשליחת WhatsApp/SMS)
INFORU_USERNAME=your_username
INFORU_API_TOKEN=your_api_token

# OTP Security (חובה!)
OTP_HASH_SALT=your_random_64_char_hex_string

# Firebase Admin SDK (לגישה מה-API)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### יצירת OTP_HASH_SALT

```bash
# בטרמינל:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Firebase Collections

### 1. verifiedVoters
שומר מידע על מספרי טלפון מאומתים.

```typescript
interface VerifiedVoter {
  id: string;              // `${codeId}_${phoneDigits}`
  codeId: string;          // ID של החוויה
  phone: string;           // מספר טלפון מנורמל
  sessionToken: string;    // טוקן לאימות בקשות
  sessionExpiresAt: Date;  // תפוגת session (24 שעות)
  maxVotes: number;        // מקסימום הצבעות מותר
  votesUsed: number;       // הצבעות שנוצלו
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. verificationCodes
שומר קודי OTP פעילים.

```typescript
interface VerificationCode {
  id: string;              // `${codeId}_${phoneDigits}`
  codeId: string;
  phone: string;
  codeHash: string;        // Hash של הקוד (לא הקוד עצמו!)
  attempts: number;        // ניסיונות כושלים
  maxAttempts: number;     // מקסימום ניסיונות (3)
  expiresAt: Date;         // תפוגה (5 דקות)
  verified: boolean;
  createdAt: Date;
}
```

### 3. rateLimits
Rate limiting לפי מספר טלפון.

```typescript
interface RateLimit {
  id: string;              // `${type}_${identifier}`
  type: string;            // 'otp_send'
  identifier: string;      // מספר טלפון
  count: number;           // מספר בקשות
  windowStart: Date;       // תחילת חלון הזמן
  windowMs: number;        // גודל חלון (15 דקות)
  maxRequests: number;     // מקסימום בקשות (3)
}
```

### 4. messageLogs
לוג של הודעות שנשלחו.

```typescript
interface MessageLog {
  id: string;
  codeId: string;
  phone: string;
  method: 'whatsapp' | 'sms';
  status: 'sent' | 'failed';
  provider: 'inforu';
  createdAt: Date;
}
```

---

## Firebase Security Rules

הוסף לקובץ `firestore.rules`:

```javascript
// VerifiedVoters collection (phone verification)
match /verifiedVoters/{voterId} {
  // Anyone can read (to check session validity)
  allow read: if true;
  // Anyone can create (during phone verification)
  allow create: if true;
  // Anyone can update (session updates, vote tracking)
  allow update: if true;
  // Only authenticated users can delete (during vote reset)
  allow delete: if request.auth != null;
}

// VerificationCodes collection (OTP codes)
match /verificationCodes/{codeId} {
  // Anyone can read (to verify OTP)
  allow read: if true;
  // Anyone can create (when requesting OTP)
  allow create: if true;
  // Anyone can update (increment attempts, mark as verified)
  allow update: if true;
  // Only authenticated users can delete (during vote reset)
  allow delete: if request.auth != null;
}

// RateLimits collection (for OTP rate limiting)
match /rateLimits/{limitId} {
  // Anyone can read/write (rate limiting is per-phone, not per-user)
  allow read, write: if true;
}

// MessageLogs collection (for tracking sent messages)
match /messageLogs/{logId} {
  // Only owner or admin can read
  allow read: if request.auth != null;
  // Anyone can create (during OTP sending)
  allow create: if true;
  // No update or delete
  allow update, delete: if false;
}
```

**פריסה:**
```bash
firebase deploy --only firestore:rules
```

---

## Firebase Indexes

הוסף לקובץ `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "verifiedVoters",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "codeId", "order": "ASCENDING" },
        { "fieldPath": "phone", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "verificationCodes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "codeId", "order": "ASCENDING" },
        { "fieldPath": "phone", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "votes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "voterId", "order": "ASCENDING" },
        { "fieldPath": "categoryId", "order": "ASCENDING" },
        { "fieldPath": "round", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**פריסה:**
```bash
firebase deploy --only firestore:indexes
```

---

## API Endpoints

### POST /api/verification/send

שולח קוד OTP למספר טלפון.

**Request:**
```typescript
{
  phone: string;      // מספר טלפון (ישראלי)
  codeId: string;     // ID של החוויה
  maxVotes?: number;  // מקסימום הצבעות (ברירת מחדל: 1)
}
```

**Response (Success):**
```typescript
{
  success: true;
  method: 'whatsapp' | 'sms';
  expiresIn: 300;  // שניות
}
```

**Response (Error):**
```typescript
{
  error: string;
  errorCode: 'INVALID_PHONE' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' |
             'ALREADY_VOTED' | 'ALREADY_VOTED_ALL';
}
```

**קובץ:** `src/app/api/verification/send/route.ts`

---

### POST /api/verification/verify

מאמת קוד OTP.

**Request:**
```typescript
{
  phone: string;   // מספר טלפון
  code: string;    // קוד 6 ספרות
  codeId: string;  // ID של החוויה
}
```

**Response (Success):**
```typescript
{
  success: true;
  sessionToken: string;
  maxVotes: number;
  votesUsed: number;
  votesRemaining: number;
}
```

**Response (Error):**
```typescript
{
  error: string;
  errorCode: 'INVALID_CODE' | 'CODE_EXPIRED' | 'MAX_ATTEMPTS' |
             'NO_CODE_FOUND';
  attemptsRemaining?: number;
}
```

**קובץ:** `src/app/api/verification/verify/route.ts`

---

### POST /api/qvote/vote (עם אימות)

שליחת הצבעה עם אימות טלפון.

**Request:**
```typescript
{
  codeId: string;
  voterId: string;
  candidateIds: string[];
  round?: number;
  categoryId?: string;
  phone: string;         // נדרש אם verification enabled
  sessionToken: string;  // נדרש אם verification enabled
}
```

**Response (Error Codes):**
- `VERIFICATION_REQUIRED` - נדרש אימות
- `NOT_VERIFIED` - הטלפון לא מאומת
- `INVALID_SESSION` - session לא תקין
- `SESSION_EXPIRED` - session פג תוקף
- `VOTE_LIMIT_REACHED` - נגמרו ההצבעות
- `ALREADY_VOTED_CATEGORY` - כבר הצביע בקטגוריה זו

**קובץ:** `src/app/api/qvote/vote/route.ts`

---

## Frontend Components

### PhoneVerificationModal

קומפוננטת React לאימות טלפון.

**קובץ:** `src/components/modals/PhoneVerificationModal.tsx`

**Props:**
```typescript
interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (session: VerificationSession) => void;
  codeId: string;
  locale?: 'he' | 'en';
  maxVotes?: number;
  totalCategories?: number;  // לבדיקת ALREADY_VOTED_ALL
}

interface VerificationSession {
  phone: string;
  sessionToken: string;
  votesRemaining: number;
}
```

**שימוש:**
```tsx
import PhoneVerificationModal from '@/components/modals/PhoneVerificationModal';

// בקומפוננטה:
const [showVerification, setShowVerification] = useState(false);
const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);

<PhoneVerificationModal
  isOpen={showVerification}
  onClose={() => setShowVerification(false)}
  onVerified={(session) => {
    setVerificationSession(session);
    setShowVerification(false);
  }}
  codeId={codeId}
  locale={locale}
  maxVotes={config.verification?.maxVotesPerPhone || 1}
  totalCategories={config.categories?.length || 0}
/>
```

---

## איך להוסיף אימות לחוויה חדשה

### שלב 1: הגדרת Config

הוסף לטייפ של החוויה:

```typescript
// src/types/your-experience.ts

interface YourExperienceConfig {
  // ... שדות אחרים

  verification?: {
    enabled: boolean;
    maxVotesPerPhone?: number;  // ברירת מחדל: 1
  };
}
```

### שלב 2: הוספת UI להפעלת אימות

בקומפוננטת ההגדרות:

```tsx
// Toggle להפעלת אימות
<label className="flex items-center gap-3">
  <input
    type="checkbox"
    checked={config.verification?.enabled || false}
    onChange={(e) => setConfig({
      ...config,
      verification: {
        ...config.verification,
        enabled: e.target.checked,
      }
    })}
  />
  <span>{locale === 'he' ? 'דרוש אימות טלפון' : 'Require phone verification'}</span>
</label>

{config.verification?.enabled && (
  <div>
    <label>{locale === 'he' ? 'מקסימום פעולות לטלפון' : 'Max actions per phone'}</label>
    <input
      type="number"
      min={1}
      value={config.verification.maxVotesPerPhone || 1}
      onChange={(e) => setConfig({
        ...config,
        verification: {
          ...config.verification,
          maxVotesPerPhone: parseInt(e.target.value),
        }
      })}
    />
  </div>
)}
```

### שלב 3: שילוב ב-Viewer

```tsx
// src/components/viewer/YourExperienceViewer.tsx

import PhoneVerificationModal from '@/components/modals/PhoneVerificationModal';

// State
const [showVerification, setShowVerification] = useState(false);
const [verificationSession, setVerificationSession] = useState<{
  phone: string;
  sessionToken: string;
  votesRemaining: number;
} | null>(null);

// בדיקה אם נדרש אימות לפני פעולה
const handleAction = async () => {
  if (config.verification?.enabled && !verificationSession) {
    setShowVerification(true);
    return;
  }

  // המשך לפעולה עם session
  await submitAction({
    ...data,
    phone: verificationSession?.phone,
    sessionToken: verificationSession?.sessionToken,
  });
};

// Render
return (
  <>
    {/* ... תוכן החוויה */}

    <PhoneVerificationModal
      isOpen={showVerification}
      onClose={() => setShowVerification(false)}
      onVerified={(session) => {
        setVerificationSession(session);
        setShowVerification(false);
      }}
      codeId={codeId}
      locale={locale}
      maxVotes={config.verification?.maxVotesPerPhone || 1}
    />
  </>
);
```

### שלב 4: עדכון ה-API

ב-API route של החוויה, הוסף בדיקת אימות:

```typescript
// src/app/api/your-experience/action/route.ts

import { getAdminDb } from '@/lib/firebase-admin';
import { normalizePhoneNumber } from '@/lib/phone-utils';

export async function POST(request: NextRequest) {
  const { codeId, phone, sessionToken, ...data } = await request.json();

  const db = getAdminDb();

  // קבל config של החוויה
  const codeDoc = await db.collection('codes').doc(codeId).get();
  const codeData = codeDoc.data();
  const config = codeData?.media?.find(m => m.type === 'your-experience')?.config;

  // בדוק אם אימות מופעל
  if (config?.verification?.enabled) {
    if (!phone || !sessionToken) {
      return NextResponse.json(
        { error: 'Phone verification required', errorCode: 'VERIFICATION_REQUIRED' },
        { status: 401 }
      );
    }

    // נרמל טלפון ובדוק session
    const normalizedPhone = normalizePhoneNumber(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const verifiedVoterId = `${codeId}_${phoneDigits}`;
    const voterDoc = await db.collection('verifiedVoters').doc(verifiedVoterId).get();

    if (!voterDoc.exists) {
      return NextResponse.json(
        { error: 'Phone not verified', errorCode: 'NOT_VERIFIED' },
        { status: 401 }
      );
    }

    const voterData = voterDoc.data();

    // בדוק session token
    if (voterData?.sessionToken !== sessionToken) {
      return NextResponse.json(
        { error: 'Invalid session', errorCode: 'INVALID_SESSION' },
        { status: 401 }
      );
    }

    // בדוק תפוגת session
    const sessionExpiresAt = voterData?.sessionExpiresAt?.toDate();
    if (!sessionExpiresAt || new Date() > sessionExpiresAt) {
      return NextResponse.json(
        { error: 'Session expired', errorCode: 'SESSION_EXPIRED' },
        { status: 401 }
      );
    }

    // בדוק מגבלת פעולות
    const actionsUsed = voterData?.votesUsed || 0;
    const maxActions = voterData?.maxVotes || 1;
    if (actionsUsed >= maxActions) {
      return NextResponse.json(
        { error: 'Action limit reached', errorCode: 'LIMIT_REACHED' },
        { status: 403 }
      );
    }

    // הגדל מונה פעולות
    await db.collection('verifiedVoters').doc(verifiedVoterId).update({
      votesUsed: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // המשך לביצוע הפעולה...
}
```

---

## Rate Limiting

המערכת משתמשת ב-Firestore-based rate limiting (לא in-memory) כי:
- עובד עם serverless (Vercel)
- שומר על מצב בין instances
- מונע race conditions עם transactions

**הגדרות:**
- חלון זמן: 15 דקות
- מקסימום בקשות: 3 לכל טלפון
- OTP תקף ל: 5 דקות
- מקסימום ניסיונות: 3

**קובץ:** `src/lib/verification.ts`

---

## Tablet/Kiosk Mode

מצב מיוחד לטאבלטים בעמדות הצבעה.

**תכונות:**
- איפוס אוטומטי אחרי X שניות
- מחיקת session אחרי כל הצבעה
- תמיכה בקטגוריות מרובות

**הגדרות:**
```typescript
tabletMode?: {
  enabled: boolean;
  resetDelaySeconds?: number;  // ברירת מחדל: 5
}
```

**Flow:**
1. משתמש מאמת טלפון
2. מצביע בקטגוריה/ות
3. הודעת תודה עם ספירה לאחור
4. איפוס אוטומטי - מוחק session, מאפס state
5. מוכן למצביע הבא

---

## ספריות עזר

### phone-utils.ts

```typescript
// src/lib/phone-utils.ts

// נרמול מספר טלפון לפורמט ישראלי
export function normalizePhoneNumber(phone: string): string {
  // הסר תווים שאינם ספרות
  let digits = phone.replace(/\D/g, '');

  // טפל בקידומות
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('+972')) {
    digits = '0' + digits.slice(4);
  } else if (!digits.startsWith('0')) {
    digits = '0' + digits;
  }

  return digits;
}

// וולידציה של מספר טלפון ישראלי
export function isValidIsraeliPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^05\d{8}$/.test(normalized);
}
```

### inforu.ts

```typescript
// src/lib/inforu.ts

// שליחת הודעת WhatsApp
export async function sendWhatsApp(phone: string, message: string): Promise<boolean>;

// שליחת SMS
export async function sendSMS(phone: string, message: string): Promise<boolean>;

// שליחת OTP (WhatsApp first, fallback to SMS)
export async function sendOTP(phone: string, code: string): Promise<{
  success: boolean;
  method: 'whatsapp' | 'sms';
}>;
```

---

## Troubleshooting

### "Missing or insufficient permissions"
- וודא שה-security rules נפרסו: `firebase deploy --only firestore:rules`

### "Failed to send OTP"
- בדוק שמשתני INFORU_USERNAME ו-INFORU_API_TOKEN מוגדרים
- בדוק שיש קרדיט ב-INFORU

### "Index not found"
- פרוס indexes: `firebase deploy --only firestore:indexes`

### Rate limit לא עובד
- וודא שה-collection `rateLimits` קיים ב-Firestore
- בדוק את ה-security rules

---

## קבצים רלוונטיים

| קובץ | תיאור |
|------|--------|
| `src/app/api/verification/send/route.ts` | API לשליחת OTP |
| `src/app/api/verification/verify/route.ts` | API לאימות OTP |
| `src/components/modals/PhoneVerificationModal.tsx` | UI Modal |
| `src/lib/verification.ts` | פונקציות עזר לאימות |
| `src/lib/inforu.ts` | אינטגרציה עם INFORU |
| `src/lib/phone-utils.ts` | נרמול טלפונים |
| `firestore.rules` | Security rules |
| `firestore.indexes.json` | Indexes |

---

*מסמך זה נוצר ב-2026-01-07 ומתעד את מערכת אימות הטלפון של Q.Vote.*
