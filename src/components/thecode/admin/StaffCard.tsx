'use client';

import { useState } from 'react';
import { Check, Copy, History, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { formatPhoneForDisplay, isValidIsraeliMobile, normalizePhoneNumber } from '@/lib/phone-utils';
import { STAFF_LIMITS } from '@/lib/thecode/server/staff';
import type { TheCodeStaffMember } from '@/types/thecode';
import type { TheCodeStaffLogEntry } from '@/types/thecode-api';
import type { ScreenProps } from './model';
import { Button, Card, Toggle } from './ui';

// קוד הגמדים admin — "צוות": who may open the staff screen (WhatsApp code to their own phone),
// the link to send them, and the log of what they did. The list is saved with the adventure
// (locked doc); the server re-normalizes every phone.

const LOG_TEXT: Record<TheCodeStaffLogEntry['action'], (e: TheCodeStaffLogEntry) => string> = {
  login: () => 'נכנס למסך הצוות',
  viewCode: (e) => `פתח את קוד השחזור של "${e.playerName}"`,
  rename: (e) => `שינה את השם של "${e.playerName}" ל"${e.detail}"`,
  hide: (e) => `הסתיר את "${e.playerName}" מהלוח`,
  show: (e) => `החזיר את "${e.playerName}" ללוח`,
  removePhoto: (e) => `הסיר את התמונה של "${e.playerName}"`,
};

const when = (at: number) => new Date(at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function StaffCard({ state, actions, links }: Pick<ScreenProps, 'state' | 'actions' | 'links'>) {
  const staff = state.config.staff || [];
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [log, setLog] = useState<TheCodeStaffLogEntry[] | null | 'loading'>(null);
  const [logFailed, setLogFailed] = useState(false);

  const save = (next: TheCodeStaffMember[]) => actions.updateConfig({ staff: next.length ? next : undefined });

  const add = () => {
    const first = firstName.trim();
    if (!first) return setError('הקלידו שם פרטי.');
    if (!isValidIsraeliMobile(phone)) return setError('הקלידו מספר נייד ישראלי תקין, למשל 050-123-4567.');
    const normalized = normalizePhoneNumber(phone);
    if (staff.some((s) => s.phone === normalized)) return setError('המספר הזה כבר ברשימה.');
    if (staff.length >= STAFF_LIMITS.members) return setError(`אפשר להוסיף עד ${STAFF_LIMITS.members} אנשי צוות.`);
    const id = `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; // a list key, not a secret
    save([...staff, { id, firstName: first, lastName: lastName.trim(), phone: normalized, active: true, addedAt: Date.now() }]);
    setFirstName('');
    setLastName('');
    setPhone('');
    setError('');
  };

  const copy = async () => {
    if (!links?.staff) return;
    try {
      await navigator.clipboard.writeText(links.staff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is visible — it can be selected by hand */ }
  };

  const showLog = async () => {
    if (!links?.staffLog) return;
    setLog('loading');
    setLogFailed(false);
    const entries = await links.staffLog();
    setLog(entries);
    setLogFailed(!entries);
  };

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Users size={20} className="text-accent" aria-hidden /> צוות
      </h2>
      <p className="mt-1 text-text-secondary">
        אנשי הצוות נכנסים למסך הצוות עם קוד שנשלח לוואטספ שלהם. שם הם רואים את הקבוצות, נותנים קוד שחזור לקבוצה שחזרה למשחק, ומשנים שם או מסתירים קבוצה. הם לא רואים חידות, תשובות או הגדרות.
      </p>

      <div className="mt-4 rounded-lg bg-bg-secondary px-4 py-3">
        <div className="text-sm font-medium">הקישור למסך הצוות</div>
        {links?.staff ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 basis-56 select-all truncate rounded-md bg-bg-card px-3 py-2 text-sm">{links.staff}</code>
            <Button size="sm" icon={copied ? Check : Copy} onClick={() => void copy()}>{copied ? 'הועתק' : 'העתיקו'}</Button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-secondary">הקישור יופיע כשההרפתקה שמורה.</p>
        )}
        <p className="mt-2 text-sm text-text-secondary">הקישור לבד לא פותח כלום. רק מי שברשימה ופעיל מקבל קוד, ומכשיר נשאר מחובר שבוע.</p>
      </div>

      <ul className="mt-4 divide-y divide-border">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{`${s.firstName} ${s.lastName}`.trim()}</div>
              <div dir="ltr" className="text-start text-sm text-text-secondary">{formatPhoneForDisplay(s.phone)}</div>
            </div>
            <span className="text-sm text-text-secondary">{s.active ? 'פעיל' : 'כבוי'}</span>
            <Toggle checked={s.active} onChange={(active) => save(staff.map((x) => (x.id === s.id ? { ...x, active } : x)))} label={`גישה של ${s.firstName}`} />
            <button type="button" aria-label={`מחקו את ${s.firstName}`} onClick={() => save(staff.filter((x) => x.id !== s.id))} className="flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-danger/10">
              <Trash2 size={18} aria-hidden />
            </button>
          </li>
        ))}
        {!staff.length && <li className="py-3 text-text-secondary">עוד אין אנשי צוות. הוסיפו גם את עצמכם כדי להיכנס למסך.</li>}
      </ul>

      <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input" placeholder="שם פרטי" aria-label="שם פרטי" maxLength={STAFF_LIMITS.name} value={firstName} onChange={(e) => { setFirstName(e.target.value); setError(''); }} />
        <input className="input" placeholder="שם משפחה" aria-label="שם משפחה" maxLength={STAFF_LIMITS.name} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="input" dir="ltr" type="tel" inputMode="tel" placeholder="050-123-4567" aria-label="טלפון נייד" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} />
        <Button type="submit" variant="primary" icon={Plus}>הוסיפו</Button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-2 text-sm text-text-secondary">כיבוי או מחיקה מנתקים את איש הצוות מיד, גם אם הוא מחובר עכשיו.</p>

      {links?.staffLog && (
        <div className="mt-5 border-t border-border pt-4">
          <Button size="sm" icon={log === 'loading' ? Loader2 : History} onClick={() => void showLog()} disabled={log === 'loading'}>
            {Array.isArray(log) ? 'רעננו את יומן הפעולות' : 'הציגו את יומן הפעולות'}
          </Button>
          {logFailed && <p role="alert" className="mt-2 text-sm text-danger">לא הצלחנו לטעון את היומן. נסו שוב.</p>}
          {Array.isArray(log) && (
            log.length ? (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
                {log.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-2">
                    <span dir="ltr" className="shrink-0 tabular-nums text-text-secondary">{when(e.at)}</span>
                    <span><span className="font-medium">{e.staffName}</span> — {LOG_TEXT[e.action]?.(e) ?? e.action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-secondary">עוד אין פעולות ביומן.</p>
            )
          )}
        </div>
      )}
    </Card>
  );
}
