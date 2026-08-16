// Raffle participant import — ONE parser shared by the Excel file drop and the
// copy-paste box, so both behave identically and both can be previewed before
// anything is written.
//
// The old importer guessed columns by position whenever it failed to recognise
// a header, which silently mangled code lists (a serial column landed in
// "first name" and the header row itself became a participant). Everything here
// is built around that failure: the header is detected from a wide keyword set,
// the code column is chosen by what the data actually looks like rather than by
// position, and the caller is handed a report + samples to show the user BEFORE
// committing.

import type { RaffleListType, RaffleParticipant } from './types';

export interface ImportReport {
  listType: RaffleListType;
  rows: number; // data rows examined (header excluded)
  loaded: number; // unique rows kept
  duplicates: number; // merged away (same phone / same code)
  skipped: number; // empty or unusable rows
  noPhone: number; // people mode only — rows with no phone
  headerDetected: boolean;
  mapping: string; // human-readable column mapping, shown to the user
  dupSamples: string[]; // a few examples of what was merged
}

export interface ImportResult {
  participants: RaffleParticipant[];
  report: ImportReport;
}

type Cell = string | number | null | undefined;

const H_PHONE = ['טלפון', 'נייד', 'phone', 'mobile', 'cell'];
const H_QTY = ['כמות', 'quantity', 'qty', 'מלאי', 'stock'];
const H_CODE = ['קוד', 'code', 'שובר', 'voucher', 'כרטיס', 'ticket', 'סריאל', 'serial'];
const H_LAST = ['שם משפחה', 'last name', 'lastname', 'surname', 'משפחה'];
const H_FIRST = ['שם פרטי', 'first name', 'firstname', 'name', 'שם'];
const H_SERIAL = ['מספר סידורי', "מס'", 'מס.', 'index', 'row', 'שורה', '#'];

const ALL_KEYWORDS = [...H_PHONE, ...H_QTY, ...H_CODE, ...H_LAST, ...H_FIRST, ...H_SERIAL];

const cell = (c: Cell): string => String(c ?? '').trim();

// A1-style column letter, so the mapping can be read against the real file.
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// Israeli phone normalisation. Excel eats the leading zero, so a 9-digit
// number is assumed to have lost one.
export function normalizePhone(raw: Cell): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  if (digits.length === 9) digits = '0' + digits;
  return digits;
}

function findCol(header: string[], keys: string[], taken: Set<number>): number {
  for (const k of keys) {
    const i = header.findIndex((h, idx) => !taken.has(idx) && h.includes(k));
    if (i >= 0) {
      taken.add(i);
      return i;
    }
  }
  return -1;
}

// Does this column read as a running serial (1,2,3… or 1,10,100…)? Those are
// the columns that must never be mistaken for the code.
function looksLikeSerial(values: string[]): boolean {
  if (values.length < 3) return false;
  let prev = -Infinity;
  for (const v of values) {
    if (!/^\d{1,6}$/.test(v)) return false;
    const n = Number(v);
    if (n <= prev) return false;
    prev = n;
  }
  return true;
}

// Choose the column holding the codes purely from the shape of the data:
// the widest consistently-filled column that isn't a running serial.
function pickCodeColumn(rows: Cell[][], start: number): number {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (width <= 1) return 0;
  const sample = rows.slice(start, start + 200);
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < width; c++) {
    const values = sample.map((r) => cell(r[c])).filter(Boolean);
    if (values.length === 0) continue;
    const filled = values.length / Math.max(1, sample.length);
    if (filled < 0.5) continue;
    if (looksLikeSerial(values)) continue;
    const avgLen = values.reduce((s, v) => s + v.length, 0) / values.length;
    if (avgLen > bestScore) {
      bestScore = avgLen;
      best = c;
    }
  }
  return bestScore < 0 ? 0 : best;
}

