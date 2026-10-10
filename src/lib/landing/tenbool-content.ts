import { Hash, Heart, ImageIcon, Palette, PartyPopper, Sparkles, Trophy, Type, Volume2 } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { ExperienceLandingContent } from './types';

// Copy for the "10 בול" landing page, both languages side by side. Short on purpose - a line or
// two per block. It lives here (not he.json/en.json) because it is page content, server-rendered.

const HERO_IMAGE = '/experiences/10-bool/hero-buzzer-crowd.webp';
const STAGE_IMAGE = '/experiences/10-bool/stage-big-screen.webp';
const BUZZER_IMAGE = { src: '/experiences/10-bool/buzzer-product.webp' };
// Decorative only: our real buzzer doesn't light up, so this one is a dim backdrop, never "the product"
const BUZZER_GLOW = '/experiences/10-bool/buzzer-glow.webp';

export const TENBOOL_CONTENT: Record<Locale, ExperienceLandingContent> = {
  he: {
    name: '10 בול',
    brandColor: '#fbbf24',
    meta: {
      title: '10 בול – משחק עצירת טיימר על 10.00 בדיוק | The Q',
      description:
        'עצרו את הטיימר בדיוק על 10.00 ותקבלו בול! משחק תזמון חינמי בדפדפן – למסך גדול באירוע, לכיתה, ליום הולדת ולטלפון. שחקו עכשיו או צרו משחק משלכם.',
      ogAlt: 'שעון עצר שמראה 10.00 בדיוק',
      keywords: ['10 בול', 'עשר בול', 'משחק 10 בול', 'משחק טיימר', 'לעצור את הטיימר על 10', 'משחק 10 שניות', 'משחק לאירועים', 'משחק למסך גדול', 'משחק לכנס', 'באזר לאירוע'],
    },
    nav: { how: 'איך משחקים', ways: 'איפה משחקים', pricing: 'מחירים', cta: 'יצירת משחק' },
    hero: {
      eyebrow: 'משחק לאירועים',
      tagline: ['10 שניות. שתי לחיצות.', 'מי יעצור בדיוק על 10.00?'],
      lead: 'משחק קצר וממכר שכולם רוצים לנסות – על מסך ענק באירוע עם הבאזר שלנו, או ישר מהטלפון.',
      ctaPrimary: 'צרו משחק משלכם',
      ctaSecondary: 'התנסו עכשיו',
      chips: ['חינם להתנסות', 'בלי התקנה', 'באזר פיזי לאירוע'],
      image: { src: HERO_IMAGE, alt: 'אורחים באירוע לוחצים על באזר ירוק מול מסך ענק שמראה 09.98' },
      stats: [
        { value: '10.00', label: 'מטרה' },
        { value: '02', label: 'לחיצות' },
        { value: '∞', label: 'ניסיונות' },
        { value: '0', label: 'התקנות' },
      ],
    },
    demo: {
      title: 'חושבים שזה קל? נסו.',
      text: 'לחיצה אחת מפעילה, לחיצה שנייה עוצרת. צריך לעצור בדיוק על 10.00 – לא 9.99 ולא 10.01.',
    },
    steps: {
      title: 'פשוט לשחק. קשה לפגוע.',
      items: [
        { title: 'לוחצים', text: 'הטיימר מתחיל לרוץ.' },
        { title: 'סופרים בראש עד 10', text: 'בשלוש השניות האחרונות שומעים צפצופים.' },
        { title: 'עוצרים על 10.00', text: 'בדיוק? בול! לא? עוד סיבוב.' },
      ],
    },
    ways: {
      title: 'על הבמה או בטלפון.',
      items: [
        {
          badge: 'מסך LED + באזר',
          title: 'על הבמה ובדוכן',
          text: 'מסך גדול, באזר אחד, וכל הקהל מסביב.',
          visual: { image: { src: STAGE_IMAGE, alt: 'שחקן לוחץ על באזר מול מסך ענק באירוע, והקהל מריע' } },
        },
        {
          badge: 'קוד QR',
          title: 'בטלפון',
          text: 'סורקים ומשחקים. מהבול השני אפשר לשתף בוואטסאפ.',
          visual: { phone: '09.98' },
        },
      ],
      chipsLabel: 'לוח תוצאות:',
      chips: [
        { icon: Trophy, label: 'נקודות זהב' },
        { icon: Hash, label: 'מונה ניסיונות' },
        { icon: Heart, label: 'חיים לכל מתמודד' },
      ],
      audience: 'מתאים לכנסים, לאירועי חברה, לימי הולדת, לכיתות ולברים.',
    },
    customize: {
      title: 'עם הלוגו והצבעים שלכם.',
      items: [
        { icon: ImageIcon, label: 'לוגו ותמונת רקע' },
        { icon: Palette, label: 'צבעים' },
        { icon: Type, label: 'גופן' },
        { icon: Volume2, label: 'צלילים משלכם' },
        { icon: Sparkles, label: 'רקע מונפש – חלל ניאון' },
        { icon: PartyPopper, label: 'קונפטי בכל בול' },
      ],
      demo: { label: 'נסו את רקע הניאון', href: '/play/10-bool?bg=neon' },
    },
    pricing: {
      title: 'רוצים 10 בול משלכם?',
      plans: [
        {
          name: 'מנוי ל־The Q',
          price: 'יוצרים בעצמכם',
          text: '10 בול וכל החוויות של The Q, במיתוג שלכם.',
          features: ['קישור וקוד QR משלכם', 'לוגו, צבעים, גופן וצלילים', 'טלפון, מחשב ומסך גדול'],
          cta: { label: 'צרו משחק משלכם', kind: 'create' },
        },
        {
          name: 'לאירוע אחד',
          price: 'השכרה עם באזר',
          text: 'אנחנו מכינים הכול: משחק, באזר ומיתוג.',
          features: ['מיתוג מלא לפי האירוע', 'באזר פיזי', 'התאמה למסך הגדול', 'ליווי לפני האירוע'],
          cta: { label: 'קבלו הצעת מחיר', kind: 'contact' },
          highlight: true,
        },
      ],
      contactTitle: 'דברו איתנו',
      whatsappText: 'היי, אשמח לשמוע על 10 בול לאירוע שלי',
      emailSubject: '10 בול – בקשת הצעת מחיר',
      labels: { whatsapp: 'וואטסאפ', email: 'אימייל', call: 'תיאום שיחה' },
    },
    addon: {
      title: 'באזר לאירוע.',
      text: 'באזר מתכת על בסיס כבד, מתחבר למחשב של המסך.',
      points: ['כפתור ירוק או כחול'],
      cta: 'שכרו באזר לאירוע',
      whatsappText: 'היי, אשמח לשכור באזר לאירוע שלי',
      games: {
        label: 'עובד עם:',
        items: [
          { name: '10 בול', href: '#demo' },
          { name: 'הגרלה', href: '/he/marketing#raffle' },
          { name: 'פרוגר', soon: 'בקרוב' },
        ],
      },
      idea: { text: 'חשבתם על משחק לבאזר?', cta: 'דברו איתנו', whatsappText: 'היי, יש לי רעיון למשחק עם הבאזר' },
      image: { ...BUZZER_IMAGE, alt: 'הבאזר של Playzone – עמוד מתכת שחור על בסיס כבד, עם כפתור ירוק' },
    },
    faq: {
      title: 'שאלות נפוצות',
      items: [
        { q: 'למה קוראים לזה "10 בול"?', a: '"בול" זה פגיעה מדויקת. עוצרים את הטיימר על 10.00 בדיוק – בול.' },
        { q: 'זה בחינם?', a: 'לשחק ולהתנסות – כן, כאן בדמו ובטלפון. משחק משלכם: במנוי ל־The Q, או בהשכרה לאירוע אחד עם הבאזר.' },
        { q: 'צריך להוריד אפליקציה?', a: 'לא. המשחק רץ בדפדפן בטלפון, במחשב ובמסך חכם.' },
        { q: 'איך מחברים באזר?', a: 'מחברים למחשב שמפעיל את המסך באזר שמוגדר כ־Enter או כרווח. אין לכם באזר? אנחנו משכירים.' },
        { q: 'כמה אנשים יכולים לשחק?', a: 'כמה שרוצים. על מסך גדול משחקים בתורות, ודרך קוד QR כל אחד משחק בטלפון שלו.' },
      ],
    },
    final: {
      title: 'מי יעשה בול ראשון?',
      text: 'צרו משחק משלכם, או נסו עכשיו במסך מלא.',
      cta: 'צרו משחק משלכם',
      secondary: 'התנסו עכשיו',
      social: 'תמונות וסרטונים מאירועים שלנו',
      backdrop: BUZZER_GLOW,
    },
  },
  en: {
    name: '10 Bool',
    brandColor: '#fbbf24',
    meta: {
      title: '10 Bool – Stop the Timer at Exactly 10.00 | The Q',
      description:
        'Stop the timer at exactly 10.00 to score a "bool"! A free browser timing game for event big screens, classrooms, birthdays and phones. Play now or create your own.',
      ogAlt: 'A stopwatch showing exactly 10.00',
      keywords: ['10 bool', 'stop the timer at 10 seconds', '10 second challenge game', 'timer game', 'stopwatch game', 'event game', 'big screen game', 'conference booth game', 'event buzzer', '10 בול'],
    },
    nav: { how: 'How to play', ways: 'Where to play', pricing: 'Pricing', cta: 'Create a game' },
    hero: {
      eyebrow: 'Interactive game for events',
      tagline: ['10 seconds. Two presses.', 'Who stops at exactly 10.00?'],
      lead: 'A short, addictive timing game everyone wants to try. On a giant LED screen at your event, with our buzzer, or straight from a phone.',
      ctaPrimary: 'Create your own',
      ctaSecondary: 'Try it now',
      chips: ['Free to try', 'Nothing to install', 'Physical buzzer for events'],
      image: { src: HERO_IMAGE, alt: 'Event guests slamming a green buzzer in front of a giant screen showing 09.98' },
      stats: [
        { value: '10.00', label: 'Target' },
        { value: '02', label: 'Presses' },
        { value: '∞', label: 'Tries' },
        { value: '0', label: 'Installs' },
      ],
    },
    demo: {
      title: 'Think it’s easy? Try it.',
      text: 'The first press starts the timer, the second stops it. The goal: exactly 10.00 – not 9.99, not 10.01.',
    },
    steps: {
      title: 'Easy to play. Hard to nail.',
      items: [
        { title: 'Press to start', text: 'The timer sets off, counting in hundredths.' },
        { title: 'Count to ten', text: 'The last three seconds come with beeps.' },
        { title: 'Stop on 10.00', text: 'Spot on? That’s a bool! Anything else – try again.' },
      ],
    },
    ways: {
      title: 'On stage or on a phone.',
      items: [
        {
          badge: 'LED screen + buzzer',
          title: 'On stage and at the booth',
          text: 'A big screen, one buzzer and a whole crowd around it. Every slam starts and stops the timer.',
          visual: { image: { src: STAGE_IMAGE, alt: 'A player slams the buzzer in front of a giant event screen as the crowd cheers' } },
        },
        {
          badge: 'Phone / QR',
          title: 'From a phone, anywhere',
          text: 'Scan a QR code and play. From the second bool you can share your score on WhatsApp.',
          visual: { phone: '09.98' },
        },
      ],
      chipsLabel: 'Pick your scoreboard:',
      chips: [
        { icon: Trophy, label: 'Gold dots' },
        { icon: Hash, label: 'Attempt counter' },
        { icon: Heart, label: 'Lives per player' },
      ],
      audience: 'For conferences, company events, birthdays, classrooms and bars.',
    },
    customize: {
      title: 'With your logo and colours.',
      items: [
        { icon: ImageIcon, label: 'Logo and background image' },
        { icon: Palette, label: 'Colours' },
        { icon: Type, label: 'Font' },
        { icon: Volume2, label: 'Your own sounds' },
        { icon: Sparkles, label: 'Animated neon space background' },
        { icon: PartyPopper, label: 'Confetti on every bool' },
      ],
      demo: { label: 'Try the neon background', href: '/play/10-bool?bg=neon' },
    },
    pricing: {
      title: 'Want your own 10 Bool?',
      plans: [
        {
          name: 'The Q subscription',
          price: 'Create it yourself',
          text: '10 Bool and every The Q experience, with your branding.',
          features: ['Your own link and QR code', 'Logo, colours, font and sounds', 'Phone, computer and big screen'],
          cta: { label: 'Create your own', kind: 'create' },
        },
        {
          name: 'One event',
          price: 'Rental with a buzzer',
          text: 'The game, the buzzer and the branding – ready for your event.',
          features: ['Full branding for your event', 'Physical buzzer', 'Set up for the big screen', 'Support before the event'],
          cta: { label: 'Get a quote', kind: 'contact' },
          highlight: true,
        },
      ],
      contactTitle: 'Talk to us',
      whatsappText: 'Hi, I’d like to hear about 10 Bool for my event',
      emailSubject: '10 Bool – quote request',
      labels: { whatsapp: 'WhatsApp', email: 'Email', call: 'Book a call' },
    },
    addon: {
      title: 'A buzzer for your event.',
      text: 'Metal, heavy base, plugs into the screen’s computer. Rent it for your event.',
      points: ['Green or blue button'],
      cta: 'Rent a buzzer',
      whatsappText: 'Hi, I’d like to rent a buzzer for my event',
      games: {
        label: 'Works with:',
        items: [
          { name: '10 Bool', href: '#demo' },
          { name: 'Raffle', href: '/en/marketing#raffle' },
          { name: 'Frogger', soon: 'Coming soon' },
        ],
      },
      idea: { text: 'Got an idea for a buzzer game?', cta: 'Talk to us', whatsappText: 'Hi, I have an idea for a buzzer game' },
      image: { ...BUZZER_IMAGE, alt: 'The Playzone buzzer – a black metal pillar on a heavy base with a green button' },
    },
    faq: {
      title: 'FAQ',
      items: [
        { q: 'Why is it called “10 Bool”?', a: '“Bool” is Hebrew slang for a bullseye. Stop the timer at exactly 10.00 – a bool.' },
        { q: 'Is it free?', a: 'Playing and trying it – yes, here in the demo and on phones. Your own game: with a The Q subscription, or a one-event rental with the buzzer.' },
        { q: 'Do I need to download an app?', a: 'No. The game runs in the browser on phones, computers and smart TVs.' },
        { q: 'How do I connect a buzzer?', a: 'Plug a buzzer mapped to Enter or Space into the computer running the screen. No buzzer? We rent them out.' },
        { q: 'How many people can play?', a: 'As many as you like. On a big screen players take turns; with a QR code everyone plays on their own phone.' },
      ],
    },
    final: {
      title: 'Who’ll hit a bool first?',
      text: 'Create your own game in a minute, or try it now full screen.',
      cta: 'Create your own',
      secondary: 'Try it now',
      social: 'Photos and videos from our events',
      backdrop: BUZZER_GLOW,
    },
  },
};

// Labels for the embedded demo (client component - plain strings only)
export const TENBOOL_DEMO_LABELS: Record<
  Locale,
  { label: string; start: string; hint: string; fullscreen: string; modes: { wins: string; counter: string; lives: string } }
> = {
  he: {
    label: 'דמו חי של 10 בול',
    start: 'לחצו כדי לשחק',
    hint: 'במחשב אפשר גם עם Enter או רווח.',
    modes: { wins: 'נקודות זהב', counter: 'מונה ניסיונות', lives: 'חיים' },
    fullscreen: 'מסך מלא',
  },
  en: {
    label: '10 Bool live demo',
    start: 'Tap to play',
    hint: 'On a computer, Enter or Space work too.',
    modes: { wins: 'Gold dots', counter: 'Attempt counter', lives: 'Lives' },
    fullscreen: 'Full screen',
  },
};
