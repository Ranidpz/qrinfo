// App version - update this when making important changes
export const APP_VERSION = '1.18.5';

// Changelog for user notifications
export interface VersionUpdate {
  version: string;
  date: string;
  highlights: {
    he: string[];
    en: string[];
  };
  isNew?: boolean;
}

export const CHANGELOG: VersionUpdate[] = [
  {
    version: '1.18.5',
    date: '2026-07-14',
    isNew: true,
    highlights: {
      he: [
        'הימור: אחרי פרסום התוצאה, הזוכים מוצגים בראש רשימת הנרשמים בצבע זהב ובמספור לפי סדר הניחוש (מספר 1 = ניחש נכון ראשון, המנצח בתיקו)',
      ],
      en: [
        'Match Bet: once the result is published, winners are pinned to the top of the registrants list in gold and numbered by prediction time (No. 1 = predicted the exact score first, the tiebreak winner)',
      ],
    },
  },
  {
    version: '1.18.4',
    date: '2026-07-14',
    isNew: false,
    highlights: {
      he: [
        'הימור: קונפטי חגיגי שנופל פעם אחת על מסך ״ההימור נקלט!״ — פוף בהצלחה אחרי שליחת הניחוש',
      ],
      en: [
        'Match Bet: a one-shot celebratory confetti burst on the "bet received!" screen after a bet is placed',
      ],
    },
  },
  {
    version: '1.18.3',
    date: '2026-07-14',
    isNew: false,
    highlights: {
      he: [
        'הימור: כל מסך נפתח תמיד מלמעלה במעבר בין השלבים (למשל אחרי שליחת ההימור) — אין צורך לגלול חזרה למעלה',
      ],
      en: [
        'Match Bet: every step now always opens from the top when moving between screens (e.g. after placing a bet) — no need to scroll back up',
      ],
    },
  },
  {
    version: '1.18.2',
    date: '2026-07-14',
    isNew: false,
    highlights: {
      he: [
        'הימור: שופרה הנפשת הפתיחה — הדגלים קופצים פנימה אחד אחרי השני ואז שאר הפרטים עולים מלמטה, בלי תזוזה צדדית; תוקנה קפיצה חוזרת של הדגלים בזמן שימוש',
        'הימור: אייקון החלפת שפה נקי (בלי טקסט), וקישור ״לתקנון המלא״ שמופיע מתחת לשורת ההסכמה אם מוגדר קישור בהגדרות',
      ],
      en: [
        'Match Bet: a smoother entrance — flags bounce in one after another, then the rest rises up from below (no side-slide); fixed the flags re-animating during use',
        'Match Bet: a clean icon-only language switch, and a "read the full regulations" link under the consent line when a URL is set in the settings',
      ],
    },
  },
  {
    version: '1.18.1',
    date: '2026-07-13',
    isNew: false,
    highlights: {
      he: [
        'הימור: דף הנחיתה נפתח באנימציה — זום איטי לתמונת הרקע, לוגו וכפתור שנכנסים בהדרגה, ומעבר חלק בין השלבים',
        'הימור: מתג החלפת שפה (עברית/אנגלית) שנפתח אוטומטית לפי שפת הדפדפן, עם דגלים גדולים יותר ושמות קבוצות מתורגמים',
        'הימור: נעילה אוטומטית לפי שעת תחילת המשחק (מספר דקות אחרי השריקה), מתג לאפשר או לחסום שינוי הימור, ושורת הסכמה לשמירת הטלפון הניתנת לעריכה',
        'הימור: ברשימת הנרשמים — לחיצה על המספר פותחת וואטסאפ, ומוצגת שעת שליחת הניחוש',
      ],
      en: [
        'Match Bet: the landing page now animates in — a slow background zoom, logo and button easing in, and smooth transitions between steps',
        'Match Bet: a language switch (Hebrew/English) that opens in the browser language, with bigger flags and translated team names',
        'Match Bet: automatic lock by kickoff time (minutes after the whistle), a toggle to allow or block changing a bet, and an editable consent line for storing the phone number',
        'Match Bet: in the registrants list — tap a number to open WhatsApp, and see when each bet was submitted',
      ],
    },
  },
  {
    version: '1.18.0',
    date: '2026-07-13',
    isNew: false,
    highlights: {
      he: [
        'חדש: חוויית "הימור" — דף נחיתה עם פוסטר ולוגו, הרשמה עם אימות וואטסאפ, וניחוש תוצאת משחק כדורגל עם דגלי המדינות',
        'הזוכים (ניחוש מדויק) מסומנים אוטומטית, מיוצאים לאקסל, וניתן ליצור מהם הגרלה על מסך ענק בלחיצה',
        'כפתור קריאה-לפעולה מונפש עם גרדיאנט צבעים מתכוונן, וצבעי רקע/טקסט לעיצוב הדף; גרירת תמונות תומכת גם ב-AVIF',
      ],
      en: [
        'New: "Match Bet" experience — a poster landing page with logo, WhatsApp-verified registration, and football score prediction with country flags',
        'Exact-score winners are auto-flagged, exported to Excel, and can be turned into a big-screen raffle in one click',
        'Animated call-to-action button with a configurable color gradient, plus background/text colors; image drop supports AVIF too',
      ],
    },
  },
  {
    version: '1.17.7',
    date: '2026-07-01',
    isNew: false,
    highlights: {
      he: [
        'סלפי בים: תוקנה תקלת העלאת תמונות מאייפונים ישנים (iOS 16 ומטה) — הצילום נשמר עכשיו בפורמט תואם כשאין תמיכה ב-WebP, כך שהלינק לצלם ולינק ההעלאה עובדים מכל טלפון',
        'סלפי בים: כל תמונה נשמרת קלה (תקרת משקל אוטומטית) כדי שמסך הבים יחזיק מאות תמונות בלי להכביד',
        'סלפי בים: התמונה שצולמה מופיעה מיד אחרי ההעלאה (בלי ריבוע ריק של כמה שניות שהמתין להורדה מהשרת)',
      ],
      en: [
        'Selfie Beam: fixed photo-upload failures from older iPhones (iOS 16 and below) — the capture now saves in a compatible format when WebP is unsupported, so the photographer link and upload link work from any phone',
        'Selfie Beam: every photo is kept lightweight (automatic size cap) so the beam screen can hold hundreds of photos without lag',
        'Selfie Beam: a captured photo now shows instantly after upload (no empty box waiting a few seconds for the server copy to download)',
      ],
    },
  },
  {
    version: '1.17.4',
    date: '2026-06-29',
    isNew: false,
    highlights: {
      he: [
        'מסך הבים: רנדומיזציה חכמה — כשיש פחות תמונות ממספר התאים, התמונות מתפזרות שווה ואף שתי תמונות זהות לא יוצגו צמודות זו לזו (גם כשמוכרחים לחזור על תמונות)',
        'מסך הבים: הגדרה חדשה בפאנל — כמה תמונות מתחלפות בכל פעם (1–4), לתחושת תנועה חיה יותר',
      ],
      en: [
        'Beam screen: smarter randomization — when there are fewer photos than cells, they spread out evenly and no two identical photos ever sit side by side (even when repeats are unavoidable)',
        'Beam screen: a new panel setting for how many photos swap at once (1–4), for a livelier feel',
      ],
    },
  },
  {
    version: '1.17.3',
    date: '2026-06-29',
    isNew: false,
    highlights: {
      he: [
        'סלפי בים (עורך): מחיקת תמונה דורשת עכשיו אישור (מודאל עם תצוגת התמונה) — כדי שלא יימחקו תמונות בלחיצה בטעות',
      ],
      en: [
        'Selfie Beam (editor): deleting a photo now asks for confirmation (a modal with a preview of the photo) — so photos are not removed by an accidental click',
      ],
    },
  },
  {
    version: '1.17.2',
    date: '2026-06-29',
    isNew: false,
    highlights: {
      he: [
        'מסך הבים (סלפי בים): גלגל ההגדרות עבר אל תוך ההדר העליון (השם מימין, הגלגל משמאל) ונסתר יחד עם הכותרת — כך שאפשר להסתיר אותו מהמסך הגדול באירוע ולהשאיר תצוגה נקייה',
      ],
      en: [
        'Beam screen (Selfie Beam): the settings gear moved into the top header (title right, gear left) and now hides together with the title — so it can be kept off the big event screen for a clean display',
      ],
    },
  },
  {
    version: '1.17.1',
    date: '2026-06-29',
    isNew: false,
    highlights: {
      he: [
        'סלפי בים: לינק שנפתח בתוך וואטסאפ/אינסטגרם/פייסבוק מזוהה אוטומטית — מופיע מסך "פתחו בדפדפן" שמונע תקיעות בהעלאת תמונות (במיוחד בלינק הצלם באייפון)',
        'המסך מציע פתיחה בדפדפן בלחיצה אחת, העתקת קישור כגיבוי, ואפשרות "המשיכו כאן בכל זאת" למי שרק צופה',
      ],
      en: [
        'Selfie Beam: a link opened inside WhatsApp/Instagram/Facebook is now auto-detected — an "open in browser" screen prevents photo-upload failures (especially the photographer link on iPhone)',
        'The screen offers one-tap open-in-browser, copy-link as a fallback, and a "continue anyway" option for viewers',
      ],
    },
  },
  {
    version: '1.17.0',
    date: '2026-06-29',
    isNew: false,
    highlights: {
      he: [
        'מסך הבים (סלפי בים): פאנל הגדרות נגרר חדש שנפתח מגלגל שיניים על המסך — כוונון עמודות, מהירות החלפה, גודל דגל, עיגול פינות, תנועה, שמות ועוד, עם תצוגה חיה',
        'ההגדרות נשמרות מקומית לכל מסך בנפרד (בדפדפן שעליו עובדים), עם כפתור איפוס חזרה למה שהוגדר בעורך',
        'כותרת הבים מקושרת לדף עריכת החוויה (נפתחת בלשונית חדשה כדי לא לקטוע את התצוגה; מי שאינו מחובר מועבר להתחברות)',
      ],
      en: [
        'Beam screen (Selfie Beam): a new draggable settings panel opened from an on-screen gear — tune columns, swap speed, flag size, corner radius, motion, names and more, with live preview',
        'Settings are saved locally per screen (the browser you work on), with a Reset button back to the editor defaults',
        'The beam title now links to the experience editor (opens in a new tab so the display keeps running; signed-out viewers are sent to login)',
      ],
    },
  },
  {
    version: '1.16.2',
    date: '2026-06-25',
    isNew: false,
    highlights: {
      he: [
        'סלפי בים (עורך): כפתורי הפעולה על כל תמונה — כולל עריכת דגל ומחיקה — נחתכו בכרטיסים צרים. תוקן: הם עוברים עכשיו לשתי שורות ונגישים תמיד',
      ],
      en: [
        'Selfie Beam (editor): per-photo action buttons — including flag editing and delete — were clipped on narrow cards. Fixed: they now wrap to a second row and are always reachable',
      ],
    },
  },
  {
    version: '1.16.1',
    date: '2026-06-25',
    isNew: false,
    highlights: {
      he: [
        'מצב צלם: אפליקציה מותקנת (PWA) מלינק הצלם נפתחת עכשיו כצלם עם העלאות ללא הגבלה — לא כמשתמש רגיל',
        'מצב צלם: מתג "רק צלם" — אפשר להגביל שרק לינק הצלם יעלה תמונות, בעוד הלינק הציבורי מציג את החוויה בלי כפתור העלאה',
        'מצב צלם: אינדיקטור "מציג 8 אחרונות מתוך N" כשמעלים הרבה תמונות',
      ],
      en: [
        'Photographer mode: an installed PWA from the photographer link now opens as a photographer with unlimited uploads — not as a regular user',
        'Photographer mode: a "photographer only" toggle restricts uploads to the photographer link, while the public link shows the experience without an upload button',
        'Photographer mode: a "showing last 8 of N" indicator when many photos are uploaded',
      ],
    },
  },
  {
    version: '1.16.0',
    date: '2026-06-25',
    isNew: false,
    highlights: {
      he: [
        'סלפי בים: כל מי שמעלה תמונה יכול לבחור מדינה (חיפוש עם השלמה אוטומטית), ודגל קטן מופיע על התמונה במסך הגדול',
        'סלפי בים: סליידר לגודל הדגל (עד פי 4) בהגדרות הבים',
        'סלפי בים: "מצב צלם" — לינק נפרד לצלם שטח עם העלאות ללא הגבלה, זוכר את המדינה האחרונה ומדלג על השם. הלינק הציבורי נשאר מוגבל',
        'סלפי בים: בלינק הצלם לחיצה על תמונה פותחת עריכה — החלפת תמונה, שינוי שם ודגל, ומחיקה עם אישור',
        'סלפי בים: עריכת דגל מדינה לכל תמונה בעורך הניהול; כל ההעלאות נשמרות ב-Cloudflare R2 בתיקיית הבעלים לפי שם האירוע, בפורמט WebP קל',
      ],
      en: [
        'Selfie Beam: anyone uploading a photo can pick a country (autocomplete search), and a small flag appears on the photo on the big screen',
        'Selfie Beam: a flag-size slider (up to 4x) in the beam settings',
        'Selfie Beam: "Photographer mode" — a separate staff link with unlimited uploads that remembers the last country and skips the name. The public link stays capped',
        'Selfie Beam: in the photographer link, tap a photo to edit it — replace the photo, change name and flag, or delete with confirmation',
        'Selfie Beam: per-photo country-flag editing in the admin editor; all uploads now go to Cloudflare R2 in the owner\'s folder by event name, as lightweight WebP',
      ],
    },
  },
  {
    version: '1.15.0',
    date: '2026-06-01',
    isNew: false,
    highlights: {
      he: [
        'לינק: נוספו סוגי קישור לאינסטגרם ולפייסבוק — הסורקים מועברים ישירות לעמוד שלכם, עם האייקון המתאים על כרטיס החוויה',
        'יצירת חוויה: עכשיו חובה לתת שם לחוויה לפני היצירה — אין יותר חוויות שנוצרות עם שם ברירת מחדל כמו "לינק" או "הגרלה"',
      ],
      en: [
        'Link: added Instagram and Facebook link types — scanners go straight to your page, with the matching icon on the experience card',
        'Create experience: you must now name an experience before creating it — no more items created with default names like "Link" or "Raffle"',
      ],
    },
  },
  {
    version: '1.14.4',
    date: '2026-06-01',
    highlights: {
      he: [
        'סלפי בים: כפתורי הפעולה על כל תמונה אורגנו לפאנל קומפקטי בתחתית, עם הסברים ברורים בריחוף',
        'סלפי בים: גרירת תמונה מעל תמונה קיימת מחליפה אותה — עם אישור, והתמונה הישנה נמחקת מהאחסון',
      ],
      en: [
        'Selfie Beam: per-photo action buttons reorganized into a compact bottom panel with clear hover hints',
        'Selfie Beam: drag a photo onto an existing one to replace it — with confirmation, and the old photo is removed from storage',
      ],
    },
  },
  {
    version: '1.14.3',
    date: '2026-06-01',
    highlights: {
      he: [
        'סלפי בים: זיהוי כפילויות אוטומטי בגרירת תמונות — מעלה רק חדשות (לפי תוכן הקובץ), עם תצוגה מקדימה ואפשרות "העלה בכל זאת"',
        'סלפי בים: כפתור "הקפצה" שמחזיר תמונה ישנה למסך, ופין שמשאיר לוגו/תמונה תמיד על המסך הגדול',
        'סלפי בים: מחיקת תמונות מפנה מקום אחסון בחזרה למשתמש, ומחיקה מרובה דורשת אישור',
      ],
      en: [
        'Selfie Beam: automatic duplicate detection on drag-drop — uploads only new photos (by file content), with previews and an "upload anyway" option',
        'Selfie Beam: a "boost" button re-surfaces an old photo, and pinning keeps a logo/photo always on the big screen',
        'Selfie Beam: deleting photos reclaims storage quota, and bulk delete now asks for confirmation',
      ],
    },
  },
  {
    version: '1.14.2',
    date: '2026-05-31',
    highlights: {
      he: [
        'הגרלה: כפתור "מחיקת כל נתוני ההגרלה" בעורך — מוחק לצמיתות משתתפים וזוכים, עם אישור בהקלדת "מחיקה"',
      ],
      en: [
        'Raffle: a "delete all raffle data" action in the editor — permanently removes participants and winners, with type-to-confirm',
      ],
    },
  },
  {
    version: '1.14.1',
    date: '2026-05-31',
    isNew: false,
    highlights: {
      he: [
        'שיפור: רשימת הזוכים במסך ההגרלה נטענת מהשרת — רענון באמצע אירוע כבר לא מאבד את הזוכים',
      ],
      en: [
        'Improvement: The big-screen winners list now loads from the server — a mid-event refresh no longer loses winners',
      ],
    },
  },
  {
    version: '1.14.0',
    date: '2026-05-31',
    isNew: false,
    highlights: {
      he: [
        'חדש: חוויית "הגרלה" — מסך ענק להגרלת שמות באירועים, עם גלגל מונפש וצלילים',
        'טעינת משתתפים מ-Excel עם דוח כפילויות, וטבלת ניהול (עריכה/מחיקה/חיפוש/וואטסאפ)',
        'הגרלה אטומית בשרת ולינק ציבורי מאובטח — שמות בלבד, בלי חשיפת טלפונים',
      ],
      en: [
        'New: "Raffle" experience — big-screen name draw for events, with an animated wheel and sounds',
        'Excel participant import with a duplicates report, plus a management table (edit/delete/search/WhatsApp)',
        'Atomic server-side draw and a secure public link — names only, phone numbers never exposed',
      ],
    },
  },
  {
    version: '1.13.59',
    date: '2026-05-24',
    isNew: false,
    highlights: {
      he: [
        'תיקון: תג האחסון בדשבורד מזהה R2 גם לפי כתובת הקובץ ושומר את שדות האחסון בהחלפת PDF',
      ],
      en: [
        'Fix: Dashboard storage badge now detects R2 by file URL and preserves storage metadata on PDF replacement',
      ],
    },
  },
  {
    version: '1.13.58',
    date: '2026-05-24',
    isNew: false,
    highlights: {
      he: [
        'תיקון: החלפת PDF דרך הדשבורד מזהה קבצי PDF בצורה קשיחה יותר כדי שהעלאות חדשות יישמרו ב-R2',
      ],
      en: [
        'Fix: Dashboard PDF replacements now detect PDFs more reliably so new uploads stay on R2',
      ],
    },
  },
  {
    version: '1.13.57',
    date: '2026-05-24',
    isNew: false,
    highlights: {
      he: [
        'חדש: תג קטן בדשבורד מציג אם הקובץ שמור ב-R2 או ב-Blob',
      ],
      en: [
        'New: Small dashboard badge shows whether a file is stored in R2 or Blob',
      ],
    },
  },
  {
    version: '1.13.56',
    date: '2026-05-24',
    isNew: false,
    highlights: {
      he: [
        'תיקון: מיגרציית חוברות פתאל מזהה כברירת מחדל את הספריות פתאל אילת, פתאל ים המלח ופתאל טבריה',
      ],
      en: [
        'Fix: Fattal booklet migration now defaults to the Fattal Eilat, Dead Sea, and Tiberias folders',
      ],
    },
  },
  {
    version: '1.13.55',
    date: '2026-05-24',
    isNew: false,
    highlights: {
      he: [
        'חדש: חוברות PDF יכולות להישמר ב-Cloudflare R2 במקום Vercel Blob',
        'חדש: הכנה למיגרציה בטוחה של חוברות פתאל עם שמירת ספירת אחסון לכל משתמש',
        'שיפור: תמיכה במחיקת קבצים גם מ-R2 וגם מ-Vercel Blob כדי לשמור תאימות לקבצים קיימים',
      ],
      en: [
        'New: PDF booklets can be stored in Cloudflare R2 instead of Vercel Blob',
        'New: Safe Fattal booklet migration groundwork with per-user storage accounting',
        'Improved: Delete support for both R2 and Vercel Blob to keep existing files compatible',
      ],
    },
  },
  {
    version: '1.13.54',
    date: '2026-05-12',
    isNew: false,
    highlights: {
      he: [
        'חדש: כפתור "עדכון זמין" צף במקום פופאפ אוטומטי — קומפקטי ולא חוסם',
        'חדש: זיהוי אוטומטי של גרסה חדשה גם כשהדף פתוח (בדיקה כל 5 דקות)',
        'שיפור: לחיצה על הכפתור מציגה מה התעדכן + רענון בלחיצה אחת',
      ],
      en: [
        'New: Floating "Update available" button instead of auto-popup — compact and non-blocking',
        'New: Live detection of new versions while page is open (5-minute polling)',
        'Improved: Click the button to see what changed + refresh in one click',
      ],
    },
  },
  {
    version: '1.13.53',
    date: '2026-05-12',
    isNew: false,
    highlights: {
      he: [
        'תיקון קריטי: חוברות PDF הציגו מסך שחור — תוקן גובה הקונטיינר של ה-FlipBook',
      ],
      en: [
        'Critical fix: PDF brochures showed black screen — fixed FlipBook container height',
      ],
    },
  },
  {
    version: '1.13.52',
    date: '2026-03-31',
    isNew: false,
    highlights: {
      he: [
        'תיקון: לוגו מופיע בהורדת QR (היה חסר בקובץ)',
        'חדש: בחירת צבע לקוד QR עצמו (לא רק הסימן)',
        'חדש: הורדת QR כקובץ SVG וקטורי לאיכות הדפסה מקסימלית',
        'שיפור: עיצוב מודל סימן QR — צבעים בשורה אחת, סלייידר מתחת לתצוגה',
        'שיפור: כפתורי יצירת חוויה קומפקטיים ורספונסיביים',
        'שיפור: הירו בדשבורד עם סלוגן ואייקונים, ניתן לסגירה',
        'שיפור: תיאור Q.Games עם כרטיסיות משחקים',
      ],
      en: [
        'Fix: logo now appears in QR download (was missing)',
        'New: QR code body color picker (not just the sign)',
        'New: SVG vector download for maximum print quality',
        'Improved: QR sign modal — colors in one row, slider below preview',
        'Improved: compact responsive experience creation buttons',
        'Improved: dashboard hero with slogan and icons, dismissable',
        'Improved: Q.Games description with game cards',
      ],
    },
  },
  {
    version: '1.13.51',
    date: '2026-03-08',
    isNew: false,
    highlights: {
      he: [
        'תיקון: נוכחות שחקנים ב-Frogger מתאוששת אחרי נפילת רשת',
        'תיקון: חזרה ללובי יוצרת חדר חדש נקי',
        'תיקון: כיסוי "הודחת" מוצג רק כשיש שחקנים פעילים',
      ],
      en: [
        'Fix: Frogger viewer presence recovers after network blip',
        'Fix: reset to lobby always creates a fresh room',
        'Fix: eliminated overlay only shown while other players are still alive',
      ],
    },
  },
  {
    version: '1.13.50',
    date: '2026-03-07',
    isNew: false,
    highlights: {
      he: [
        'חדש: הזמנת וואטסאפ מובילה ישר למשחק (לא לבורר)',
        'חדש: כרטיסי שיאים בלוח מובילים',
        'שיפור: פרוגי — חזרה ללובי אחרי סיום (לא לבורר משחקים)',
      ],
      en: [
        'New: WhatsApp invite leads directly to the game (not selector)',
        'New: Record holder cards in leaderboard',
        'Improvement: Frogger — return to lobby after game over (not game selector)',
      ],
    },
  },
  {
    version: '1.13.49',
    date: '2026-03-07',
    highlights: {
      he: [
        'חדש: מערכת שיאים — שיא הניקוד מוצג במשחק ובסיום',
        'חדש: חגיגת שיא חדש עם אנימציה זהובה',
      ],
      en: [
        'New: High score system — record displayed in-game and on game over',
        'New: New record celebration with golden animation',
      ],
    },
  },
  {
    version: '1.13.48',
    date: '2026-03-07',
    highlights: {
      he: [
        'שיפור: פרוגי — מסך סיום משחק מחודש עם אנימציות',
      ],
      en: [
        'Improvement: Frogger — redesigned game-over screen with animations',
      ],
    },
  },
  {
    version: '1.13.47',
    date: '2026-03-07',
    highlights: {
      he: [
        'שיפור: פרוגי — מסך VS עם תמונות שחקנים לפני המשחק',
      ],
      en: [
        'Improvement: Frogger — VS screen with player avatars before game',
      ],
    },
  },
  {
    version: '1.13.46',
    date: '2026-03-07',
    highlights: {
      he: [
        'תיקון: כפתור פתיחת חבילה נשאר פעיל אחרי פתיחה — תוקן',
      ],
      en: [
        'Fix: pack open button stayed active after opening — fixed',
      ],
    },
  },
  {
    version: '1.13.45',
    date: '2026-03-07',
    highlights: {
      he: [
        'תיקון: פרוגי — קפיצה כפולה תוקנה',
        'תיקון: פרוגי — המשחק נגמר כשכולם נפסלים',
        'חדש: פרוגי — כפתור חזרה למי שנפסל',
      ],
      en: [
        'Fix: Frogger — double jump fixed',
        'Fix: Frogger — game ends when all eliminated',
        'New: Frogger — back button for eliminated players',
      ],
    },
  },
  {
    version: '1.13.44',
    date: '2026-03-07',
    highlights: {
      he: [
        'שיפור: פרוגי — השחקן האחרון ממשיך לשחק עד שנפסל',
      ],
      en: [
        'Improvement: Frogger — last surviving player keeps playing until eliminated',
      ],
    },
  },
  {
    version: '1.13.43',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: משחק פרוגי — קפצו בין המכשולים! משחק אקשן מרובה שחקנים',
      ],
      en: [
        'New: Frogger game — jump through obstacles! Multiplayer action game',
      ],
    },
  },
  {
    version: '1.13.42',
    date: '2026-03-06',
    highlights: {
      he: [
        'שיפור: משחק זיכרון — הוראות "מימין לשמאל" ברורות',
        'שיפור: סימון ירוק על המשבצת הבאה למילוי',
      ],
      en: [
        'Improvement: Memory game — clear "right to left" instructions',
        'Improvement: Green highlight on the next slot to fill',
      ],
    },
  },
  {
    version: '1.13.41',
    date: '2026-03-06',
    highlights: {
      he: [
        'תיקון: פתיחת חבילה — שגיאה בפתיחת חבילה תוקנה',
      ],
      en: [
        'Fix: Pack opening error resolved',
      ],
    },
  },
  {
    version: '1.13.40',
    date: '2026-03-06',
    highlights: {
      he: [
        'תיקון: כותרת לידרבורד נשארת קבועה למעלה בגלילה (באמת)',
        'שיפור: היסטוריית משחקים נגללת יחד עם הלידרבורד',
      ],
      en: [
        'Fix: Leaderboard header actually stays fixed on scroll',
        'Improvement: Match history scrolls together with leaderboard',
      ],
    },
  },
  {
    version: '1.13.39',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: טבעת התקדמות חבילה — רואים כמה נשאר עד לחבילה הבאה',
        'שיפור: לידרבורד עם כותרת דביקה + פילטרים נשארים למעלה בגלילה',
        'שיפור: כפתור חזרה בצ\'אט חוזר למסך הקודם',
      ],
      en: [
        'New: Pack progress ring — see how close you are to the next pack',
        'Improvement: Leaderboard with sticky header + filters stay visible on scroll',
        'Improvement: Chat back button returns to previous screen',
      ],
    },
  },
  {
    version: '1.13.38',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: מודל שחקנים מחוברים — לחצו על מספר המחוברים לראות מי אונליין',
        'שיפור: תמונת פרופיל ושם מוצגים בנוכחות אונליין',
        'שיפור: סטטוס "משחק נגד..." לשחקנים במשחק פעיל',
      ],
      en: [
        'New: Online players modal — tap viewer count to see who\'s online',
        'Improvement: Profile photo and name shown in online presence',
        'Improvement: "Playing vs..." status for players in active matches',
      ],
    },
  },
  {
    version: '1.13.37',
    date: '2026-03-06',
    highlights: {
      he: [
        'שיפור: אנימציית slide-in למודל מידע',
        'שיפור: לידרבורד וצפייה במשחק Memory',
      ],
      en: [
        'Improvement: Slide-in animation for info modal',
        'Improvement: Leaderboard & viewer count in Memory game',
      ],
    },
  },
  {
    version: '1.13.36',
    date: '2026-03-06',
    highlights: {
      he: [
        'תיקון: מסך "התקינו כאפליקציה" לא קופץ יותר בדפדפן רגיל',
        'שיפור: כפתור מידע עבר לצד השני של הפרופיל',
        'שיפור: טקסט התקדמות דירוג גדול יותר + פס עבה עם אנימציה',
        'שיפור: כותרת המשחק גדולה וברורה יותר',
      ],
      en: [
        'Fix: "Install as App" screen no longer appears in regular browser',
        'Improvement: Info button moved to opposite side of profile',
        'Improvement: Rank progress text bigger + thicker bar with glow animation',
        'Improvement: Game title larger and more visible',
      ],
    },
  },
  {
    version: '1.13.35',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: כפתור התקנה כאפליקציה (PWA) במסך הרשמה',
        'חדש: הוראות התקנה למסך הבית - iOS ו-Android',
        'שיפור: אייקוני דירוג Lucide במקום אמוג\'י',
        'שיפור: אנימציית bounce לכרטיסי משחקים בבורר',
      ],
      en: [
        'New: Install as App (PWA) button on registration screen',
        'New: Home screen install instructions for iOS & Android',
        'Improvement: Lucide rank icons instead of emoji',
        'Improvement: Bounce animation for game cards in selector',
      ],
    },
  },
  {
    version: '1.13.34',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: מודל מידע על Q.Games עם לינק לפלטפורמה',
        'חדש: דירוגים בלוח מובילים + מונה מחוברים בצ\'אט',
        'חדש: מסך אינוונטורי לפרסים',
        'שיפור: בדג\' דירוג קומפקטי בבורר משחקים',
      ],
      en: [
        'New: Q.Games info modal with platform link',
        'New: Ranks in leaderboard + online count in chat',
        'New: Prize inventory screen',
        'Improvement: Compact rank badge in game selector',
      ],
    },
  },
  {
    version: '1.13.33',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: מערכת דירוגים וחבילות פרסים',
        'חדש: כפתור לוח מובילים קבוע ליד הצ\'אט',
        'שיפור: בורר משחקים - פרופיל קבוע + גלילת משחקים',
      ],
      en: [
        'New: Rank system and prize packs',
        'New: Fixed leaderboard button next to chat',
        'Improvement: Game selector - fixed profile + scrollable games',
      ],
    },
  },
  {
    version: '1.13.32',
    date: '2026-03-06',
    highlights: {
      he: [
        'חדש: שם המשחק עם אנימציה במסך תוצאות',
        'חדש: כפתור שיתוף בוואטסאפ אחרי ניצחון/הפסד',
        'שיפור: מסך in-app browser - מסך מלא עם כפתור פתיחה בדפדפן',
        'שיפור: בורר משחקים - כותרת קבועה עם גלילה',
      ],
      en: [
        'New: Game name with animation on result screen',
        'New: WhatsApp share button after win/loss',
        'Improvement: In-app browser - full screen gate with open in browser button',
        'Improvement: Game selector - fixed header with scrollable games',
      ],
    },
  },
  {
    version: '1.13.31',
    date: '2026-03-05',
    highlights: {
      he: [
        'שיפור: ארבע בשורה - סיבוב אחד עם ניקוד לפי זמן (מהר יותר = יותר נקודות)',
        'שיפור: טיימר מרכזי מראה זמן שעבר במשחק',
      ],
      en: [
        'Improvement: Connect 4 - single round with time-based scoring (faster = more points)',
        'Improvement: Central timer shows elapsed game time',
      ],
    },
  },
  {
    version: '1.13.30',
    date: '2026-03-05',
    highlights: {
      he: [
        'חדש: זיהוי דפדפן WhatsApp/אפליקציות - באנר פתיחה בדפדפן',
        'שיפור: מסך הרשמה - ניצול מסך טוב יותר בסלולרי',
      ],
      en: [
        'New: In-app browser detection - banner to open in Safari/Chrome',
        'Improvement: Registration screen - better mobile layout',
      ],
    },
  },
  {
    version: '1.13.29',
    date: '2026-03-05',
    highlights: {
      he: [
        'תיקון: לוח ארבע בשורה - חורים נראים כמו לוח אמיתי',
        'תיקון: תצוגה לא חופפת טקסט Powered by',
      ],
      en: [
        'Fix: Connect 4 board - visible grid slots like a real board',
        'Fix: Bottom content no longer overlaps Powered by text',
      ],
    },
  },
  {
    version: '1.13.28',
    date: '2026-03-05',
    highlights: {
      he: [
        'שיפור: עיצוב מודל אדמין - צבעים, לוגו ורקע בשורה אחת',
        'חדש: גרירה וזריקה להעלאת לוגו ותמונת רקע',
        'תיקון: ארבע בשורה מופיע ברשימת המשחקים במודל',
      ],
      en: [
        'Improvement: Admin modal branding - colors, logo, background in one row',
        'New: Drag & drop for logo and background image uploads',
        'Fix: Connect 4 now appears in admin games list',
      ],
    },
  },
  {
    version: '1.13.27',
    date: '2026-03-05',
    highlights: {
      he: [
        'חדש: ארבע בשורה (Connect 4) - משחק חמישי ב-Q.Games!',
        'שיפור: פישוט תמונת OG למיני גיימס (לוגו אירוע)',
      ],
      en: [
        'New: Connect 4 - 5th game in Q.Games!',
        'Improvement: Simplified Q.Games OG image (event logo)',
      ],
    },
  },
  {
    version: '1.13.26',
    date: '2026-03-05',
    highlights: {
      he: [
        'אבטחה: ולידציה על הודעות צ\'אט ב-RTDB (אורך מקסימלי, מבנה חובה)',
        'אבטחה: נעילת כתיבה ל-qgames_players ב-Firestore (Admin SDK בלבד)',
        'אבטחה: הגבלת קצב בקשות על register, finish, forfeit, move',
        'אבטחה: ולידציה על chatBans ב-RTDB (מבנה + אורך)',
        'שיפור: תמונות סלפי בסיום משחק זיכרון + אנימציות bounce-in',
        'שיפור: אימוג\'ים רספונסיביים ברמת קושי 5+',
        'חדש: אישור יציאה ב-"Powered by The Q"',
      ],
      en: [
        'Security: RTDB chat message validation (max length, required structure)',
        'Security: Locked Firestore qgames_players writes (Admin SDK only)',
        'Security: Rate limiting on register, finish, forfeit, move endpoints',
        'Security: RTDB chatBans validation (structure + length)',
        'Improvement: Selfie photos in Memory game over + bounce-in animations',
        'Improvement: Responsive emojis at difficulty 5+',
        'New: Exit confirmation on "Powered by The Q" link',
      ],
    },
  },
  {
    version: '1.13.25',
    date: '2026-03-05',
    highlights: {
      he: [
        'שיפור: תמונות סלפי מוצגות בסיום משחק הזיכרון (במקום אימוג׳י גנרי)',
        'שיפור: הנפשת bounce-in מדורגת בתוצאות סוף המשחק (שחקן אחר שחקן)',
        'שיפור: אימוג׳ים רספונסיביים בשלב 5+ (מתאימים למסך קטן)',
        'שיפור: 9 אימוג׳ים של הבחירה נכנסים בהנפשת bounce-in מהירה',
        'חדש: אישור יציאה בלחיצה על "Powered by The Q" (לא מעביר ישר)',
      ],
      en: [
        'Improvement: Selfie photos shown in Memory game over (instead of generic emoji)',
        'Improvement: Staggered bounce-in animation for game over rankings (one by one)',
        'Improvement: Responsive emojis at difficulty 5+ (fit small screens)',
        'Improvement: 9 option emojis bounce in one by one in recall phase',
        'New: Confirmation dialog on "Powered by The Q" link (no direct redirect)',
      ],
    },
  },
  {
    version: '1.13.24',
    date: '2026-03-05',
    highlights: {
      he: [
        'חדש: צ\'אט לובי בזמן אמת — שחקנים בוחרים מבועות מוכנות (ידידותי לילדים, בלי טקסט חופשי)',
        'חדש: אימוג\'י מהירים (❤️🔥🚀💯) + תיוג שחקנים מחוברים בצ\'אט',
        'חדש: הגנת אנטי-ספאם — אזהרות וחסימה אחרי 3 הפרות',
        'חדש: הגדרות בועות צ\'אט למנהל — הוספה, עריכה, מחיקה ואיפוס',
        'חדש: איפוס אוטומטי מתוזמן — הגדרת שעות איפוס שבועיות (cron)',
        'שיפור: טבלת מובילים עם עיצוב חדש, אנימציות כניסה, סינון לפי משחק',
        'שיפור: אנימציית bounce-in לבועות צ\'אט',
        'תיקון: כיווניות RTL בצ\'אט — הודעות שלי מימין, אחרים משמאל',
      ],
      en: [
        'New: Real-time lobby chat — players pick from predefined bubbles (kid-friendly, no free text)',
        'New: Quick emoji reactions (❤️🔥🚀💯) + mention connected players in chat',
        'New: Anti-spam protection — warnings and ban after 3 violations',
        'New: Admin chat bubble settings — add, edit, delete, and reset phrases',
        'New: Scheduled auto-reset — set weekly reset times (cron job)',
        'Improvement: Redesigned leaderboard with animations, game filtering',
        'Improvement: Staggered bounce-in animation for chat bubbles',
        'Fix: RTL chat direction — own messages on right, others on left',
      ],
    },
  },
  {
    version: '1.13.23',
    date: '2026-03-05',
    highlights: {
      he: [
        'תיקון: משחק זיכרון עובד - שלב הניחוש מוצג כראוי עם ריבועים ריקים למעלה',
        'תיקון: ספירה לאחור בזיכרון לא נתקעת על 3 (useMemo על sounds)',
        'תיקון: ניקוד מתעדכן בזמן אמת + בונוס מהירות (+1-3) לסיבוב מושלם',
        'תיקון: מניעת ספירת ניקוד כפולה ומשחק שנגמר מוקדם (race condition)',
        'חדש: כפתור התחילו נגיש לכל שחקן (לא רק ליוצר החדר)',
        'חדש: אנימציית +N ירוקה כשמקבלים נקודות',
        'חדש: כפתור יציאה מהמשחק (ExitGameButton) בכל המשחקים',
        'שיפור: טבלת מובילים עם סינון לפי זיכרון ואיקס עיגול',
      ],
      en: [
        'Fix: Memory game works - recall phase shows empty squares on top, options below',
        'Fix: Memory countdown no longer stuck at 3 (useMemo on sounds)',
        'Fix: Score updates in real-time + speed bonus (+1-3) for perfect rounds',
        'Fix: Prevent double scoring and premature game end (race condition guards)',
        'New: Start button visible to all players (not just room creator)',
        'New: Green +N score popup animation on round results',
        'New: Exit game button (ExitGameButton) in all games',
        'Improvement: Leaderboard filtering for Memory and Tic Tac Toe',
      ],
    },
  },
  {
    version: '1.13.22',
    date: '2026-03-05',
    highlights: {
      he: [
        'שיפור: טאגליין חדש בדשבורד - חוויות אינטראקטיביות בקודי QR',
        'חדש: כפתור oLeague ביצירת חוויה - ליגות וטורנירים',
        'חדש: Q.Tag, Q.Games, Q.Challenge בדף השיווקי (12 חוויות)',
        'חדש: מדריך Q.Games למשתמש (4 שאלות ותשובות)',
        'שיפור: SEO מעודכן עם כל החוויות החדשות',
        'שיפור: כפתורי יצירה ממורכזים בשורה האחרונה',
      ],
      en: [
        'Improvement: New dashboard tagline - interactive experiences with QR codes',
        'New: oLeague button in experience creator - leagues & tournaments',
        'New: Q.Tag, Q.Games, Q.Challenge on marketing page (12 experiences)',
        'New: Q.Games user guide section (4 Q&As)',
        'Improvement: Updated SEO with all new experiences',
        'Improvement: Centered last row of creation buttons',
      ],
    },
  },
  {
    version: '1.13.21',
    date: '2026-03-05',
    highlights: {
      he: [
        'חדש: משחק איקס עיגול (Tic Tac Toe) — 2 שחקנים',
        'חדש: משחק זיכרון (Memory) — 2-6 שחקנים',
        'חדש: מערכת נושאים (Themes) עם צבעים מותאמים אישית',
        'חדש: תצוגת מסך רחב (Widescreen) לתצוגה על מסכים גדולים',
        'חדש: תצוגת תצוגה מקדימה לטלפון בממשק הניהול',
        'שיפור: אנימציות אימוג׳י ייחודיות לכל משחק בבחירת משחק',
        'שיפור: תגית מספר שחקנים לכל משחק (2/3/2-6 שחקנים)',
        'שיפור: טבלת מובילים עם סינון לפי כל סוגי המשחקים + ניקוד לפי משחק',
        'שיפור: ממשק ניהול Q.Games מחודש עם תצוגה מקדימה',
      ],
      en: [
        'New: Tic Tac Toe game — 2 players',
        'New: Memory game — 2-6 players',
        'New: Theme system with custom branding colors',
        'New: Widescreen display mode for large screens',
        'New: Phone preview in Q.Games admin modal',
        'Improvement: Unique animated emojis per game in selector',
        'Improvement: Player count badge per game (2/3/2-6 players)',
        'Improvement: Leaderboard filtering for all game types + per-game scoring',
        'Improvement: Redesigned Q.Games admin modal with live preview',
      ],
    },
  },
  {
    version: '1.13.20',
    date: '2026-03-04',
    highlights: {
      he: [
        'חדש: משחק "משלוש יוצא אחד" — 3 שחקנים, כף או אגרוף, מי שונה מקבל ✗',
        'חדש: טבלת מובילים לפי משחק (הכל / אבן נייר / משלוש יוצא אחד) + מיון לפי ניקוד או אחוז ניצחונות',
        'שיפור: סימוני ✗ ברורים במשחק משלוש יוצא אחד (במקום נקודות קטנות)',
        'שיפור: טיפול בזמן קצוב במשחק משלוש יוצא אחד',
        'תיקון: תמונות אווטאר עם fallback כשהתמונה לא נטענת',
      ],
      en: [
        'New: "Odd One Out" game — 3 players, palm or fist, odd one gets ✗',
        'New: Per-game leaderboard filtering (All / RPS / OOO) + sort by score or win rate',
        'Improvement: Clear ✗ strike indicators in Odd One Out (instead of tiny dots)',
        'Improvement: Timeout handling for Odd One Out game',
        'Fix: Avatar image fallback when image fails to load',
      ],
    },
  },
  {
    version: '1.13.19',
    date: '2026-03-04',
    highlights: {
      he: [
        'שיפור: ❌ ו"לא עניתם" כשנגמר הזמן במשחק RPS (במקום אימוג׳י אקראי)',
        'תיקון: שחקן שענה מקבל נקודה כשהיריב לא ענה בזמן (לא תיקו)',
        'חדש: תמונת OG דינמית למשחקי Q.Games',
      ],
      en: [
        'Improvement: ❌ and "Didn\'t answer" when timer expires in RPS (instead of random emoji)',
        'Fix: Player who answered gets the point when opponent times out (not a draw)',
        'New: Dynamic OG image for Q.Games',
      ],
    },
  },
  {
    version: '1.13.18',
    date: '2026-03-04',
    highlights: {
      he: [
        'חדש: אנימציית אמוג׳י אבן-נייר-מספריים בבחירת משחק ובמסך ההמתנה',
      ],
      en: [
        'New: Animated rock-paper-scissors emoji cycling in game selector and queue screen',
      ],
    },
  },
  {
    version: '1.13.17',
    date: '2026-03-04',
    highlights: {
      he: [
        'שיפור: מסך בחירת משחק מעוצב מחדש - פרופיל ממורכז, אנימציות כניסה',
        'שיפור: אנימציות count-up במודאל סטטיסטיקות שחקן',
        'חדש: טאגליין "בוחרים משחק ומאתגרים את החברים"',
      ],
      en: [
        'Improvement: Redesigned game selector - centered profile, entrance animations',
        'Improvement: Count-up animations in player stats modal',
        'New: "Pick a game and challenge your friends" tagline',
      ],
    },
  },
  {
    version: '1.13.16',
    date: '2026-03-04',
    highlights: {
      he: [
        'חדש: מודאל סטטיסטיקות שחקן בטבלת מובילים - לחצו על שחקן לפרטים',
        'שיפור: תוויות בעברית בטבלת מובילים (משחקים, נצ/הפ/תיקו)',
        'שיפור: עריכת שם בזמן המתנה לתור',
        'תיקון: מסך תיקו כשיריב מתנתק עם ניקוד שווה',
      ],
      en: [
        'New: Player stats modal in leaderboard - tap a player for details',
        'Improvement: Localized stats labels in leaderboard (games, W/L/D)',
        'Improvement: Edit name while waiting in queue',
        'Fix: Draw screen when opponent disconnects with equal scores',
      ],
    },
  },
  {
    version: '1.13.15',
    date: '2026-03-04',
    highlights: {
      he: [
        'חדש: זום בסלפי - צביטה או סליידר להגדלת התמונה במצלמה',
        'שיפור: עריכת פרופיל ממלאת שם ואווטר קיימים',
        'שיפור: אימוג׳י התחלתי אקראי + פלטת אימוג׳ים מעודכנת',
      ],
      en: [
        'New: Selfie zoom - pinch or slider to zoom in camera',
        'Improvement: Edit profile pre-fills existing name and avatar',
        'Improvement: Random starting emoji + updated emoji palette',
      ],
    },
  },
  {
    version: '1.13.14',
    date: '2026-03-04',
    highlights: {
      he: [
        'שיפור: כפתור סלפי בולט במסך הרשמה (לא מוסתר בגלילה)',
        'שיפור: כפתורי בוט והזמנת חברים מוצגים מיד במסך ההמתנה',
        'שיפור: שפה ידידותית - "חברים" במקום "יריבים" בכל המשחקים',
      ],
      en: [
        'Improvement: Prominent selfie button on registration (not hidden in scroll)',
        'Improvement: Bot + invite buttons shown immediately in queue',
        'Improvement: Friendly language - "friends" instead of "opponents" across games',
      ],
    },
  },
  {
    version: '1.13.13',
    date: '2026-03-04',
    highlights: {
      he: [
        'חדש: זיהוי ניתוק יריב - ניצחון טכני אוטומטי אם השחקן השני עזב',
        'חדש: שמירת סשן - רענון דף לא מאפס את השחקן (שם + אווטר נשמרים)',
        'חדש: כפתור עריכת פרופיל במסך בחירת משחק',
        'שיפור: מסך הרשמה ומסך המתנה קומפקטיים יותר למובייל',
      ],
      en: [
        'New: Opponent disconnect detection - auto forfeit win if opponent leaves',
        'New: Session persistence - page refresh keeps player profile (name + avatar)',
        'New: Edit profile button on game selector screen',
        'Improvement: Compact registration and queue screens for mobile',
      ],
    },
  },
  {
    version: '1.13.12',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: משחק "משלוש יוצא אחד" (Odd One Out) - 3 שחקנים, כף או אגרוף!',
        'חדש: שינוי אווטר בזמן המתנה לתור - לחצו על האימוג׳י לשנות או לצלם סלפי',
        'שיפור: תמיכה במשחקי 3 שחקנים במערכת ההתאמה, מסך VS ותוצאות',
      ],
      en: [
        'New: Odd One Out game - 3 players, palm or fist!',
        'New: Change avatar while waiting in queue - tap emoji to change or take a selfie',
        'Improvement: 3-player support in matchmaking, VS screen, and results',
      ],
    },
  },
  {
    version: '1.13.11',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון: משחק מולטיפלייר RPS נתקע כשהניקוד הגיע ל-3 - סיום משחק לא זוהה בצד הלקוח',
        'שיפור: היסטוריית סיבובים - הסיבוב האחרון בולט, קודמים מעומעמים',
      ],
      en: [
        'Fix: Multiplayer RPS got stuck when score reached 3 - match end not detected on client',
        'Improvement: Round history - latest round highlighted, older rounds dimmed',
      ],
    },
  },
  {
    version: '1.13.10',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון קריטי: טיימר שפג תוקפו במולטיפלייר RPS לא שלח בחירה אוטומטית - המשחק נתקע',
        'תיקון: מניעת שליחת בחירה כפולה בין סיבובים',
        'תיקון: מניעת race condition בעדכון מספר סיבוב בשרת',
      ],
      en: [
        'Critical fix: Timer expiry in multiplayer RPS did not auto-submit - game got stuck',
        'Fix: Prevent false auto-submit during round transitions',
        'Fix: Prevent race condition in server round counter update',
      ],
    },
  },
  {
    version: '1.13.9',
    date: '2026-03-03',
    highlights: {
      he: [
        'שיפור: טקסטים בריבים (צלמו סלפי, מחפשים לכם יריבים, שחקו עם בוט, עד 3 נקודות)',
        'שיפור: תמונת אווטר גדולה יותר בהרשמה ובחיפוש יריב',
      ],
      en: [
        'Improvement: Hebrew text polish (plural forms, better phrasing)',
        'Improvement: Bigger avatar in registration and queue screens',
      ],
    },
  },
  {
    version: '1.13.8',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון קריטי: משחק מולטיפלייר RPS עובד - תנועות נשמרות אטומית עם Admin SDK',
        'תיקון: RTDB null stripping גרם לשגיאת "Already submitted choice"',
      ],
      en: [
        'Critical fix: Multiplayer RPS game works - moves saved atomically with Admin SDK',
        'Fix: RTDB null stripping caused "Already submitted choice" error',
      ],
    },
  },
  {
    version: '1.13.7',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: שיתוף טבלת מובילים בוואטסאפ + אתגור שחקנים',
        'חדש: כפתור טבלת מובילים במסך בחירת משחק',
        'תיקון: היסטוריית סיבובים מציגה רק סיבובים שנגמרו (לא ריקים מראש)',
      ],
      en: [
        'New: WhatsApp share leaderboard + challenge players',
        'New: Leaderboard button on game selector screen',
        'Fix: Round history shows only completed rounds (no empty placeholders)',
      ],
    },
  },
  {
    version: '1.13.6',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון: אווטר סלפי מוצג כתמונה בכל מסכי Q.Games (לא כ-URL)',
        'תיקון: שגיאת "Already submitted choice" ב-RPS - מניעת שליחה כפולה',
      ],
      en: [
        'Fix: Selfie avatar rendered as image in all Q.Games screens (not as URL)',
        'Fix: "Already submitted choice" RPS error - prevent double submission race',
      ],
    },
  },
  {
    version: '1.13.5',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: היסטוריית סיבובים ב-Q.Games - רואים מה כל שחקן בחר בכל סיבוב',
        'שיפור: תמיכה באווטר סלפי במסך המשחק',
      ],
      en: [
        'New: Round history in Q.Games - see what each player chose per round',
        'Improvement: Selfie avatar support in game screen',
      ],
    },
  },
  {
    version: '1.13.4',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: סלפי כאווטר ב-Q.Games - צלם תמונה מהמצלמה',
        'שיפור: דחיסה אוטומטית ל-WebP והעלאה ל-Vercel Blob',
      ],
      en: [
        'New: Selfie avatar in Q.Games - take a photo from camera',
        'Improvement: Auto-compress to WebP and upload to Vercel Blob',
      ],
    },
  },
  {
    version: '1.13.3',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: שחק נגד בוט AI ב-Q.Games כשאין יריב',
        'תיקון: Q.Games הרשמה, שמירת הגדרות, חוקי RTDB',
        'שיפור: ניהול Q.Games מדף עריכת קוד',
        'תיקון: טיימר Q.Treasure לא מסתיר את באנר ההתקנה',
        'תיקון: כפתור סגירה בולט בסורק QR של Q.Treasure',
      ],
      en: [
        'New: Play vs AI Bot in Q.Games when no opponent available',
        'Fix: Q.Games registration, config persistence, RTDB rules',
        'Improvement: Q.Games management from code edit page',
        'Fix: Q.Treasure timer no longer covers PWA install banner',
        'Fix: Visible close button in Q.Treasure QR scanner',
      ],
    },
  },
  {
    version: '1.13.2',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון: סריקת QR תחנה ב-Q.Treasure מפנה למשחק (redirect בצד שרת)',
        'שיפור: קודי QR של תחנות לא מופיעים יותר בדשבורד',
      ],
      en: [
        'Fix: Station QR scan in Q.Treasure redirects to game (server-side redirect)',
        'Improvement: Station QR codes no longer appear in dashboard',
      ],
    },
  },
  {
    version: '1.13.1',
    date: '2026-03-03',
    highlights: {
      he: [
        'תיקון: סריקת QR תחנה ב-Q.Treasure הייתה תקועה על "טוען תוכן" - עכשיו מפנה למשחק',
      ],
      en: [
        'Fix: Scanning station QR in Q.Treasure was stuck on "Loading content" - now redirects to game',
      ],
    },
  },
  {
    version: '1.13.0',
    date: '2026-03-03',
    highlights: {
      he: [
        'חדש: Q.Treasure - אתגר תשובה בתחנות (ריבועי אותיות כמו Wordle)',
        'חדש: הדפסת כל קודי QR של תחנות ב-PDF (עם יצירה אוטומטית)',
        'חדש: Q.Games - משחקי מולטיפלייר (אבן-נייר-מספריים)',
        'תיקון: חוקי Firestore ל-Q.Treasure + יצירת QR תחנות עם Admin SDK',
      ],
      en: [
        'New: Q.Treasure - station answer challenge (Wordle-style letter squares)',
        'New: Print all station QR codes to PDF (with auto-creation)',
        'New: Q.Games - multiplayer games (Rock-Paper-Scissors)',
        'Fix: Firestore rules for Q.Treasure + station QR creation with Admin SDK',
      ],
    },
  },
  {
    version: '1.12.36',
    date: '2026-02-25',
    highlights: {
      he: [
        'תיקון: כניסה מהירה בסורק Q.Tag עובדת במובייל (אימות PIN במקום Firebase Auth)',
        'תיקון: ביטול צ׳ק-אין ומחיקת אורח עובדים במובייל בסורק',
      ],
      en: [
        'Fix: Q.Tag scanner quick-add works on mobile (PIN auth instead of Firebase Auth)',
        'Fix: Undo check-in and delete guest work on mobile in scanner',
      ],
    },
  },
  {
    version: '1.12.35',
    date: '2026-02-19',
    highlights: {
      he: [
        'חדש: התראת מייל למנהל כשמשתמש חדש נרשם (Resend)',
        'חדש: Q.Tag נוסף למדריך למשתמש (6 שאלות ותשובות)',
      ],
      en: [
        'New: Email notification to admin on new user registration (Resend)',
        'New: Q.Tag added to user guide (6 Q&As)',
      ],
    },
  },
  {
    version: '1.12.34',
    date: '2026-02-18',
    highlights: {
      he: [
        'חדש: דף שיווקי Q.Tag - רישום חכם לאירועים',
        'אבטחה: נעילת מחיקה בצד הלקוח - cellRegistrations, verifiedVoters, verificationCodes',
        'תיקון: ביטול רישום WeeklyCal דרך Admin SDK',
      ],
      en: [
        'New: Q.Tag marketing page - smart event registration',
        'Security: Client-side delete locked - cellRegistrations, verifiedVoters, verificationCodes',
        'Fix: WeeklyCal unregister via Admin SDK',
      ],
    },
  },
  {
    version: '1.12.33',
    date: '2026-02-18',
    highlights: {
      he: [
        'תיקון: איפוס הצבעות Q.Vote - שגיאת הרשאות Firebase תוקנה',
        'תיקון: העברת בעלות מפושטת - קוד עובר לשורש של הבעלים החדש',
        'שיפור: אתחול Auth מהיר יותר במובייל (authStateReady)',
      ],
      en: [
        'Fix: Q.Vote reset votes - Firebase permissions error resolved',
        'Fix: Simplified ownership transfer - code moves to new owner root',
        'Improvement: Faster mobile Auth init (authStateReady)',
      ],
    },
  },
  {
    version: '1.12.32',
    date: '2026-02-18',
    highlights: {
      he: [
        'תיקון: מצב טאבלט/קיוסק - הצבעה חוזרת עובדת ללא תקיעה',
        'תיקון: שרת מאפשר הצבעות חוזרות ממכשיר אחד במצב טאבלט',
        'חדש: כפתור מיון לפי קולות בדף ניהול מועמדים',
      ],
      en: [
        'Fix: Tablet/kiosk mode - repeat voting works without getting stuck',
        'Fix: Server allows repeat votes from same device in tablet mode',
        'New: Sort by votes button on candidates management page',
      ],
    },
  },
  {
    version: '1.12.31',
    date: '2026-02-18',
    highlights: {
      he: [
        'אמינות: הצבעה עם retry אוטומטי שקוף - לא מפספסים הצבעות',
        'תיקון: תמונות ממוזערות לא נטענו (thumbnail 404)',
        'אבטחה: הגבלת קצב הצבעות הורחבה ל-60/דקה לכל IP',
      ],
      en: [
        'Reliability: Silent auto-retry on vote submission - no lost votes',
        'Fix: Thumbnail images not loading (404)',
        'Security: Vote IP rate limit increased to 60/min for cellular networks',
      ],
    },
  },
  {
    version: '1.12.30',
    date: '2026-02-17',
    highlights: {
      he: [
        'תיקון: דף הצבעה קורס במובייל עם 74+ מועמדים',
        'תיקון: אנימציית כרטיסים נשברת בדסקטופ (מריחה)',
        'שיפור: טעינה חכמה - רק תמונות קרובות נטענות לזיכרון',
      ],
      en: [
        'Fix: Voting page crashes on mobile with 74+ candidates',
        'Fix: Card animation glitches on desktop (smearing)',
        'Improvement: Smart loading - only nearby images loaded to memory',
      ],
    },
  },
  {
    version: '1.12.29',
    date: '2026-02-17',
    highlights: {
      he: [
        'תיקון: העלאת מועמדים בכמות גדולה (74+) - כל הקבצים עולים בהצלחה',
        'שיפור: העלאה מקבילית (3 בו-זמנית) עם retry אוטומטי',
        'שיפור: מד התקדמות עם שלבים - דחיסה, העלאה, יצירת מועמדים',
      ],
      en: [
        'Fix: Bulk candidate upload (74+) - all files upload successfully',
        'Improvement: Parallel upload (3 concurrent) with auto-retry',
        'Improvement: Phase-based progress - compress, upload, create candidates',
      ],
    },
  },
  {
    version: '1.12.28',
    date: '2026-02-16',
    highlights: {
      he: [
        'שיפור: סליידר גודל לוגו עד פי 4',
        'תיקון: לוגו שקוף נשמר כ-PNG לשמירת שקיפות מלאה',
        'תיקון: מודאל הגדרות Q.Tag לא נסגר אחרי עדכון',
      ],
      en: [
        'Improvement: Logo scale slider up to 4x',
        'Fix: Transparent logo saved as PNG for full alpha preservation',
        'Fix: Q.Tag settings modal stays open after update',
      ],
    },
  },
  {
    version: '1.12.22',
    date: '2026-02-15',
    highlights: {
      he: [
        'תיקון: לוגו שקוף נשמר בלי רקע לבן',
        'תיקון: לוגו לא חוסם את הכותרת בדף הרשמה',
        'מודאל הגדרות Q.Tag נשאר פתוח אחרי עדכון',
      ],
      en: [
        'Fix: Transparent logo saved without white background',
        'Fix: Logo no longer covers title on registration page',
        'Q.Tag settings modal stays open after update',
      ],
    },
  },
  {
    version: '1.12.21',
    date: '2026-02-14',
    highlights: {
      he: [
        'אבטחה: קוד QR מוגן - סריקה עם מצלמה רגילה פותחת דף הרשמה (לא פרטי אורח)',
        'כפתור החלפת מצלמה בסורק - קדמית/אחורית',
      ],
      en: [
        'Security: Private QR code - regular camera scan opens registration (not guest details)',
        'Camera flip button in scanner - front/back toggle',
      ],
    },
  },
  {
    version: '1.12.20',
    date: '2026-02-13',
    highlights: {
      he: [
        'ביצועים: רשימת אורחים עם Virtual Scroll - תומך ב-5,000+ אורחים בלי לאט',
        'ביצועים: עדכונים מצטברים מ-Firestore (docChanges) במקום טעינה מחדש של הכל',
        'ביטול הרשמה - כפתור ביטול/שחזור לאורח רשום',
        'שליחה חוזרת של לינק כשהטלפון כבר רשום',
      ],
      en: [
        'Performance: Virtual scroll guest list - supports 5,000+ guests without lag',
        'Performance: Incremental Firestore updates (docChanges) instead of full reload',
        'Cancel registration - cancel/uncancel button for registered guests',
        'Resend link when phone is already registered',
      ],
    },
  },
  {
    version: '1.12.19',
    date: '2026-02-13',
    highlights: {
      he: [
        'QR כניסה סריק מכל מצלמה - פותח דף הרשמה לאירוע',
        'כפתור QR הרשמה בסורק - הדיילת מציגה לינק הרשמה בלחיצה',
        'תיקון ייצוא אקסל - ייצוא ישירות מהדפדפן',
      ],
      en: [
        'Entry QR scannable by any camera - opens event registration page',
        'Registration QR button in scanner - hostess shows registration link with one tap',
        'Fix Excel export - client-side generation',
      ],
    },
  },
  {
    version: '1.12.16',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון: שליחת QR לוואטסאפ - שליחת סיומת URL בלבד (כתובת בסיס בתבנית)',
        'שיפור סורק: גלילה לראש בפתיחת מודאלים, סטטיסטיקות לחיצות',
      ],
      en: [
        'Fix: WhatsApp QR delivery - send URL suffix only (base URL in template)',
        'Scanner UX: scroll to top on modal open, clickable stats',
      ],
    },
  },
  {
    version: '1.12.15',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון: שליחת QR לוואטסאפ - פורמט כפתור URL תוקן ל-INFORU API',
      ],
      en: [
        'Fix: WhatsApp QR delivery - URL button format fixed for INFORU API',
      ],
    },
  },
  {
    version: '1.12.14',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון: כניסה מהירה במובייל - המתנה לאתחול Auth לפני שליחה',
      ],
      en: [
        'Fix: Quick-add on mobile - wait for Auth initialization before requests',
      ],
    },
  },
  {
    version: '1.12.13',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון: שליחת QR לוואטסאפ אחרי אימות טלפון',
      ],
      en: [
        'Fix: WhatsApp QR delivery after phone verification',
      ],
    },
  },
  {
    version: '1.12.12',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון בוחר צבעים במובייל - כפתור צבע גדול ומעוצב',
        'תצוגת מיתוג רספונסיבית - עמודה בודדת בנייד צר',
      ],
      en: [
        'Fixed color pickers on mobile - large styled color button',
        'Responsive branding layout - single column on narrow mobile',
      ],
    },
  },
  {
    version: '1.12.11',
    date: '2026-02-13',
    highlights: {
      he: [
        'הגדרות Q.Tag - תפריט פעולות נפתח במובייל במקום כפתורים צפופים',
        'מודאל Q.Tag עולה מלמטה במובייל (bottom sheet)',
        'הסרת כפתור נגישות במובייל',
        'אבטחה: הסרת פרטי שגיאה מכל תשובות API',
      ],
      en: [
        'Q.Tag settings - dropdown action menu on mobile instead of cramped buttons',
        'Q.Tag modal slides up as bottom sheet on mobile',
        'Removed accessibility button on mobile',
        'Security: removed error details from all API responses',
      ],
    },
  },
  {
    version: '1.12.10',
    date: '2026-02-13',
    highlights: {
      he: [
        'כרטיסי אורחים מתרחבים גם בדף הסורק',
        'חיפוש אורחים לפי טלפון ושמות +1 בסורק',
      ],
      en: [
        'Expandable guest cards in scanner page',
        'Search by phone and +1 names in scanner',
      ],
    },
  },
  {
    version: '1.12.9',
    date: '2026-02-13',
    highlights: {
      he: [
        'שיפור חוויית שחזור QR - הודעה ברורה אם הטלפון נמצא או לא',
      ],
      en: [
        'Improved QR recovery UX - clear feedback if phone is found or not',
      ],
    },
  },
  {
    version: '1.12.8',
    date: '2026-02-13',
    highlights: {
      he: [
        'כפתור "כבר נרשמתי" - שליחה חוזרת של QR לוואטסאפ לפי טלפון',
      ],
      en: [
        '"Already registered?" button - resend QR to WhatsApp by phone',
      ],
    },
  },
  {
    version: '1.12.7',
    date: '2026-02-13',
    highlights: {
      he: [
        'רשימת אורחים - כרטיסים מתרחבים בלחיצה עם פרטי +1, פעולות ומחיקה',
        'חיפוש אורחים לפי טלפון ושמות +1',
        'זיכרון אורח חוזר - QR זמין מיד בכניסה חוזרת לדף',
        'מסך הצלחה - שם אירוע, תאריך, שעה וניווט בוויז',
      ],
      en: [
        'Guest list - expandable cards with +1 details, actions and delete',
        'Search guests by phone and +1 names',
        'Returning guest memory - QR available immediately on revisit',
        'Success screen - event name, date, time and Waze navigation',
      ],
    },
  },
  {
    version: '1.12.6',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון הרשמת אורחים - אורח נוצר רק אחרי אימות טלפון בוואטסאפ',
        'אבטחה: ולידציה על קלט הרשמה + הסרת פרטי שגיאה מתשובות API',
      ],
      en: [
        'Fix guest registration - guest created only after WhatsApp phone verification',
        'Security: input validation on registration + removed error details from API responses',
      ],
    },
  },
  {
    version: '1.12.5',
    date: '2026-02-13',
    highlights: {
      he: [
        'כפתור ביטול צ׳ק-אין בסורק Q.Tag',
        'תיקון ייצוא אקסל ברשימת אורחים Q.Tag',
      ],
      en: [
        'Undo check-in button in Q.Tag scanner',
        'Fixed Q.Tag guest list Excel export',
      ],
    },
  },
  {
    version: '1.12.3',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון צ׳ק-אין בסורק Q.Tag',
      ],
      en: [
        'Fixed Q.Tag scanner check-in',
      ],
    },
  },
  {
    version: '1.12.2',
    date: '2026-02-13',
    highlights: {
      he: [
        'סורק Q.Tag - פס פיצול נגרר בין המצלמה לרשימה בדסקטופ',
        'מלבן כיוון QR מותאם אוטומטית לגודל הפאנל',
      ],
      en: [
        'Q.Tag scanner - draggable split divider between camera and list on desktop',
        'QR viewfinder auto-adapts to panel size',
      ],
    },
  },
  {
    version: '1.12.1',
    date: '2026-02-13',
    highlights: {
      he: [
        'תיקון העלאת תמונות גדולות - דחיסה אוטומטית בצד הלקוח',
        'סורק Q.Tag בתצוגת מסך מפוצל בדסקטופ',
        'תמונת OG מותאמת לכל Q.Tag',
        'תיקון תרגומים חסרים ב-Q.Tag',
      ],
      en: [
        'Fixed large image uploads - automatic client-side compression',
        'Q.Tag scanner in split-screen view on desktop',
        'Custom OG image per Q.Tag',
        'Fixed missing Q.Tag translations',
      ],
    },
  },
  {
    version: '1.12.0',
    date: '2026-02-13',
    highlights: {
      he: [
        'Q.Tag - מערכת רישום והזמנות לאירועים עם QR',
        'שליחת QR בוואטסאפ אוטומטית אחרי הרשמה',
        'סורק כניסה עם PIN וקוד QR',
        'הוספת אורחים מהירה מהסורק',
        'אבטחה מוגברת - הרשאות על כל API routes',
      ],
      en: [
        'Q.Tag - Event registration & invitation system with QR',
        'Automatic WhatsApp QR delivery after registration',
        'Entry scanner with PIN and QR code',
        'Quick-add guests from scanner',
        'Enhanced security - auth on all API routes',
      ],
    },
  },
  {
    version: '1.8.0',
    date: '2026-01-05',
    highlights: {
      he: [
        'דף נחיתה שיווקי חדש עם עיצוב מינימליסטי',
        'עמוד תמחור - מנויים ואירועים חד-פעמיים',
        'לוגו Q אינטראקטיבי עם אפקט הובר',
        'מותאם מושלם למובייל - כל הסקשנים רספונסיביים',
        'קישור לסיידבר מדף הנחיתה',
      ],
      en: [
        'New marketing landing page with minimalist design',
        'Pricing page - subscriptions and one-time events',
        'Interactive Q logo with hover effect',
        'Perfect mobile responsiveness - all sections responsive',
        'Sidebar link from landing page',
      ],
    },
  },
  {
    version: '1.7.0',
    date: '2025-12-11',
    highlights: {
      he: [
        'Q.Vote - מערכת הצבעות דיגיטלית עם דף נחיתה מעוצב',
        'Q.Cal - תכנון ימים ושעות עם RSVP',
        'דף נחיתה מותאם אישית עם תמונה, כותרת וכפתור',
        'תצוגת טלפון בזמן אמת בעורך המיתוג',
        'דחיסת תמונות אוטומטית ל-WebP',
        'Analytics משופר עם סקשן RSVP',
      ],
      en: [
        'Q.Vote - Digital voting system with branded landing page',
        'Q.Cal - Day/time planning with RSVP',
        'Custom landing page with image, title and button',
        'Real-time phone preview in branding editor',
        'Automatic image compression to WebP',
        'Improved Analytics with RSVP section',
      ],
    },
  },
  {
    version: '1.6.3',
    date: '2025-12-10',
    highlights: {
      he: [
        'מודל תצוגה מקדימה רספונסיבי במובייל',
      ],
      en: [
        'Responsive mobile preview modal',
      ],
    },
  },
  {
    version: '1.6.2',
    date: '2025-12-10',
    highlights: {
      he: [
        'שיפורים בלוגו ודף התחברות',
      ],
      en: [
        'Logo and login page improvements',
      ],
    },
  },
  {
    version: '1.6.1',
    date: '2025-12-10',
    highlights: {
      he: [
        'תיקון הבהוב מסך לבן בטעינת PDF',
        'עדכון לוגו לtheQ',
      ],
      en: [
        'Fix white screen flash during PDF loading',
        'Update logo to theQ',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2025-12-10',
    highlights: {
      he: [
        'מסך לובי משופר',
        'דף פאקים חדש',
      ],
      en: [
        'Improved lobby screen',
        'New packs page',
      ],
    },
  },
  {
    version: '1.5.2',
    date: '2025-12-09',
    highlights: {
      he: [
        'תיקון באנר עוגיות - תמיכה בעברית ואנגלית',
      ],
      en: [
        'Fixed cookie consent banner - Hebrew and English support',
      ],
    },
  },
  {
    version: '1.5.1',
    date: '2025-12-09',
    highlights: {
      he: [
        'תיקון דפי פרטיות ונגישות - תמיכה בעברית ואנגלית',
      ],
      en: [
        'Fixed privacy and accessibility pages - Hebrew and English support',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2025-12-09',
    highlights: {
      he: [
        'מערכת פרסים והגרלות - פאקים עם פרסים!',
        'מסך לובי להצגת זוכים',
        'דפים משפטיים - נגישות ופרטיות',
        'באדג XP משופר עם גדלים רספונסיביים',
        'טולטיפים על כפתורי יצירת חוויה',
      ],
      en: [
        'Prize and lottery system - packs with prizes!',
        'Lobby screen for displaying winners',
        'Legal pages - accessibility and privacy',
        'Improved XP badge with responsive sizes',
        'Tooltips on experience creation buttons',
      ],
    },
  },
  {
    version: '1.4.5',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון הרשאות Firebase למבקרים וגיימיפיקציה',
        'תיקון צבע טקסט במודל הרשמה',
      ],
      en: [
        'Fixed Firebase permissions for visitors and gamification',
        'Fixed text color in registration modal',
      ],
    },
  },
  {
    version: '1.4.4',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון קריטי: folderId עובר נכון לתצוגת חידה',
        'באדג XP על כרטיס קוד שנמצא במסלול',
        'אינדיקטור "מסלול XP פעיל" בתצוגת חידה',
      ],
      en: [
        'Critical fix: folderId correctly passed to riddle viewer',
        'XP badge on code card when in route',
        '"XP Route Active" indicator in riddle view',
      ],
    },
  },
  {
    version: '1.4.3',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון מערכת XP - גיימיפיקציה עובדת בכתבי חידה במסלולים',
        'סליידרים משופרים בהגדרות מסלול',
      ],
      en: [
        'Fixed XP system - gamification works in riddles on routes',
        'Improved sliders in route settings',
      ],
    },
  },
  {
    version: '1.4.2',
    date: '2025-12-08',
    highlights: {
      he: [
        'תצוגת רשימה אוטומטית במובייל, גריד בדסקטופ',
      ],
      en: [
        'Automatic list view on mobile, grid on desktop',
      ],
    },
  },
  {
    version: '1.4.1',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון תצוגת האדר מעל הסיידבר בדסקטופ',
        'שיפור מיקום לוגו עם תמיכה בכיוון RTL/LTR',
      ],
      en: [
        'Fixed header display above sidebar on desktop',
        'Improved logo positioning with RTL/LTR support',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2025-12-08',
    highlights: {
      he: [
        'מערכת XP וגיימיפיקציה לכתבי חידה!',
        'מסלולים עם נקודות XP ורמות',
        'לידרבורד בזמן אמת',
        'באדג XP על כפתור כתב חידה',
        'הגדרות מסלול על תיקיות',
      ],
      en: [
        'XP and gamification system for riddles!',
        'Routes with XP points and levels',
        'Real-time leaderboard',
        'XP badge on riddle button',
        'Route settings on folders',
      ],
    },
  },
  {
    version: '1.3.4',
    date: '2025-12-08',
    highlights: {
      he: [
        'לייאאוט מושלם RTL/LTR - האדר וסיידבר מותאמים לכל שפה',
        'לוגו תמיד בצד הנגדי לסיידבר (מובייל ודסקטופ)',
        'המבורגר תמיד בצד הסיידבר במובייל',
        'תיקון רווח שחור במובייל עברית',
      ],
      en: [
        'Perfect RTL/LTR layout - header and sidebar adapted per language',
        'Logo always on opposite side of sidebar (mobile & desktop)',
        'Hamburger always near sidebar on mobile',
        'Fixed black gap on Hebrew mobile',
      ],
    },
  },
  {
    version: '1.3.3',
    date: '2025-12-08',
    highlights: {
      he: [
        'תיקון לייאאוט RTL/LTR - סיידבר והאדר מותאמים לכל שפה',
        'לוגו בהאדר בצד הנגדי לסיידבר בכל התצורות',
        'תיקון רווח שחור במובייל עברית',
        'המבורגר ליד הסיידבר בכל שפה',
      ],
      en: [
        'Fixed RTL/LTR layout - sidebar and header adapted per language',
        'Header logo on opposite side of sidebar in all views',
        'Fixed black gap on Hebrew mobile',
        'Hamburger menu near sidebar in all languages',
      ],
    },
  },
  {
    version: '1.3.2',
    date: '2025-12-07',
    highlights: {
      he: [
        'ממשק מותאם לסלולר - תצוגה משופרת בעורך הקוד',
        'דפים ציבוריים מתורגמים לפי שפת הדפדפן',
        'תיקון תזמון מדיה לסלולר',
        'תיקון תפריט עברית/אנגלית בנייד',
      ],
      en: [
        'Mobile-optimized interface - improved code editor display',
        'Public pages translated by browser language',
        'Fixed media scheduling for mobile',
        'Fixed language menu on mobile',
      ],
    },
  },
  {
    version: '1.3.1',
    date: '2025-12-07',
    highlights: {
      he: [
        'תמיכה מלאה בשפות - עברית ואנגלית',
        'התראות לפי שפה - כל שפה רואה את ההתראות שלה',
        'תיקוני תרגום וממשק משופר',
      ],
      en: [
        'Full language support - Hebrew and English',
        'Locale-based notifications - each language sees its own notifications',
        'Translation fixes and improved interface',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'גרירת קבצים על כרטיסים וקודים - החלפה מהירה',
        'שם קובץ מקורי נשמר ומוצג',
        'מספר עמודים ב-PDF מוצג אוטומטית',
        'תזמון חכם - מילוי אוטומטי של תאריכים ושעות',
        'צבע ירוק/אדום לסטטוס תזמון פעיל/לא פעיל',
      ],
      en: [
        'Drag files to cards and codes - quick replacement',
        'Original filename saved and displayed',
        'PDF page count displayed automatically',
        'Smart scheduling - auto-fill dates and times',
        'Green/red color for active/inactive schedule status',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'העברת בעלות משופרת - תיקיות עוברות עם הקבצים',
        'מנהל על רואה את כל התיקיות וקודים',
        'סינון "My Q" לעומת "הכל" עובד נכון עם תיקיות',
        'שם הבעלים מוצג על תיקיות של משתמשים אחרים',
      ],
      en: [
        'Improved ownership transfer - folders move with files',
        'Super admin sees all folders and codes',
        '"My Q" vs "All" filter works correctly with folders',
        'Owner name shown on other users\' folders',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2025-12-07',
    highlights: {
      he: [
        'אבטחה משופרת - הגנה מפני התקפות XSS',
        'יציבות מוגברת - תור העלאות חכם עם retry אוטומטי',
        'ביצועים משופרים - טעינה הדרגתית בגלריה',
        'Rate Limiting - הגנה מפני עומס יתר',
      ],
      en: [
        'Enhanced security - XSS attack protection',
        'Improved stability - smart upload queue with auto-retry',
        'Better performance - gradual gallery loading',
        'Rate Limiting - overload protection',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2025-01-01',
    highlights: {
      he: [
        'השקה ראשונה!',
        'קודי QR דינמיים עם מדיה',
        'תזמון תוכן חכם',
        'אנליטיקס בזמן אמת',
      ],
      en: [
        'First launch!',
        'Dynamic QR codes with media',
        'Smart content scheduling',
        'Real-time analytics',
      ],
    },
  },
];

// Get the latest version update
export function getLatestUpdate(): VersionUpdate {
  return CHANGELOG[0];
}

// Check if there's a new version since user's last seen version
export function hasNewVersion(lastSeenVersion: string | null): boolean {
  if (!lastSeenVersion) return true;
  return lastSeenVersion !== APP_VERSION;
}
