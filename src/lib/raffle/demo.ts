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

// Demo set for the "code reveal" style: the code itself is the label, which is
// exactly how a real code list lands (one code per row, no phone).
// Ambiguous glyphs (I/O/0/1) are left out, as they are in printed codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateDemoCodes(count = 3000, length = 9): RaffleParticipant[] {
  const rand = rng(20260817);
  const out: RaffleParticipant[] = [];
  const used = new Set<string>();

  while (out.length < count) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
    }
    if (used.has(code)) continue;
    used.add(code);
    out.push({ id: code, firstName: code, lastName: '', phone: '', quantity: 1, remaining: 1 });
  }
  return out;
}

// Every demo row carries this instead of a phone number. Randomly generated
// numbers looked real enough to alarm people — and a random Israeli mobile
// WILL collide with somebody's actual line — so the demo shows a number that
// obviously never belongs to anyone.
export const DEMO_PHONE = '000000000';

// Deterministic demo set so the screen recording looks consistent run-to-run.
export function generateDemoParticipants(count = 1000): RaffleParticipant[] {
  const rand = rng(20260528);
  const out: RaffleParticipant[] = [];

  // The id used to be the phone, which kept rows unique. With one shared
  // placeholder phone it has to come from the index instead — ids drive the
  // per-row draw/edit/delete lookups, so duplicates would decrement every
  // matching row at once.
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    out.push({
      id: `demo-${String(i + 1).padStart(4, '0')}`,
      firstName: first,
      lastName: last,
      phone: DEMO_PHONE,
      quantity: 1,
      remaining: 1,
    });
  }
  return out;
}
