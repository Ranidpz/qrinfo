import type { Locale } from '@/i18n/config';

// Marketing copy for the "10 בול" landing page, both languages side by side. It lives here and
// not in he.json/en.json because it is long-form page content, rendered on the server only.

export interface TenBoolLandingContent {
  meta: { title: string; description: string; ogAlt: string; keywords: string[] };
  breadcrumbs: { home: string; games: string };
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    chips: string[];
  };
  demo: {
    label: string;
    start: string;
    hint: string;
    modes: { wins: string; counter: string; lives: string };
    fullscreen: string;
  };
  what: { title: string; paragraphs: string[] };
  howTo: {
    title: string;
    steps: { title: string; text: string }[];
    controlsTitle: string;
    controls: { title: string; text: string }[];
  };
  modes: {
    title: string;
    intro: string;
    items: { id: 'wins' | 'counter' | 'lives'; title: string; text: string; best: string }[];
    off: string;
  };
  audience: { title: string; items: { title: string; text: string }[] };
  customize: { title: string; intro: string; items: string[] };
  share: { title: string; text: string };
  create: { title: string; steps: string[]; cta: string };
  faq: { title: string; items: { q: string; a: string }[] };
  final: { title: string; text: string; cta: string; secondary: string };
}

export const TENBOOL_CONTENT: Record<Locale, TenBoolLandingContent> = {
  he: {
    meta: {
      title: '10 בול – משחק עצירת טיימר על 10.00 בדיוק | The Q',
      description:
        'עצרו את הטיימר בדיוק על 10.00 ותקבלו בול! משחק תזמון חינמי בדפדפן – למסך גדול באירוע, לכיתה, ליום הולדת ולטלפון. שחקו עכשיו או צרו משחק משלכם.',
      ogAlt: 'שעון עצר שמראה 10.00 בדיוק',
      keywords: ['10 בול', 'עשר בול', 'משחק 10 בול', 'משחק טיימר', 'לעצור את הטיימר על 10', 'משחק 10 שניות', 'משחק לאירועים', 'משחק למסך גדול', 'משחק לכנס', 'משחק לכיתה'],
    },
    breadcrumbs: { home: 'The Q', games: 'משחקים' },
    hero: {
      eyebrow: 'משחק לאירועים · חינם בדפדפן',
      title: '10 בול – עצרו את הטיימר בדיוק על 10.00',
      lead:
        'הטיימר רץ, אתם לוחצים, וצריך לעצור אותו בדיוק על 10.00. לא 9.99 ולא 10.01. משחק של עשר שניות שגורם לכולם לבקש "עוד פעם אחת" – על מסך גדול באירוע, בכיתה, ביום הולדת או בטלפון מול החברים.',
      ctaPrimary: 'צרו משחק משלכם',
      ctaSecondary: 'שחקו במסך מלא',
      chips: ['חינם', 'בלי התקנה', 'טלפון, מחשב ומסך גדול'],
    },
    demo: {
      label: 'דמו חי של 10 בול',
      start: 'לחצו כדי לשחק',
      hint: 'לחיצה מפעילה את הטיימר, לחיצה נוספת עוצרת אותו. במחשב אפשר גם עם Enter או רווח.',
      modes: { wins: 'נקודות זהב', counter: 'מונה ניסיונות', lives: 'חיים' },
      fullscreen: 'מסך מלא',
    },
    what: {
      title: 'מה זה 10 בול?',
      paragraphs: [
        '10 בול הוא משחק תזמון: לוחצים פעם אחת והטיימר מתחיל לרוץ במאיות שנייה, לוחצים שוב והוא עוצר. המטרה אחת – לעצור בדיוק על 10.00. מי שמצליח קיבל "בול".',
        'נשמע קל? רוב השחקנים מפספסים בכמה מאיות, וזה בדיוק מה שהופך אותו לממכר. בשלוש השניות האחרונות מגיעים צפצופים והספרות מאדימות, המתח עולה, וכשמישהו סוף סוף פוגע – כל הקהל מריע.',
        'המשחק רץ בדפדפן, בלי הורדה ובלי הרשמה לשחקנים. מציגים קישור או קוד QR, וכל אחד יכול להצטרף – על המסך הגדול או בטלפון שלו.',
      ],
    },
    howTo: {
      title: 'איך משחקים',
      steps: [
        { title: 'לחצו כדי להתחיל', text: 'הטיימר יוצא לדרך מ־00.00 ורץ במאיות שנייה.' },
        { title: 'ספרו עשר בראש', text: 'מתרכזים, סופרים בקצב, ומקשיבים לצפצופים של השניות האחרונות.' },
        { title: 'לחצו שוב כדי לעצור', text: 'עצרתם על 10.00 בדיוק? בול! כל תוצאה אחרת – נסו שוב.' },
      ],
      controlsTitle: 'בכל מסך, בדרך שנוחה לו',
      controls: [
        {
          title: 'מסך גדול ומחשב',
          text: 'לוחצים Enter או רווח. כל באזר או לחצן USB שמוגדר לאחד המקשים האלה עובד מיד – מושלם לדוכן באירוע או לבמה.',
        },
        {
          title: 'טלפון וטאבלט',
          text: 'נוגעים בכל מקום במסך. אפשר גם להוסיף את המשחק למסך הבית ולפתוח אותו כמו אפליקציה.',
        },
      ],
    },
    modes: {
      title: 'שלושה לוחות תוצאות',
      intro: 'בעלי המשחק בוחרים בהגדרות איך התוצאות מוצגות בפינות המסך. כל לוח מתאים לסוג אחר של אירוע.',
      items: [
        {
          id: 'wins',
          title: 'נקודות זהב',
          text: 'כל בול מוסיף נקודת זהב מנצנצת בפינת המסך. רואים לאורך כל האירוע כמה פעמים הקהל פגע.',
          best: 'מתאים לדוכן פתוח שכל אחד ניגש אליו',
        },
        {
          id: 'counter',
          title: 'מונה ניסיונות',
          text: 'לצד נקודות הזהב רץ מונה של הניסיונות מאז הבול האחרון. רואים כמה זה באמת קשה – והמונה רק מגביר את המתח.',
          best: 'מתאים לקהל גדול שמשחק ברצף',
        },
        {
          id: 'lives',
          title: 'חיים',
          text: 'לכל מתמודד מספר פסילות קבוע – בין 1 ל־9, ושלוש כברירת מחדל. כל החטאה מורידה חיים, התור נגמר בבול או כשהחיים נגמרים, והלוח מתאפס לשחקן הבא.',
          best: 'מתאים לתחרות בתורות',
        },
      ],
      off: 'ואפשר גם לכבות את הלוח לגמרי ולהשאיר רק את הטיימר.',
    },
    audience: {
      title: 'למי זה מתאים',
      items: [
        { title: 'כנסים ותערוכות', text: 'עמדה בדוכן שמושכת אנשים, יוצרת תור ונותנת סיבה לעצור ולדבר.' },
        { title: 'אירועי חברה וגיבוש', text: 'פותחים ערב צוות, חוצים קבוצות לתחרות, ומחלקים פרס למי שפגע הכי הרבה.' },
        { title: 'ימי הולדת ובר/בת מצווה', text: 'מסך אחד, באזר אחד, וכל האורחים בתור – מהילדים ועד הסבתות.' },
        { title: 'כיתות ותנועות נוער', text: 'הפסקה פעילה של דקה, תרגול ריכוז ותחושת זמן, ותחרות כיתתית בלי שום הכנה.' },
        { title: 'ברים ומסעדות', text: 'מציגים קוד QR על השולחן ומזמינים את הסועדים לנסות לפגוע בבול.' },
        { title: 'סתם מול החברים', text: 'שולחים קישור בקבוצה ובודקים מי מגיע ראשון לבול.' },
      ],
    },
    customize: {
      title: 'המשחק שלכם, במיתוג שלכם',
      intro: 'כל משחק שאתם יוצרים מקבל קישור וקוד QR משלו, ואתם קובעים איך הוא נראה ונשמע:',
      items: [
        'לוגו במרכז המסך ותמונת רקע',
        'צבעי רקע וטקסט וגופן מתוך גופנים עבריים',
        'צלילים לפתיחה, לצפצופים, להצלחה ולהחטאה – או קבצי שמע משלכם',
        'הבזק ניצחון, הבזק החטאה וקונפטי צבעוני בכל בול',
        'פס קרבה שמראה כמה רחוק הייתה כל עצירה מ־10.00',
        'לוח התוצאות ומספר החיים לכל מתמודד',
      ],
    },
    share: {
      title: 'מתפשט לבד בוואטסאפ',
      text: 'בטלפון, מהבול השני מופיע כפתור שיתוף שיוצר תמונה של התוצאה ושולח אותה בוואטסאפ עם קישור למשחק. כל מי שמקבל – מנסה לעקוף.',
    },
    create: {
      title: 'יוצרים משחק בדקה',
      steps: [
        'מתחברים ל־The Q עם חשבון גוגל.',
        'בוחרים "10 בול" ונותנים למשחק שם.',
        'מעצבים, מוסיפים לוגו וצלילים, ומציגים את הקישור או את קוד ה־QR.',
      ],
      cta: 'צרו משחק משלכם',
    },
    faq: {
      title: 'שאלות נפוצות',
      items: [
        {
          q: 'למה קוראים לזה "10 בול"?',
          a: '"בול" זה פגיעה מדויקת. המטרה היא לעצור את הטיימר על 10.00 בדיוק – בול.',
        },
        {
          q: 'האם המשחק חינמי?',
          a: 'כן. לשחק אפשר בלי הרשמה ובלי תשלום, ויצירת משחק משלכם זמינה בחשבון החינמי של The Q.',
        },
        {
          q: 'צריך להוריד אפליקציה?',
          a: 'לא. המשחק רץ בדפדפן בטלפון, בטאבלט, במחשב ובמסך חכם. בטלפון אפשר גם להוסיף אותו למסך הבית.',
        },
        {
          q: 'איך מחברים באזר?',
          a: 'פותחים את המשחק במסך מלא במחשב שמחובר למסך, ומחברים באזר או לחצן USB שמוגדר כ־Enter או כרווח. זה הכול – כל לחיצה על הבאזר מפעילה ועוצרת את הטיימר.',
        },
        {
          q: 'כמה אנשים יכולים לשחק?',
          a: 'כמה שרוצים. על מסך גדול משחקים בתורות, ולוח החיים מנהל את התור לכל מתמודד. דרך קוד QR כל אחד משחק בטלפון שלו במקביל.',
        },
        {
          q: 'כמה מדויקת המדידה?',
          a: 'הזמן נמדד במאיות שנייה ולפי רגע הלחיצה עצמו, כך שבול נחשב רק כשהתצוגה עוצרת על 10.00 בדיוק.',
        },
        {
          q: 'אפשר להוסיף לוגו וצבעים של החברה?',
          a: 'כן. בהגדרות המשחק מעלים לוגו ותמונת רקע, בוחרים צבעים, גופן וצלילים, וזה מה שהשחקנים רואים.',
        },
        {
          q: 'התוצאות נשמרות?',
          a: 'לוח התוצאות חי על המסך שבו משחקים. רענון של הדף פותח לוח חדש – נוח במיוחד כשעוברים בין סבבים או בין קבוצות.',
        },
      ],
    },
    final: {
      title: 'מוכנים לבול?',
      text: 'צרו משחק 10 בול משלכם תוך דקה, או שחקו עכשיו במסך מלא.',
      cta: 'צרו משחק משלכם',
      secondary: 'שחקו עכשיו',
    },
  },
  en: {
    meta: {
      title: '10 Bool – Stop the Timer at Exactly 10.00 | The Q',
      description:
        'Stop the timer at exactly 10.00 to score a "bool"! A free browser timing game for event big screens, classrooms, birthdays and phones. Play now or create your own.',
      ogAlt: 'A stopwatch showing exactly 10.00',
      keywords: ['10 bool', 'stop the timer at 10 seconds', '10 second challenge game', 'timer game', 'stopwatch game', 'event game', 'big screen game', 'conference booth game', 'classroom timer game', '10 בול'],
    },
    breadcrumbs: { home: 'The Q', games: 'Games' },
    hero: {
      eyebrow: 'Event game · Free in the browser',
      title: '10 Bool – stop the timer at exactly 10.00',
      lead:
        'The timer runs, you press, and you have to stop it at exactly 10.00. Not 9.99, not 10.01. A ten-second game that has everyone asking for "just one more go" – on an event big screen, in class, at a birthday party or on your phone.',
      ctaPrimary: 'Create your own',
      ctaSecondary: 'Play full screen',
      chips: ['Free', 'Nothing to install', 'Phone, computer and big screen'],
    },
    demo: {
      label: '10 Bool live demo',
      start: 'Tap to play',
      hint: 'One press starts the timer, the next press stops it. On a computer, Enter or Space work too.',
      modes: { wins: 'Gold dots', counter: 'Attempt counter', lives: 'Lives' },
      fullscreen: 'Full screen',
    },
    what: {
      title: 'What is 10 Bool?',
      paragraphs: [
        '10 Bool is a timing game: press once and a stopwatch starts counting in hundredths of a second, press again and it stops. There is one goal – stop it at exactly 10.00. Nail it and you score a "bool", Hebrew slang for a bullseye.',
        'Sounds easy? Most players miss by a few hundredths, which is exactly what makes it addictive. The last three seconds bring beeps and red digits, the tension builds, and when someone finally hits it the whole room cheers.',
        'It runs in the browser – no download, no sign-up for players. Put up a link or a QR code and anyone can join, on the big screen or on their own phone.',
      ],
    },
    howTo: {
      title: 'How to play',
      steps: [
        { title: 'Press to start', text: 'The timer sets off from 00.00, counting in hundredths of a second.' },
        { title: 'Count to ten in your head', text: 'Focus, keep a steady beat and listen for the beeps of the final seconds.' },
        { title: 'Press again to stop', text: 'Stopped on exactly 10.00? That’s a bool! Anything else – have another go.' },
      ],
      controlsTitle: 'Every screen, its own way',
      controls: [
        {
          title: 'Big screens and computers',
          text: 'Press Enter or Space. Any USB buzzer or button mapped to one of those keys works straight away – perfect for an event booth or a stage.',
        },
        {
          title: 'Phones and tablets',
          text: 'Tap anywhere on the screen. You can also add the game to your home screen and open it like an app.',
        },
      ],
    },
    modes: {
      title: 'Three scoreboards',
      intro: 'In the settings, the game’s owner chooses how scores show up in the corners of the screen. Each board suits a different kind of event.',
      items: [
        {
          id: 'wins',
          title: 'Gold dots',
          text: 'Every bool adds a shining gold dot in the corner, so all event long you can see how many times the crowd hit it.',
          best: 'Best for an open booth anyone can walk up to',
        },
        {
          id: 'counter',
          title: 'Attempt counter',
          text: 'Next to the gold dots, a counter tracks the attempts since the last bool. It shows how hard it really is – and only adds to the tension.',
          best: 'Best for a big crowd playing back to back',
        },
        {
          id: 'lives',
          title: 'Lives',
          text: 'Each contestant gets a fixed number of lives – anywhere from 1 to 9, three by default. Every miss costs a life; the turn ends on a bool or when the lives run out, and the board resets for the next player.',
          best: 'Best for a take-turns competition',
        },
      ],
      off: 'You can also switch the board off and keep just the timer.',
    },
    audience: {
      title: 'Who it’s for',
      items: [
        { title: 'Conferences and expos', text: 'A booth activity that draws people in, builds a queue and gives them a reason to stop and talk.' },
        { title: 'Company events and team building', text: 'Kick off a team night, split into groups and give a prize to whoever hits it most.' },
        { title: 'Birthdays and bar/bat mitzvahs', text: 'One screen, one buzzer, and every guest in line – from the kids to the grandparents.' },
        { title: 'Classrooms and youth groups', text: 'A one-minute active break that trains focus and sense of time, with zero preparation.' },
        { title: 'Bars and restaurants', text: 'Put a QR code on the table and challenge diners to hit a bool.' },
        { title: 'Just you and your friends', text: 'Drop the link in the group chat and see who gets a bool first.' },
      ],
    },
    customize: {
      title: 'Your game, your brand',
      intro: 'Every game you create gets its own link and QR code, and you decide how it looks and sounds:',
      items: [
        'A logo in the middle of the screen and a background image',
        'Background and text colours, and a font (Hebrew-ready fonts included)',
        'Sounds for the start, the beeps, a hit and a miss – or your own audio files',
        'A win flash, a miss flash and colourful confetti on every bool',
        'A closeness bar showing how far each stop was from 10.00',
        'The scoreboard and the number of lives per contestant',
      ],
    },
    share: {
      title: 'Spreads by itself on WhatsApp',
      text: 'On phones, from the second bool a share button turns the result into an image and sends it on WhatsApp with a link to the game. Everyone who gets it tries to beat it.',
    },
    create: {
      title: 'Create a game in a minute',
      steps: [
        'Sign in to The Q with your Google account.',
        'Pick “10 Bool” and give your game a name.',
        'Style it, add a logo and sounds, then show the link or the QR code.',
      ],
      cta: 'Create your own',
    },
    faq: {
      title: 'FAQ',
      items: [
        {
          q: 'Why is it called “10 Bool”?',
          a: '“Bool” is Hebrew slang for a bullseye – a perfect hit. The goal is to stop the timer at exactly 10.00: a bool.',
        },
        {
          q: 'Is it free?',
          a: 'Yes. Playing needs no sign-up and no payment, and creating your own game is available on the free The Q account.',
        },
        {
          q: 'Do I need to download an app?',
          a: 'No. The game runs in the browser on phones, tablets, computers and smart TVs. On a phone you can also add it to your home screen.',
        },
        {
          q: 'How do I connect a buzzer?',
          a: 'Open the game full screen on a computer connected to the display, and plug in a USB buzzer or button mapped to Enter or Space. That’s it – every press of the buzzer starts and stops the timer.',
        },
        {
          q: 'How many people can play?',
          a: 'As many as you like. On a big screen players take turns, and the Lives board manages each contestant’s turn. With a QR code everyone plays on their own phone at the same time.',
        },
        {
          q: 'How accurate is the timing?',
          a: 'Time is measured in hundredths of a second from the moment of the press itself, so a bool only counts when the display stops on exactly 10.00.',
        },
        {
          q: 'Can I add my company logo and colours?',
          a: 'Yes. In the game settings you upload a logo and a background image and pick colours, a font and sounds – that’s what players see.',
        },
        {
          q: 'Are scores saved?',
          a: 'The scoreboard lives on the screen you play on. Reloading the page starts a fresh board – handy when switching rounds or teams.',
        },
      ],
    },
    final: {
      title: 'Ready for a bool?',
      text: 'Create your own 10 Bool game in a minute, or play right now full screen.',
      cta: 'Create your own',
      secondary: 'Play now',
    },
  },
};
