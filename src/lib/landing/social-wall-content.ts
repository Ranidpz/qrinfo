import { Clock, DoorOpen, EyeOff, ImageIcon, Link2, ListChecks, MessageCircle, Palette, ShieldCheck, Users } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { ExperienceLandingContent } from './types';

// Copy for the Social Wall landing page, both languages side by side. A line or two per block.
// Until the experience is in the dashboard (the full feature ships from feature/social-wall), every
// "create" button goes to WhatsApp (`primaryCta: 'contact'`) and the page has no catalog.ts entry.
// The photos are the demo's own (AI-generated, brand logos blurred) - illustration, never "our events".

const PHOTO = (n: number) => `/play/social-wall/p${n}.webp`;

export const SOCIALWALL_CONTENT: Record<Locale, ExperienceLandingContent> = {
  he: {
    name: 'Social Wall',
    brandColor: '#f43f5e',
    primaryCta: 'contact',
    meta: {
      title: 'Social Wall – הרשת החברתית הפרטית לאירועים | The Q',
      description:
        'אינסטגרם פרטי לאירוע אחד: העובדים סורקים QR, מעלים תמונות, נותנים לייקים ומתחרים בין מחלקות. בלי אפליקציה, עם מודרציה ומחיקה בסוף האירוע.',
      ogAlt: 'Social Wall – מצטלמים. משתפים. מפרגנים.',
      keywords: ['רשת חברתית לאירוע', 'קיר תמונות לאירוע', 'אינסטגרם לאירוע חברה', 'תמונות מיום כיף', 'שיתוף תמונות באירוע', 'אפליקציה לאירוע חברה', 'פורים בחברה', 'יום גיבוש', 'Social Wall'],
    },
    nav: { how: 'איך זה עובד', ways: 'מה יש בפנים', pricing: 'מחירים', cta: 'דברו איתנו' },
    hero: {
      eyebrow: 'לאירועי חברה',
      tagline: ['מצטלמים. משתפים. מפרגנים.', 'הרשת החברתית הפרטית לאירועים.'],
      lead: 'אינסטגרם משלכם ליום אחד. העובדים סורקים QR, מעלים תמונות ונותנים לייקים, ורק מי שבאירוע רואה.',
      ctaPrimary: 'דברו איתנו',
      ctaSecondary: 'התנסו עכשיו',
      chips: ['בלי אפליקציה', 'רק לאנשי האירוע', 'נמחק בסוף'],
      stats: [
        { value: '0', label: 'אפליקציות להורדה' },
        { value: '4', label: 'דרכי כניסה' },
        { value: '30', label: 'יום עד מחיקה' },
      ],
    },
    demo: {
      title: 'נסו בעצמכם.',
      text: 'זו הרשת כמו שהעובדים רואים אותה. העלו תמונה, תנו לייק ובחרו מחלקה. מה שתעלו נשאר רק אצלכם.',
    },
    steps: {
      title: 'שלוש שניות ואתם בפנים.',
      items: [
        { title: 'סורקים', text: 'QR על השולחן, על השלט או בוואטסאפ. מי שכבר בפנים מראה את הקוד לחבר.' },
        { title: 'מצטלמים', text: 'מעלים תמונה עם כיתוב ובוחרים מחלקה.' },
        { title: 'מפרגנים', text: 'לייק עם קונפטי, ורואים איזו מחלקה מובילה.' },
      ],
    },
    ways: {
      title: 'מה יש בפנים.',
      items: [
        {
          badge: 'פיד',
          title: 'פיד אחד לכל האירוע',
          text: 'כל התמונות במקום אחד, מתעדכנות לבד.',
          visual: { image: { src: PHOTO(1), alt: 'איור: חברי צוות מצטלמים בסלפי ביום כיף בפארק' } },
        },
        {
          badge: 'מחלקות',
          title: 'מרוץ מחלקות',
          text: 'לכל מחלקה פיד משלה, ותחרות על הכי הרבה לייקים.',
          visual: { image: { src: PHOTO(9), alt: 'איור: צוות מניף גביע אחרי ניצחון', position: '50% 35%' } },
        },
        {
          badge: 'הפקה',
          title: 'פוסטים של צוות ההפקה',
          text: 'הכרזות, ברכות וזוכים, ישר לפיד של כולם.',
          visual: { image: { src: PHOTO(5), alt: 'איור: חברים מצטלמים מול במה בערב האירוע', position: '50% 30%' } },
        },
      ],
      chipsLabel: 'דרכי כניסה:',
      chips: [
        { icon: DoorOpen, label: 'פתוח לכולם' },
        { icon: MessageCircle, label: 'אימות בוואטסאפ' },
        { icon: ListChecks, label: 'רשימת עובדים' },
        { icon: ShieldCheck, label: 'רשימה + וואטסאפ' },
      ],
      audience: 'מתאים לימי כיף, לפורים, לכנסים ולאירועי חברה.',
    },
    customize: {
      title: 'אתם שולטים בכל מה שעולה.',
      items: [
        { icon: ImageIcon, label: 'לוגו ושם האירוע' },
        { icon: Palette, label: 'צבעים' },
        { icon: Users, label: 'מחלקות משלכם' },
        { icon: EyeOff, label: 'הסתרת פוסט בלחיצה' },
        { icon: Link2, label: 'קישור לצוות בשטח' },
        { icon: Clock, label: 'מחיקה אוטומטית בסוף' },
      ],
    },
    pricing: {
      title: 'רוצים Social Wall באירוע שלכם?',
      plans: [
        {
          name: 'מנוי ל־The Q',
          price: 'בקרוב',
          text: 'תוכלו להקים Social Wall בעצמכם מהדשבורד, יחד עם כל החוויות של The Q.',
          features: ['קישור וקוד QR משלכם', 'לוגו, צבעים ומחלקות', 'מודרציה מהדשבורד'],
          cta: { label: 'עדכנו אותי', kind: 'contact' },
        },
        {
          name: 'לאירוע אחד',
          price: 'אנחנו מקימים',
          text: 'מיתוג, רשימת עובדים, מחלקות וליווי ביום האירוע.',
          features: ['מיתוג מלא לפי האירוע', 'טעינת רשימת העובדים', 'פוסטים של צוות ההפקה', 'מחיקה מלאה בסוף'],
          cta: { label: 'קבלו הצעת מחיר', kind: 'contact' },
          highlight: true,
        },
      ],
      contactTitle: 'דברו איתנו',
      whatsappText: 'היי, אשמח לשמוע על Social Wall לאירוע שלנו',
      emailSubject: 'Social Wall – בקשת הצעת מחיר',
      labels: { whatsapp: 'וואטסאפ', email: 'אימייל', call: 'תיאום שיחה' },
    },
    faq: {
      title: 'שאלות נפוצות',
      items: [
        { q: 'צריך להוריד אפליקציה?', a: 'לא. סורקים ונכנסים מהדפדפן בטלפון.' },
        { q: 'מי יכול להיכנס?', a: 'אתם בוחרים: כולם, מי שאימת את הטלפון בוואטסאפ, רק מי שברשימת העובדים, או רשימה יחד עם וואטסאפ.' },
        { q: 'מה אם מישהו מעלה משהו לא מתאים?', a: 'הצוות מסתיר אותו בלחיצה, מהדשבורד או מהטלפון בשטח.' },
        { q: 'מה קורה לתמונות אחרי האירוע?', a: 'הכול נמחק אוטומטית אחרי מספר הימים שבחרתם, או מיד בלחיצה.' },
        { q: 'כמה אנשים זה מחזיק?', a: 'מאות משתתפים ואלפי תמונות באירוע אחד.' },
      ],
    },
    final: {
      title: 'מי יקבל הכי הרבה לייקים?',
      text: 'ספרו לנו על האירוע, או נסו את הרשת עכשיו.',
      cta: 'דברו איתנו',
      secondary: 'התנסו עכשיו',
      social: 'תמונות וסרטונים מאירועים שלנו',
    },
  },
  en: {
    name: 'Social Wall',
    brandColor: '#f43f5e',
    primaryCta: 'contact',
    meta: {
      title: 'Social Wall – The Private Social Network for Events | The Q',
      description:
        'A private Instagram for one event: employees scan a QR code, post photos, like and compete by department. No app, with moderation and deletion after the event.',
      ogAlt: 'Social Wall – Snap. Share. Cheer.',
      keywords: ['event social network', 'event photo wall', 'company event photo sharing', 'private instagram for events', 'team building photos', 'corporate event app', 'Social Wall'],
    },
    nav: { how: 'How it works', ways: 'What’s inside', pricing: 'Pricing', cta: 'Talk to us' },
    hero: {
      eyebrow: 'For company events',
      tagline: ['Snap. Share. Cheer.', 'The private social network for events.'],
      lead: 'Your own Instagram for one day. Employees scan a QR code, post photos and like each other’s, and only people at the event can see it.',
      ctaPrimary: 'Talk to us',
      ctaSecondary: 'Try it now',
      chips: ['No app', 'Event people only', 'Deleted afterwards'],
      stats: [
        { value: '0', label: 'apps to install' },
        { value: '4', label: 'ways to join' },
        { value: '30', label: 'days, then deleted' },
      ],
    },
    demo: {
      title: 'Try it yourself.',
      text: 'This is the network as employees see it. Post a photo, like one and pick a department. What you post stays on your device.',
    },
    steps: {
      title: 'Three seconds and you’re in.',
      items: [
        { title: 'Scan', text: 'A QR code on the table, a sign or WhatsApp. Anyone inside can show the code to a friend.' },
        { title: 'Snap', text: 'Post a photo with a caption and pick your department.' },
        { title: 'Cheer', text: 'Likes come with confetti, and you see which department leads.' },
      ],
    },
    ways: {
      title: 'What’s inside.',
      items: [
        {
          badge: 'Feed',
          title: 'One feed for the whole event',
          text: 'Every photo in one place, updating by itself.',
          visual: { image: { src: PHOTO(1), alt: 'Illustration: teammates taking a selfie at a fun day in the park' } },
        },
        {
          badge: 'Departments',
          title: 'Department race',
          text: 'Each department gets its own feed, racing for the most likes.',
          visual: { image: { src: PHOTO(9), alt: 'Illustration: a team raising a trophy after a win', position: '50% 35%' } },
        },
        {
          badge: 'Production',
          title: 'Posts from the production team',
          text: 'Announcements, shout-outs and winners, straight into everyone’s feed.',
          visual: { image: { src: PHOTO(5), alt: 'Illustration: friends taking a selfie in front of the stage at night', position: '50% 30%' } },
        },
      ],
      chipsLabel: 'Ways to join:',
      chips: [
        { icon: DoorOpen, label: 'Open to all' },
        { icon: MessageCircle, label: 'WhatsApp check' },
        { icon: ListChecks, label: 'Employee list' },
        { icon: ShieldCheck, label: 'List + WhatsApp' },
      ],
      audience: 'Made for fun days, Purim parties, conferences and company events.',
    },
    customize: {
      title: 'You control everything that goes up.',
      items: [
        { icon: ImageIcon, label: 'Logo and event name' },
        { icon: Palette, label: 'Colours' },
        { icon: Users, label: 'Your own departments' },
        { icon: EyeOff, label: 'Hide a post in one tap' },
        { icon: Link2, label: 'A link for staff on site' },
        { icon: Clock, label: 'Auto-delete afterwards' },
      ],
    },
    pricing: {
      title: 'Want a Social Wall at your event?',
      plans: [
        {
          name: 'The Q subscription',
          price: 'Coming soon',
          text: 'Set up your own Social Wall from the dashboard, along with every The Q experience.',
          features: ['Your own link and QR code', 'Logo, colours and departments', 'Moderation from the dashboard'],
          cta: { label: 'Keep me posted', kind: 'contact' },
        },
        {
          name: 'One event',
          price: 'We set it up',
          text: 'Branding, employee list, departments and support on the day.',
          features: ['Full event branding', 'Employee list loaded for you', 'Production team posts', 'Full deletion afterwards'],
          cta: { label: 'Get a quote', kind: 'contact' },
          highlight: true,
        },
      ],
      contactTitle: 'Talk to us',
      whatsappText: 'Hi, I’d like to hear about Social Wall for our event',
      emailSubject: 'Social Wall – quote request',
      labels: { whatsapp: 'WhatsApp', email: 'Email', call: 'Book a call' },
    },
    faq: {
      title: 'FAQ',
      items: [
        { q: 'Do people need to install an app?', a: 'No. They scan and join from the phone’s browser.' },
        { q: 'Who can get in?', a: 'Your choice: everyone, anyone who verifies their phone on WhatsApp, only people on the employee list, or the list plus WhatsApp.' },
        { q: 'What if someone posts something inappropriate?', a: 'Your team hides it in one tap, from the dashboard or from a phone on site.' },
        { q: 'What happens to the photos after the event?', a: 'Everything is deleted automatically after the number of days you choose, or right away in one tap.' },
        { q: 'How many people can it handle?', a: 'Hundreds of participants and thousands of photos at one event.' },
      ],
    },
    final: {
      title: 'Who’ll get the most likes?',
      text: 'Tell us about your event, or try the network now.',
      cta: 'Talk to us',
      secondary: 'Try it now',
      social: 'Photos and videos from our events',
    },
  },
};

export const SOCIALWALL_DEMO_LABELS: Record<Locale, { label: string; start: string; fullscreen: string }> = {
  he: { label: 'דמו חי של Social Wall', start: 'פתחו את הרשת', fullscreen: 'מסך מלא' },
  en: { label: 'Social Wall live demo', start: 'Open the network', fullscreen: 'Full screen' },
};

// The phone in the hero (SocialWallHero)
export const SOCIALWALL_HERO_LABELS: Record<
  Locale,
  { all: string; groups: string[]; author: string; group: string; caption: string; likes: string; alt: string }
> = {
  he: { all: 'הכל', groups: ['שיווק', 'פיתוח', 'HR'], author: 'גל חדד', group: 'HR', caption: 'זכינו!!! 🏆 HR לוקחים את הגביע', likes: '128', alt: 'איור: Social Wall בטלפון, פוסט של צוות עם גביע' },
  en: { all: 'All', groups: ['Marketing', 'R&D', 'HR'], author: 'Gal', group: 'HR', caption: 'We won!!! 🏆 HR takes the cup', likes: '128', alt: 'Illustration: Social Wall on a phone, a team post with a trophy' },
};
