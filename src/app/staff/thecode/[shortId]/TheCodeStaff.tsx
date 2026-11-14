'use client';

// קוד הגמדים — the venue staff screen (phone first).
//   login (phone) → code (WhatsApp, 6 digits) → groups list → a group's sheet:
//   recovery code + QR that brings the group back into the game, rename, hide, remove photo.
// The device session lives in localStorage; the server re-checks it against the staff list
// on every call, so `unauthorized` at any point simply returns to the login.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Camera, Check, Copy, Eye, EyeOff, ImageOff, Loader2, LogOut, Pencil, RefreshCw, RotateCcw, Search, Trophy, X } from 'lucide-react';
import CodeBoxes, { emptyCode } from '@/components/auth/CodeBoxes';
import SquareImageCropper from '@/components/viewer/SquareImageCropper';
import { SELFIE_LIMITS } from '@/lib/thecode/selfie';
import { isInAppBrowser, openCurrentUrlInBrowser } from '@/lib/inAppBrowser';
import { THECODE_RESET_WORD } from '@/types/thecode-api';
import type {
  TheCodeStaffAction,
  TheCodeStaffAward,
  TheCodeStaffPlayer,
  TheCodeStaffResponse,
  TheCodeStaffVerifyResponse,
} from '@/types/thecode-api';

type Step = 'loading' | 'login' | 'code' | 'list';
interface Session { token: string; expiresAt: number }

const PHONE_KEY = 'thecode_staff_phone';
const sessionKey = (codeId: string) => `thecode_staff_${codeId}`;

function readSession(codeId: string): Session | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(sessionKey(codeId)) || 'null') as Session | null;
    return s && typeof s.token === 'string' && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

