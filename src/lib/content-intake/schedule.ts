export type IntakeCheck = { weekday: number; time: string };
export type IntakeSchedule = { checks: IntakeCheck[]; timeZone: 'Asia/Jerusalem'; revision: string; effectiveAfter: string | null };
export const DEFAULT_CHECKS: IntakeCheck[] = [0, 4].flatMap(weekday => ['10:05', '12:00', '14:00'].map(time => ({ weekday, time })));
export function validateChecks(value: unknown): IntakeCheck[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 28) return null;
  const checks: IntakeCheck[] = [];
  for (const item of value) {
    if (!item || !Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6 || typeof item.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.time)) return null;
    if (checks.some(c => c.weekday === item.weekday && c.time === item.time)) return null;
    checks.push({ weekday: item.weekday, time: item.time });
  }
  return checks.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}
export const defaultSchedule = (): IntakeSchedule => ({ checks: DEFAULT_CHECKS, timeZone: 'Asia/Jerusalem', revision: 'default-v1', effectiveAfter: null });
