import type { RaffleParticipant } from './types';

const FIRST_NAMES = [
  'דין', 'ניר', 'תאיר', 'חיים', 'אריאלה', 'ערן', 'נועה', 'איתי', 'מאיה', 'יואב',
  'שירה', 'עומר', 'תמר', 'גיא', 'ליאור', 'הדר', 'רוני', 'אורי', 'יעל', 'דניאל',
  'אסף', 'מור', 'עידן', 'נטע', 'אלון', 'גל', 'שני', 'בן', 'ענבר', 'יותם',
  'אביב', 'רותם', 'עדי', 'נדב', 'מיכל', 'איל', 'ספיר', 'תום', 'הילה', 'אמיר',
  'נופר', 'יונתן', 'קרן', 'אלעד', 'דנה', 'שחר', 'מעיין', 'רן', 'אופיר', 'ליהי',
];

const LAST_NAMES = [
  'סימן טוב', 'נאור', 'אבוטבול', 'מזרחי', 'טובי', 'גולדשטיין', 'כהן', 'לוי', 'פרץ', 'ביטון',
  'דהן', 'אזולאי', 'אוחיון', 'גבאי', 'אדרי', 'מלכה', 'חדד', 'אברהם', 'פרידמן', 'שפירא',
  'רוזנברג', 'קליין', 'ברקוביץ', 'הראל', 'שמש', 'נחמיאס', 'אלבז', 'עמר', 'בן דוד', 'מויאל',
  'דרליצמן', 'צבע', 'מור', 'שלום', 'גרין', 'ברק', 'נוי', 'סלע', 'רז', 'בר',
];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Deterministic demo set so the screen recording looks consistent run-to-run.
export function generateDemoParticipants(count = 1000): RaffleParticipant[] {
  const rand = rng(20260528);
  const out: RaffleParticipant[] = [];
  const usedPhones = new Set<string>();

  while (out.length < count) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const prefix = ['050', '052', '053', '054', '055', '058'][Math.floor(rand() * 6)];
    const rest = String(Math.floor(rand() * 9000000) + 1000000);
    const phone = `${prefix}${rest}`;
    if (usedPhones.has(phone)) continue;
    usedPhones.add(phone);
    out.push({
      id: phone,
      firstName: first,
      lastName: last,
      phone,
      quantity: 1,
      remaining: 1,
    });
  }
  return out;
}