async function post<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** "לפני 5 דקות" — when the group was last seen. */
export function seenAgo(at: number, now: number): string {
  const min = Math.floor((now - at) / 60_000);
  if (!at) return '';
  if (min < 1) return 'עכשיו';
  if (min < 60) return min === 1 ? 'לפני דקה' : `לפני ${min} דקות`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? 'לפני שעה' : `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'לפני יום' : `לפני ${days} ימים`;
}

/** "14.11, 19:40" — when the prize was handed. */
export function whenHanded(at: number): string {
  return new Date(at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The photo at the desk. Staff-authenticated; it hangs off the prize record, never on the board. */
async function sendPrizePhoto(codeId: string, token: string, playerId: string, blob: Blob): Promise<string | null> {
  const form = new FormData();
  form.set('codeId', codeId);
  form.set('token', token);
  form.set('playerId', playerId);
  form.set('file', blob, blob.type === 'image/jpeg' ? 'prize.jpg' : 'prize.webp');
  try {
    const res = await fetch('/api/thecode/staff/photo', { method: 'POST', body: form, cache: 'no-store' });
    const body = (await res.json()) as { ok?: boolean; photoUrl?: string } | null;
    return body?.ok && body.photoUrl ? body.photoUrl : null;
  } catch {
    return null;
  }
}

function Avatar({ p, size }: { p: TheCodeStaffPlayer; size: number }) {
  return p.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-bg-secondary" style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden>
      {p.emoji}
    </span>
  );
}

const BTN = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium transition-colors disabled:opacity-50';
const PRIMARY = `${BTN} bg-accent text-white hover:bg-accent-hover`;
const SECONDARY = `${BTN} border border-border bg-bg-card text-text-primary hover:bg-bg-hover`;

export default function TheCodeStaff({ codeId, shortId, title }: { codeId: string | null; shortId: string; title: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(emptyCode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [staffName, setStaffName] = useState('');
  const [players, setPlayers] = useState<TheCodeStaffPlayer[] | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const toLogin = useCallback((message = '') => {
    if (codeId) {
      try {
        window.localStorage.removeItem(sessionKey(codeId));
      } catch { /* nothing stored */ }
    }
    sessionRef.current = null;
    setPlayers(null);
    setOpenId(null);
    setDigits(emptyCode());
    setError('');
    setNotice(message);
    setStep('login');
  }, [codeId]);

  /** One staff action. `unauthorized` (expired, removed, switched off) → back to the login. */
  const act = useCallback(async (action: TheCodeStaffAction): Promise<Extract<TheCodeStaffResponse, { ok: true }> | Extract<TheCodeStaffResponse, { ok: false }>['error']> => {
    const res = await post<TheCodeStaffResponse>('/api/thecode/staff', { codeId, token: sessionRef.current?.token, action });
    if (!res) return 'server';
    if (!res.ok) {
      if (res.error === 'unauthorized') toLogin('ההתחברות הסתיימה. היכנסו שוב.');
      return res.error;
    }
    setStaffName(res.staffName);
    return res;
  }, [codeId, toLogin]);

  const loadList = useCallback(async () => {
    const res = await act({ type: 'list' });
    if (typeof res === 'string') {
      if (res !== 'unauthorized') setError('לא הצלחנו לטעון את הקבוצות. נסו שוב.');
      return;
    }
    setError('');
    setPlayers(res.players || []);
  }, [act]);

  // Mount: a stored session goes straight to the list.
  useEffect(() => {
    if (!codeId) return;
    setInApp(isInAppBrowser());
    try {
      setPhone(window.localStorage.getItem(PHONE_KEY) || '');
    } catch { /* private mode */ }
    const s = readSession(codeId);
    sessionRef.current = s;
    if (!s) {
      setStep('login');
      return;
    }
    setStep('list');
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeId]);

  // Fresh data whenever the staff member comes back to the tab; a slow tick for "לפני X דקות".
  useEffect(() => {
    if (step !== 'list') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadList();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [step, loadList]);

  // Resend countdown.
  useEffect(() => {
    if (step !== 'code' || resendAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, resendAt]);

  const sendCode = async () => {
    if (busy) return;
    setError('');
    setNotice('');
    if (phone.replace(/\D/g, '').length < 9) {
      setError('הקלידו מספר טלפון נייד מלא.');
      return;
    }
    setBusy(true);
    const res = await post<{ ok: boolean; error?: string; resendInMs?: number }>('/api/thecode/staff/login', { codeId, phone });
    setBusy(false);
    if (!res || (!res.ok && res.error === 'server')) return setError('השליחה לא הצליחה. נסו שוב בעוד רגע.');
    if (!res.ok) return setError(res.error === 'rateLimited' ? 'יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.' : 'מספר הטלפון לא תקין. בדקו אותו ונסו שוב.');
    try {
      window.localStorage.setItem(PHONE_KEY, phone);
    } catch { /* private mode */ }
    setDigits(emptyCode());
    setResendAt(Date.now() + (res.resendInMs || 45_000));
    setNow(Date.now());
    setStep('code');
  };

  const verify = async (code: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await post<TheCodeStaffVerifyResponse>('/api/thecode/staff/verify', { codeId, phone, code });
    setBusy(false);
    if (!res || !res.ok) {
      setDigits(emptyCode());
      setError(res && res.error === 'rateLimited'
        ? 'יותר מדי ניסיונות. המתינו כמה דקות ונסו שוב.'
        : res && res.error === 'invalid'
          ? 'הקוד שגוי או שפג תוקפו. בדקו אותו, או בקשו קוד חדש.'
          : 'משהו השתבש. נסו שוב.');
      return;
    }
    const s = { token: res.token, expiresAt: res.expiresAt };
    sessionRef.current = s;
    try {
      window.localStorage.setItem(sessionKey(codeId!), JSON.stringify(s));
    } catch { /* stays signed in for this tab only */ }
    setStaffName(res.staffName);
    setNotice('');
    setStep('list');
    void loadList();
  };

  const logout = async () => {
    await act({ type: 'logout' });
    toLogin();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (players || []).filter((p) => !q || p.familyName.toLowerCase().includes(q));
  }, [players, query]);
  const open = players?.find((p) => p.id === openId) || null;
  const patchPlayer = (p: TheCodeStaffPlayer) => setPlayers((list) => (list || []).map((x) => (x.id === p.id ? p : x)));
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (!codeId) {
    return (
      <Shell title="קוד הגמדים">
        <p className="mt-10 text-center text-text-secondary">הקישור הזה לא תקין. בקשו ממנהל החוויה קישור חדש.</p>
      </Shell>
    );
  }

  return (
    <Shell title={title} right={step === 'list' && (
      <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-text-secondary hover:bg-bg-hover">
        <LogOut size={16} aria-hidden /> יציאה
      </button>
    )}>
      {inApp && step !== 'list' && (
        <div className="mb-4 rounded-xl border border-border bg-bg-card p-3 text-sm">
          <p>פתחתם את הקישור מתוך וואטספ. כדי להישאר מחוברים, פתחו אותו בדפדפן.</p>
          <button type="button" onClick={() => openCurrentUrlInBrowser()} className="mt-2 font-medium text-accent">פתחו בדפדפן</button>
        </div>
      )}

      {step === 'loading' && <Loader2 className="mx-auto mt-16 animate-spin text-text-secondary" aria-label="טוען" />}

      {step === 'login' && (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/theQ.png" alt="The Q" className="mx-auto size-16 rounded-2xl object-contain" />
            <h1 className="mt-3 text-xl font-semibold">כניסת צוות</h1>
            {title && <p className="mt-0.5 text-sm font-medium text-accent">{title}</p>}
            <p className="mt-2 text-text-secondary">הקלידו את מספר הטלפון שלכם, ונשלח אליו קוד בוואטספ.</p>
          </div>
          {notice && <p className="rounded-lg bg-bg-secondary px-3 py-2 text-sm">{notice}</p>}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">מספר טלפון</span>
            <input
              className="input w-full text-lg" dir="ltr" type="tel" inputMode="tel" autoComplete="tel" placeholder="050-123-4567"
              value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }}
            />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className={`${PRIMARY} w-full`}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />} שלחו לי קוד בוואטספ
          </button>
          <p className="text-sm text-text-secondary">הכניסה פתוחה רק לאנשי צוות שמנהל החוויה הוסיף.</p>
        </form>
      )}

      {step === 'code' && (
        <div className="mt-6 space-y-5">
          <div>
            <h1 className="text-xl font-semibold">הקלידו את הקוד</h1>
            <p className="mt-1 text-text-secondary">
              אם המספר <span dir="ltr" className="font-medium text-text-primary">{phone}</span> רשום בצוות, נשלח אליו עכשיו קוד בוואטספ.
            </p>
          </div>
          <CodeBoxes value={digits} onChange={(d) => { setDigits(d); setError(''); }} onComplete={(c) => void verify(c)} disabled={busy} error={!!error} label="קוד בן 6 ספרות" digitLabel={(n) => `ספרה ${n}`} />
          {busy && <p className="flex items-center justify-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" aria-hidden /> בודקים</p>}
          {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy || wait > 0} onClick={() => void sendCode()} className={SECONDARY}>
              {wait > 0 ? `אפשר לבקש קוד חדש בעוד ${wait} שניות` : 'שלחו קוד חדש'}
            </button>
            <button type="button" onClick={() => { setStep('login'); setError(''); }} className="min-h-11 text-sm text-text-secondary">החליפו מספר טלפון</button>
          </div>
        </div>
      )}

      {step === 'list' && (
        <div>
          <p className="text-sm text-text-secondary">{staffName ? `שלום, ${staffName}` : ' '}</p>
          <div className="sticky top-0 z-10 -mx-4 flex gap-2 bg-bg-primary px-4 py-3">
            <label className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-secondary start-3" aria-hidden />
              <input className="input w-full ps-10" type="search" placeholder="חפשו שם של קבוצה" aria-label="חיפוש קבוצה" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" onClick={() => void loadList()} aria-label="רעננו את הרשימה" className={`${SECONDARY} px-3`}><RefreshCw size={18} aria-hidden /></button>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          {!players && !error && <Loader2 className="mx-auto mt-10 animate-spin text-text-secondary" aria-label="טוען" />}
          {players && !shown.length && (
            <p className="mt-10 text-center text-text-secondary">{players.length ? 'לא מצאנו קבוצה בשם הזה.' : 'עוד אין קבוצות במשחק.'}</p>
          )}
          <ul className="divide-y divide-border">
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 py-3 text-start">
                  <Avatar p={p} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.familyName}</span>
                    <span className="block text-sm text-text-secondary">
                      {seenAgo(p.lastSeenAt, now)}{p.hidden ? ' · מוסתרת מהלוח' : ''}
                    </span>
                    {p.award && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Trophy size={13} aria-hidden /> קיבלו פרס · {whenHanded(p.award.at)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block font-semibold tabular-nums">{p.points}</span>
                    <span className="block text-xs text-text-secondary">נקודות</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ResetBlock act={act} onDone={loadList} />
        </div>
      )}

      {open && (
        <GroupSheet
          key={open.id}
          player={open}
          codeId={codeId || ''}
          shortId={shortId}
          token={() => sessionRef.current?.token || ''}
          act={act}
          onChange={patchPlayer}
          onClose={() => setOpenId(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="he" className="min-h-screen bg-bg-primary text-text-primary">
      <div className="mx-auto max-w-md px-4 pb-6">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/theQ.png" alt="" aria-hidden className="size-8 shrink-0 rounded-lg object-contain" />
            <div className="min-w-0">
              <div className="truncate font-semibold">{title}</div>
              <div className="text-xs text-text-secondary">מסך צוות</div>
            </div>
          </div>
          {right}
        </header>
        <main className="pt-3">{children}</main>
        <PoweredBy />
      </div>
    </div>
  );
}

/** The Q branding, with a way out to the site. */
function PoweredBy() {
  return (
    <footer className="mt-10 flex justify-center border-t border-border pt-5">
      <a
        href="https://qr.playzones.app"
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <span>Powered by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/theQ.png" alt="" aria-hidden className="size-4 object-contain" />
        <span className="font-semibold">The Q</span>
        <span className="text-text-secondary">by Playzone</span>
      </a>
    </footer>
  );
}

/** One group: the recovery code (fetched on open — every open is logged) + the few staff actions. */
function GroupSheet({ player, codeId, shortId, token, act, onChange, onClose }: {
  player: TheCodeStaffPlayer;
  codeId: string;
  shortId: string;
  token: () => string;
  act: (action: TheCodeStaffAction) => Promise<Extract<TheCodeStaffResponse, { ok: true }> | string>;
  onChange: (p: TheCodeStaffPlayer) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState('');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(player.familyName);
  const [busy, setBusy] = useState('');
  const [confirmPhoto, setConfirmPhoto] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return; // React dev double-mount: one request = one log line
    asked.current = true;
    void act({ type: 'profile', playerId: player.id }).then((res) => {
      if (typeof res === 'string') return setFailed(res === 'notFound' ? 'הקבוצה הזו כבר לא קיימת.' : 'לא הצלחנו לטעון את הקוד. סגרו ונסו שוב.');
      setCode(res.recoveryCode || '');
      if (res.player) onChange(res.player);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const run = async (what: string, action: TheCodeStaffAction): Promise<boolean> => {
    if (busy) return false;
    setBusy(what);
    setFailed('');
    const res = await act(action);
    setBusy('');
    if (typeof res === 'string') {
      setFailed(res === 'invalidName' ? 'השם הזה לא מתאים. בחרו שם אחר.' : 'הפעולה לא הצליחה. נסו שוב.');
      return false;
    }
    if (res.player) onChange(res.player);
    return true;
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed('ההעתקה לא הצליחה. הקריאו את הקוד לקבוצה.');
    }
  };

  const joinUrl = code ? `${window.location.origin}/v/${encodeURIComponent(shortId)}?join=${code}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={player.familyName} dir="rtl" onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bg-card p-5 text-text-primary sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <Avatar p={player} size={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{player.familyName}</div>
            <div className="text-sm text-text-secondary">{player.points} נקודות{player.hidden ? ' · מוסתרת מהלוח' : ''}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="סגרו" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-bg-hover"><X size={22} aria-hidden /></button>
        </div>

        <section className="mt-5 rounded-xl bg-bg-secondary p-4 text-center">
          <div className="text-sm text-text-secondary">קוד השחזור של הקבוצה</div>
          {code === null && !failed && <Loader2 className="mx-auto my-6 animate-spin text-text-secondary" aria-label="טוען" />}
          {code !== null && (
            <>
              <div dir="ltr" className="mt-1 select-all font-mono text-4xl font-bold tracking-[0.2em]">{code}</div>
              <button type="button" onClick={() => void copy()} className={`${PRIMARY} mt-3 w-full`}>
                {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied ? 'הקוד הועתק' : 'העתיקו את הקוד'}
              </button>
              <div className="mt-4 flex justify-center">
                <div className="rounded-xl bg-white p-3"><QRCodeSVG value={joinUrl} size={168} marginSize={0} /></div>
              </div>
              <p className="mt-2 text-sm text-text-secondary">בקשו מהקבוצה לסרוק במצלמת הטלפון. הם יחזרו ישר למשחק שלהם.</p>
            </>
          )}
        </section>

        {failed && <p role="alert" className="mt-3 text-sm text-danger">{failed}</p>}

        <PrizeSection player={player} codeId={codeId} token={token} busy={!!busy} run={run} onChange={onChange} />

        <section className="mt-4 space-y-2">
          {renaming ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run('rename', { type: 'rename', playerId: player.id, familyName: name }).then((ok) => ok && setRenaming(false)); }}>
              <input className="input min-w-0 flex-1" value={name} maxLength={20} autoFocus aria-label="שם הקבוצה" onChange={(e) => setName(e.target.value)} />
              <button type="submit" disabled={!!busy || !name.trim()} className={PRIMARY}>שמרו</button>
              <button type="button" onClick={() => { setRenaming(false); setName(player.familyName); }} className={SECONDARY}>בטלו</button>
            </form>
          ) : (
            <button type="button" onClick={() => setRenaming(true)} className={`${SECONDARY} w-full justify-start`}><Pencil size={18} aria-hidden /> שנו את שם הקבוצה</button>
          )}
          <button type="button" disabled={!!busy} onClick={() => void run('hide', { type: 'hide', playerId: player.id, hidden: !player.hidden })} className={`${SECONDARY} w-full justify-start`}>
            {player.hidden ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />} {player.hidden ? 'החזירו ללוח התוצאות' : 'הסתירו מלוח התוצאות'}
          </button>
          {player.photoUrl && (confirmPhoto ? (
            <div className="flex gap-2">
              <button type="button" disabled={!!busy} onClick={() => void run('photo', { type: 'removePhoto', playerId: player.id }).then(() => setConfirmPhoto(false))} className={`${BTN} flex-1 bg-danger text-white`}>כן, הסירו את התמונה</button>
              <button type="button" onClick={() => setConfirmPhoto(false)} className={SECONDARY}>בטלו</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmPhoto(true)} className={`${SECONDARY} w-full justify-start`}><ImageOff size={18} aria-hidden /> הסירו את התמונה</button>
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * The prize at the reception desk. Handing it changes nothing on the board — the group earned
 * its place — it only records that the prize is gone, so the same group cannot collect twice.
 * The photo is for the venue only: it is never shown on the board or on the big screen.
 */
function PrizeSection({ player, codeId, token, busy, run, onChange }: {
  player: TheCodeStaffPlayer;
  codeId: string;
  token: () => string;
  busy: boolean;
  run: (what: string, action: TheCodeStaffAction) => Promise<boolean>;
  onChange: (p: TheCodeStaffPlayer) => void;
}) {
  const [prize, setPrize] = useState('');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const award: TheCodeStaffAward | undefined = player.award;

  const upload = async (blob: Blob) => {
    setUploading(true);
    setPhotoFailed(false);
    const photoUrl = await sendPrizePhoto(codeId, token(), player.id, blob);
    setUploading(false);
    if (!photoUrl || !award) return setPhotoFailed(true);
    onChange({ ...player, award: { ...award, photoUrl } });
  };

  return (
    <section className="mt-4 rounded-xl border border-border p-4">
      <input
        ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] || null; e.target.value = ''; if (f) setFile(f); }}
      />
      <h3 className="flex items-center gap-2 font-semibold"><Trophy size={18} className="text-success" aria-hidden /> הפרס</h3>

      {!award ? (
        <>
          <p className="mt-1 text-sm text-text-secondary">
            {player.points > 0 ? `${player.points} נקודות. מוסרים את הפרס רק פעם אחת לקבוצה.` : 'לקבוצה הזו עוד אין נקודות.'}
          </p>
          <input
            className="input mt-3 w-full" maxLength={40} placeholder="איזה פרס (לא חובה)" aria-label="איזה פרס"
            value={prize} onChange={(e) => setPrize(e.target.value)}
          />
          <button
            type="button" disabled={busy} className={`${PRIMARY} mt-2 w-full`}
            onClick={() => void run('award', { type: 'award', playerId: player.id, prize: prize.trim() || undefined })}
          >
            <Trophy size={18} aria-hidden /> מסרו את הפרס
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm">
            נמסר ב־{whenHanded(award.at)} על ידי {award.staffName}
            {award.rank ? ` · מקום ${award.rank}` : ''} · {award.points} נקודות
          </p>
          {award.prize && <p className="mt-0.5 text-sm font-medium">{award.prize}</p>}

          {award.photoUrl ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={award.photoUrl} alt="" className="size-20 rounded-xl object-cover" />
              <button type="button" disabled={busy} className={`${SECONDARY} flex-1 justify-start`}
                onClick={() => void run('awardPhoto', { type: 'removeAwardPhoto', playerId: player.id })}>
                <ImageOff size={18} aria-hidden /> הסירו את התמונה
              </button>
            </div>
          ) : (
            <button type="button" disabled={uploading} className={`${SECONDARY} mt-3 w-full justify-start`} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />} צלמו את הקבוצה עם הפרס
            </button>
          )}
          {photoFailed && <p role="alert" className="mt-2 text-sm text-danger">התמונה לא נשמרה. נסו שוב.</p>}

          {confirmUndo ? (
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} className={`${BTN} flex-1 bg-danger text-white`}
                onClick={() => void run('undoAward', { type: 'undoAward', playerId: player.id }).then(() => setConfirmUndo(false))}>
                כן, בטלו את המסירה
              </button>
              <button type="button" className={SECONDARY} onClick={() => setConfirmUndo(false)}>השאירו</button>
            </div>
          ) : (
            <button type="button" className="mt-2 min-h-11 w-full text-sm text-text-secondary" onClick={() => setConfirmUndo(true)}>
              נמסר בטעות? בטלו את המסירה
            </button>
          )}
        </>
      )}

      {file && (
        <SquareImageCropper
          file={file}
          outputSize={SELFIE_LIMITS.sizePx}
          quality={0.8}
          labels={{ title: 'תמונה עם הפרס', hint: 'הזיזו והגדילו עם האצבעות.', confirm: 'שמרו', cancel: 'ביטול', processing: 'מכינים…' }}
          onCancel={() => setFile(null)}
          onConfirm={async (blob) => { setFile(null); await upload(blob); }}
        />
      )}
    </section>
  );
}

