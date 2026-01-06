# Q.Vote Security & Stability Checklist

> תיעוד משימות אבטחה ויציבות למערכת אימות הטלפון
> נוצר: 2026-01-06

---

## סטטוס כללי

| קטגוריה | סטטוס |
|---------|--------|
| אבטחה בסיסית | ✅ מיושם |
| Rate Limiting | ✅ מיושם (Firestore) |
| Environment Variables | ✅ מוגדר |
| Firebase Indexes | ✅ נפרס |
| סקייל לאירועים גדולים | 🟡 אופציונלי |

---

## 🔴 עדיפות גבוהה (חובה)

### 1. [x] הגדרת OTP_HASH_SALT

**למה זה חשוב:** בלי salt ייחודי, התוקף יכול ליצור rainbow table לקודים.

**מה לעשות:**
```bash
# הוסף ל-.env.local:
OTP_HASH_SALT=93cb36fba2cdc3239081eeafc87d4815f4b933ce4fdfcfddcfc2dc4c0378e68d
```

> ⚠️ **שים לב:** ה-salt למעלה נוצר ספציפית עבורך. אל תשתמש בו בפרויקט אחר!

**קובץ:** `.env.local`
**סטטוס:** ✅ הושלם

---

### 2. [x] פריסת Firebase Indexes

**למה זה חשוב:** השאילתות יכשלו בלי indexes.

**מה לעשות:**
```bash
firebase deploy --only firestore:indexes
```

**קובץ:** `firestore.indexes.json` (כבר מוגדר עם כל האינדקסים הנדרשים)
**סטטוס:** ✅ הושלם

---

### 3. [x] Rate Limiting מבוסס Firestore

**למה זה חשוב:** Rate limiting בזיכרון לא עובד ב-serverless/multiple instances.

**מה נעשה:** העברת rate limiting ל-Firestore collection.

**קבצים שהשתנו:**
- `src/app/api/verification/send/route.ts`

**סטטוס:** ✅ מיושם

---

## 🟡 עדיפות בינונית (מומלץ)

### 4. [ ] הוספת CAPTCHA

**למה זה חשוב:** מונע בוטים משליחת OTP המונית.

**אפשרויות:**
- Google reCAPTCHA v3 (חינם)
- Cloudflare Turnstile (חינם, privacy-friendly)

**קבצים לשנות:**
- `src/components/modals/PhoneVerificationModal.tsx`
- `src/app/api/verification/send/route.ts`

**סטטוס:** ⏳ ממתין

---

### 5. [x] Monitoring & Alerts

**למה זה חשוב:** לדעת על בעיות לפני שהמשתמשים מדווחים.

**מה הוגדר:**
1. Firebase Console > Alerts - פעיל
2. Cloud Firestore insecure rules alert - פעיל
3. Cloud Firestore expiring rules alert - פעיל

**סטטוס:** ✅ מוגדר

---

### 6. [ ] IP-based Rate Limiting

**למה זה חשוב:** שכבת הגנה נוספת מפני התקפות.

**קבצים לשנות:**
- `src/app/api/verification/send/route.ts`
- `src/middleware.ts` (אופציונלי)

**סטטוס:** ⏳ ממתין

---

## 🟢 עדיפות נמוכה (לסקייל גדול)

### 7. [ ] Redis/Upstash ל-Rate Limiting

**למה זה חשוב:** ביצועים טובים יותר מ-Firestore לאירועים גדולים מאוד.

**הערה:** Firestore מספיק לרוב האירועים (עד ~10,000 משתתפים).

**סטטוס:** ⏳ ממתין (אופציונלי)

---

### 8. [ ] Connection Pooling

**למה זה חשוב:** מפחית latency בעומס גבוה.

**סטטוס:** ⏳ ממתין (אופציונלי)

---

## 📋 Environment Variables נדרשים

```env
# חובה - אבטחה
OTP_HASH_SALT=<random-32-chars>

# חובה - INFORU
INFORU_API_USER=your_username
INFORU_API_TOKEN=Basic xxxxx
INFORU_SENDER_ID=QVote

# אופציונלי - Templates
INFORU_WHATSAPP_TEMPLATE_HE=234887
INFORU_WHATSAPP_TEMPLATE_EN=234889

# אופציונלי - CAPTCHA (אם מיישמים)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=xxx
RECAPTCHA_SECRET_KEY=xxx
```

---

## 🧪 בדיקות לפני אירוע

- [ ] שלח OTP לטלפון אמיתי
- [ ] ודא שהקוד מתקבל תוך 30 שניות
- [ ] בדוק rate limiting (שלח 4 בקשות מהירות)
- [ ] בדוק חסימה אחרי 5 ניסיונות שגויים
- [ ] בדוק session expiry (24 שעות)
- [ ] בדוק הצבעה לקטגוריות שונות

---

## 📊 מדדים לניטור

| מדד | ערך תקין | התראה |
|-----|----------|--------|
| OTP success rate | > 95% | < 90% |
| Verify success rate | > 80% | < 70% |
| Avg response time | < 2s | > 5s |
| Error rate | < 1% | > 5% |

---

## 📝 היסטוריית שינויים

| תאריך | שינוי | סטטוס |
|-------|-------|--------|
| 2026-01-06 | יצירת מסמך | ✅ |
| 2026-01-06 | Rate limiting ל-Firestore | ✅ |
| 2026-01-06 | הוספת קוד Rate Limiting ל-send/route.ts | ✅ |
| 2026-01-06 | יצירת OTP_HASH_SALT | ✅ |
| 2026-01-06 | הגדרת OTP_HASH_SALT ב-.env.local | ✅ |
| 2026-01-06 | פריסת Firebase Indexes | ✅ |
| 2026-01-06 | הגדרת התראות Firebase | ✅ |
| | | |

---

*מסמך זה נוצר אוטומטית ויש לעדכן אותו עם השלמת כל משימה.*
