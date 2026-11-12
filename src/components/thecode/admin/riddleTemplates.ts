// הקוד admin — "רעיונות לחידה": observation templates the organizer completes on site.
// Separate from the ready-made riddle bank (src/lib/thecode/riddleBank.ts): a template has no
// fixed answer — the organizer fills the blank (___) with something that is really there, then
// writes the answer, and the collected letter is derived from it as always.

/** The blank the organizer replaces with a real detail of the place. */
export const TEMPLATE_BLANK = '___';

export interface RiddleTemplate {
  id: string;
  text: string;
}

export const RIDDLE_TEMPLATES: RiddleTemplate[] = [
  { id: 'vase', text: 'מצאו את האגרטל עם ה־___. מה הצבע שלו?' },
  { id: 'picture-color', text: 'יש כאן תמונה של ___. מה הצבע של ה־___ בתמונה?' },
  { id: 'ceiling', text: 'לכו 3 צעדים אחורה. מה אתם רואים בתקרה?' },
  { id: 'sign', text: 'מצאו את השלט שליד ה־___. מה המילה הראשונה שכתובה עליו?' },
  { id: 'count', text: 'כמה ___ יש כאן? כתבו את המספר במילים.' },
  { id: 'behind', text: 'מה עומד מאחורי ה־___?' },
  { id: 'under', text: 'הציצו מתחת ל־___. מה מסתתר שם?' },
  { id: 'window', text: 'הסתכלו מהחלון הקרוב. מה אתם רואים מול ה־___?' },
  { id: 'animal', text: 'איזו חיה מופיעה על ה־___?' },
  { id: 'shape', text: 'איזו צורה יש ל־___ שליד הגמד?' },
  { id: 'material', text: 'ממה עשוי ה־___ שעומד כאן?' },
  { id: 'sound', text: 'עמדו בשקט רגע. מה שומעים מכיוון ה־___?' },
  { id: 'turn', text: 'הסתובבו עם הגב לגמד. מה הדבר הראשון שאתם רואים?' },
  { id: 'knowledge', text: 'שאלת ידע: מה ___?' },
];
