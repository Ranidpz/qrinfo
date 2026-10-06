import { createHash } from 'node:crypto';

export function dateParts(date, timeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}
export function wallTimeToDate({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let epoch = wall;
  for (let i = 0; i < 4; i++) {
    const p = dateParts(new Date(epoch), timeZone);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    epoch += wall - represented;
  }
  const p = dateParts(new Date(epoch), timeZone);
  if (p.year !== year || p.month !== month || p.day !== day || p.hour !== hour || p.minute !== minute) throw new Error('INVALID_MESSAGE_DATE');
  return new Date(epoch);
}
export function startOfDay(now, timeZone) {
  const { year, month, day } = dateParts(now, timeZone);
  return wallTimeToDate({ year, month, day }, timeZone).toISOString();
}
export function parseMessageDate(value, { dateOrder, timeZone }) {
  // WhatsApp pre-plain-text contains the message's timestamp, not its filename date.
  const text = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
  const time = text.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  const date = text.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (!time || !date) return null;
  let hour = Number(time[1]);
  if (time[3]) hour = hour % 12 + (time[3].toUpperCase() === 'PM' ? 12 : 0);
  try {
    return wallTimeToDate({
      year: Number(date[3].length === 2 ? `20${date[3]}` : date[3]),
      month: Number(date[dateOrder === 'DMY' ? 2 : 1]),
      day: Number(date[dateOrder === 'DMY' ? 1 : 2]), hour, minute: Number(time[2]),
    }, timeZone).toISOString();
  } catch { return null; }
}
export function parseDividerDate(label, time, config, now = new Date()) {
  const clean = label.trim();
  let day;
  if (/^(Today|היום)$/i.test(clean)) day = dateParts(now, config.timeZone);
  else if (/^(Yesterday|אתמול)$/i.test(clean)) {
    const p = dateParts(now, config.timeZone);
    const previous = new Date(Date.UTC(p.year, p.month - 1, p.day - 1, 12));
    day = { year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1, day: previous.getUTCDate() };
  } else {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays.findIndex((name) => name.toLowerCase() === clean.toLowerCase());
    if (weekday >= 0) {
      const p = dateParts(now, config.timeZone);
      const current = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
      const delta = (current.getUTCDay() - weekday + 7) % 7 || 7;
      current.setUTCDate(current.getUTCDate() - delta);
      day = { year: current.getUTCFullYear(), month: current.getUTCMonth() + 1, day: current.getUTCDate() };
    }
  }
  const date = day ? (config.dateOrder === 'DMY' ? `${day.day}/${day.month}/${day.year}` : `${day.month}/${day.day}/${day.year}`) : clean;
  return parseMessageDate(`[${time}, ${date}]`, config);
}
export function messageKey(groupName, messageId) {
  return createHash('sha256').update(`${groupName}\0${messageId}`).digest('hex');
}
export function assertPdf(buffer) {
  if (!buffer.length || buffer.length > 25 * 1024 * 1024 || !buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('INVALID_OR_OVERSIZED_PDF');
}
export function slotDue(config, now, completedSlots) {
  const p = dateParts(now, config.timeZone);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const times = config.schedule.checks ? config.schedule.checks.filter(c => c.weekday === weekday).map(c => c.time) : config.schedule.weekdays.includes(weekday) ? config.schedule.times : [];
  const day = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  // On wake, catch up only the latest due slot on the current scheduled day.
  const latest = times.filter((time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) <= p.hour * 60 + p.minute).sort().at(-1);
  if (latest && config.schedule.effectiveAfter && wallTimeToDate({ ...p, hour: Number(latest.slice(0, 2)), minute: Number(latest.slice(3)) }, config.timeZone).getTime() <= Date.parse(config.schedule.effectiveAfter)) return null;
  const key = latest && `${day}/${latest}`;
  return key && !completedSlots.includes(key) ? key : null;
}