/** A new round. Destructive, so the staff member types the word itself. */
function ResetBlock({ act, onDone }: {
  act: (action: TheCodeStaffAction) => Promise<Extract<TheCodeStaffResponse, { ok: true }> | string>;
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [done, setDone] = useState<number | null>(null);

  const reset = async () => {
    setBusy(true);
    setFailed('');
    const res = await act({ type: 'resetGame', confirm: word.trim() });
    setBusy(false);
    if (typeof res === 'string') return setFailed('האיפוס לא בוצע. נסו שוב.');
    setDone(res.reset?.groups ?? 0);
    setOpen(false);
    setWord('');
    await onDone();
  };

  return (
    <section className="mt-10 border-t border-border pt-5">
      {done !== null && (
        <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          המשחק אופס. {done === 1 ? 'קבוצה אחת חזרה' : `${done} קבוצות חזרו`} לאפס נקודות.
        </p>
      )}
      <button type="button" onClick={() => { setOpen(true); setDone(null); }} className="min-h-11 text-sm text-text-secondary underline-offset-4 hover:underline">
        התחילו סבב חדש
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tc-reset-title" dir="rtl" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-bg-card p-5 text-text-primary sm:rounded-2xl">
            <h2 id="tc-reset-title" className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle size={20} className="text-danger" aria-hidden /> להתחיל סבב חדש?
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              כל הקבוצות יחזרו לאפס נקודות, האלבום שלהן יתרוקן ולוח התוצאות יתחיל מחדש. השמות וקודי הכניסה נשארים,
              וכל קבוצה יכולה להמשיך לשחק מההתחלה. אי אפשר לבטל את זה.
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium">הקלידו את המילה {THECODE_RESET_WORD} כדי לאשר</span>
              <input className="input w-full text-lg" value={word} autoFocus aria-label={`הקלידו ${THECODE_RESET_WORD}`} onChange={(e) => { setWord(e.target.value); setFailed(''); }} />
            </label>
            {failed && <p role="alert" className="mt-2 text-sm text-danger">{failed}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy || word.trim() !== THECODE_RESET_WORD} className={`${BTN} flex-1 bg-danger text-white`} onClick={() => void reset()}>
                {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <RotateCcw size={18} aria-hidden />} אפסו את המשחק
              </button>
              <button type="button" className={SECONDARY} onClick={() => setOpen(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