export function parseMatrix(raw: Cell[][], listType: RaffleListType): ImportResult {
  // Drop rows that are entirely empty — trailing blanks are very common in Excel.
  const rows = raw.filter((r) => Array.isArray(r) && r.some((c) => cell(c) !== ''));

  const emptyReport = (mapping: string): ImportResult => ({
    participants: [],
    report: {
      listType,
      rows: 0,
      loaded: 0,
      duplicates: 0,
      skipped: 0,
      noPhone: 0,
      headerDetected: false,
      mapping,
      dupSamples: [],
    },
  });
  if (rows.length === 0) return emptyReport('לא נמצאו שורות');

  const header = rows[0].map((c) => cell(c).toLowerCase());
  const headerDetected = header.some((h) => h !== '' && ALL_KEYWORDS.some((k) => h.includes(k)));

  // More specific keys first so "שם" can't swallow the "שם משפחה" column.
  const taken = new Set<number>();
  const iPhone = findCol(header, H_PHONE, taken);
  const iQty = findCol(header, H_QTY, taken);
  const iCode = findCol(header, H_CODE, taken);
  const iLast = findCol(header, H_LAST, taken);
  const iFirst = findCol(header, H_FIRST, taken);

  const start = headerDetected ? 1 : 0;
  const seen = new Map<string, RaffleParticipant>();
  const dupSamples: string[] = [];
  let duplicates = 0;
  let skipped = 0;
  let noPhone = 0;
  let examined = 0;

  const qtyAt = (row: Cell[]): number => {
    if (iQty < 0) return 1;
    const q = parseInt(cell(row[iQty]), 10);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };

  if (listType === 'codes') {
    const codeCol = iCode >= 0 ? iCode : headerDetected && iFirst >= 0 ? iFirst : pickCodeColumn(rows, start);
    for (let r = start; r < rows.length; r++) {
      examined++;
      const code = cell(rows[r][codeCol]).replace(/\s+/g, ' ');
      if (!code) {
        skipped++;
        continue;
      }
      if (seen.has(code)) {
        duplicates++;
        if (dupSamples.length < 12) dupSamples.push(code);
        continue;
      }
      const quantity = qtyAt(rows[r]);
      seen.set(code, {
        id: code,
        firstName: code,
        lastName: '',
        phone: '',
        quantity,
        remaining: quantity,
      });
    }
    const src = iCode >= 0 ? `עמודה ${columnLetter(codeCol)} (״${cell(rows[0][codeCol])}״)` : `עמודה ${columnLetter(codeCol)}`;
    return {
      participants: [...seen.values()],
      report: {
        listType,
        rows: examined,
        loaded: seen.size,
        duplicates,
        skipped,
        noPhone: 0,
        headerDetected,
        mapping: `קוד: ${src}${iQty >= 0 ? ` · כמות: עמודה ${columnLetter(iQty)}` : ''}`,
        dupSamples,
      },
    };
  }

  // people
  const cFirst = iFirst >= 0 ? iFirst : 0;
  const cLast = iLast >= 0 ? iLast : headerDetected ? -1 : 1;
  const cPhone = iPhone >= 0 ? iPhone : headerDetected ? -1 : 2;
  const cQty = iQty >= 0 ? iQty : headerDetected ? -1 : 3;

  for (let r = start; r < rows.length; r++) {
    examined++;
    const row = rows[r];
    const firstName = cell(row[cFirst]);
    const lastName = cLast >= 0 ? cell(row[cLast]) : '';
    const phone = cPhone >= 0 ? normalizePhone(row[cPhone]) : '';
    if (!firstName && !lastName && !phone) {
      skipped++;
      continue;
    }
    if (!phone) noPhone++;
    const key = phone || `row-${r}`;
    // Phone is the unique key. Same phone twice = one person (first kept);
    // same name with different phones = different people, both kept.
    if (phone && seen.has(key)) {
      duplicates++;
      const nm = `${firstName} ${lastName}`.trim();
      if (dupSamples.length < 12 && nm) dupSamples.push(nm);
      continue;
    }
    const q = cQty >= 0 ? parseInt(cell(row[cQty]), 10) : 1;
    const quantity = Number.isFinite(q) && q > 0 ? q : 1;
    seen.set(key, { id: key, firstName, lastName, phone, quantity, remaining: quantity });
  }

  const part: string[] = [`שם: עמודה ${columnLetter(cFirst)}`];
  if (cLast >= 0) part.push(`שם משפחה: ${columnLetter(cLast)}`);
  if (cPhone >= 0) part.push(`טלפון: ${columnLetter(cPhone)}`);
  if (cQty >= 0) part.push(`כמות: ${columnLetter(cQty)}`);

  return {
    participants: [...seen.values()],
    report: {
      listType,
      rows: examined,
      loaded: seen.size,
      duplicates,
      skipped,
      noPhone,
      headerDetected,
      mapping: part.join(' · '),
      dupSamples,
    },
  };
}

// Copy-paste from Excel arrives tab-separated; a hand-typed list is one value
// per line. Only fall back to comma/semicolon splitting when there is no tab
// anywhere, so a name like "כהן, ישראל" isn't torn in half.
export function parseText(text: string, listType: RaffleListType): ImportResult {
  const body = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!body.trim()) return parseMatrix([], listType);
  const hasTab = body.includes('\t');
  const rows = body.split('\n').map((line) => (hasTab ? line.split('\t') : line.split(/[;,]/)).map((c) => c.trim()));
  return parseMatrix(rows, listType);
}
