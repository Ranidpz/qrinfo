'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, Trophy, X } from 'lucide-react';
import TenBoolViewer from '@/components/viewer/TenBoolViewer';
import SquareImageCropper from '@/components/viewer/SquareImageCropper';
import { NEAR_MISS_HUNDREDTHS, formatDiff } from '@/lib/tenbool/competition';
import {
  ApiError,
  clearIdentity,
  loadIdentity,
  saveIdentity,
  tenboolApi,
  type PlayerIdentity,
} from '@/lib/tenbool/client';
import { tenboolCompetition, tenboolFont, type TenBoolConfig } from '@/types/tenbool';

// 10 בול phone mode, the player's side: the regular game on the phone, every round reported to the
// server (it counts the attempts), and on a hit a short flow - WhatsApp code if the owner wants one,
// then a name + selfie - that puts the player on the big screen.

const WIN_FX_MS = 3450; // let the win strobe + confetti finish before the form slides in

type ClaimStep = 'phone' | 'code' | 'profile' | 'done';

const ERRORS: Record<string, string> = {
  INVALID_PHONE: 'מספר הטלפון לא תקין',
  PHONE_TAKEN: 'המספר הזה כבר בלוח',
  COOLDOWN: 'אפשר לבקש קוד חדש בעוד כמה שניות',
  RATE_LIMITED: 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות',
  SEND_FAILED: 'שליחת הקוד נכשלה, נסו שוב',
  WRONG_CODE: 'הקוד שגוי',
  EXPIRED: 'תוקף הקוד פג, בקשו קוד חדש',
  TOO_MANY_ATTEMPTS: 'יותר מדי ניסיונות, בקשו קוד חדש',
  INVALID_NAME: 'כתבו שם של לפחות 2 תווים',
  BAD_PHOTO: 'התמונה לא נתמכת, נסו תמונה אחרת',
  NOT_VERIFIED: 'צריך לאמת את הטלפון קודם',
};
const errorText = (e: unknown) => (e instanceof ApiError && ERRORS[e.code]) || 'משהו השתבש, נסו שוב';

export default function TenBoolPhonePlay({ codeId, title, config }: { codeId: string; title?: string; config?: TenBoolConfig }) {
  const identityRef = useRef<PlayerIdentity | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [nickname, setNickname] = useState('');
  const [nicknameSet, setNicknameSet] = useState(false);
  const [verified, setVerified] = useState(false);
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);
  const [wonAttempts, setWonAttempts] = useState<number | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [place, setPlace] = useState<number | null>(null);
  const [claimStep, setClaimStep] = useState<ClaimStep | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nearPrompt, setNearPrompt] = useState<number | null>(null); // the diff that put them on the list
  const roundRef = useRef<Promise<string | null> | null>(null);
  const timersRef = useRef<number[]>([]);
  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const font = tenboolFont(config);
  const { verifyWinners } = tenboolCompetition(config);

  const flash = useCallback((text: string) => {
    setNotice(text);
    timersRef.current.push(window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 3500));
  }, []);

  const openClaim = useCallback(
    (isVerified: boolean, verifyNeeded: boolean) => setClaimStep(verifyNeeded && !isVerified ? 'phone' : 'profile'),
    []
  );

  // Pick up where this phone left off (a refresh mid-flow, or coming back later)
  useEffect(() => {
    const id = loadIdentity(codeId);
    identityRef.current = id;
    if (!id) return;
    tenboolApi
      .me(codeId, id)
      .then((s) => {
        setAttempts(s.attempts);
        setNickname(s.nickname);
        setNicknameSet(s.nicknameSet);
        setVerified(s.verified);
        setWon(s.won);
        wonRef.current = s.won;
        setWonAttempts(s.wonAttempts);
        setClaimed(s.claimed);
        setPlace(s.place);
        if (s.won && !s.claimed) openClaim(s.verified, s.verifyWinners);
      })
      .catch((e) => {
        // The owner reset the game (or this code was rebuilt) - start fresh
        if (e instanceof ApiError && e.status === 401) {
          clearIdentity(codeId);
          identityRef.current = null;
        }
      });
  }, [codeId, openClaim]);

  // Keep the screen on while playing
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = () => {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      nav.wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const startOnServer = useCallback(async (retry = true): Promise<string | null> => {
    try {
      const r = await tenboolApi.startRound(codeId, identityRef.current);
      if (r.playerId && r.token) {
        identityRef.current = { playerId: r.playerId, token: r.token };
        saveIdentity(codeId, identityRef.current);
        if (r.nickname) setNickname(r.nickname);
      }
      if (r.won) return null;
      setAttempts(r.attempt);
      return r.roundId ?? null;
    } catch (e) {
      if (retry && e instanceof ApiError && e.status === 401 && identityRef.current) {
        clearIdentity(codeId);
        identityRef.current = null;
        return startOnServer(false);
      }
      return null;
    }
  }, [codeId]);

  const onStart = useCallback(() => {
    setNearPrompt(null);
    setNotice(null);
    // After the hit the board entry is fixed - the rest is just for fun, on the phone only
    if (wonRef.current) {
      roundRef.current = null;
      return;
    }
    roundRef.current = startOnServer();
  }, [startOnServer]);

  const onFinish = useCallback(
    async ({ ms, diff }: { ms: number; diff: number }) => {
      const pending = roundRef.current;
      roundRef.current = null;
      if (!pending) return;
      const roundId = await pending;
      const id = identityRef.current;
      if (!roundId || !id) {
        flash(diff === 0 ? 'הבול לא נשמר — אין חיבור לאינטרנט' : 'הניסיון לא נשמר — בדקו את החיבור');
        return;
      }
      try {
        const r = await tenboolApi.finishRound(codeId, id, roundId, ms);
        setAttempts(r.attempts);
        if (r.justWon) {
          wonRef.current = true;
          setWon(true);
          setWonAttempts(r.attempts);
          timersRef.current.push(window.setTimeout(() => openClaim(verified, verifyWinners), WIN_FX_MS));
        } else if (r.near && r.improved && !nicknameSet && r.diff != null && Math.abs(r.diff) < NEAR_MISS_HUNDREDTHS) {
          setNearPrompt(r.diff);
        }
      } catch {
        flash(diff === 0 ? 'הבול לא נשמר — אין חיבור לאינטרנט' : 'הניסיון לא נשמר — בדקו את החיבור');
      }
    },
    [codeId, flash, nicknameSet, openClaim, verified, verifyWinners]
  );

  const hud = (
    <div
      dir="rtl"
      className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] inset-x-0 flex justify-center z-[2]"
      style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif' }}
    >
      {claimed ? (
        <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-4 py-1.5 text-sm font-bold text-white backdrop-blur">
          <Trophy className="w-4 h-4 text-yellow-300" />
          {place ? `אתם במקום ${place} בלוח` : 'אתם בלוח'}
        </span>
      ) : won ? (
        <span className="rounded-full bg-black/45 px-4 py-1.5 text-sm font-bold text-white backdrop-blur">בול בניסיון ה-{wonAttempts}</span>
      ) : attempts > 0 ? (
        <span className="rounded-full bg-black/45 px-4 py-1.5 text-sm font-bold text-white backdrop-blur tabular-nums">ניסיון {attempts}</span>
      ) : null}
    </div>
  );

  return (
    <>
      <TenBoolViewer
        title={title}
        config={config}
        competition={{
          onStart,
          onFinish: (r) => void onFinish(r),
          locked: claimStep !== null,
          hud,
        }}
      />

      {notice && (
        <div dir="rtl" className="fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 pointer-events-none">
          <span className="rounded-full bg-black/75 px-4 py-2 text-sm font-bold text-white">{notice}</span>
        </div>
      )}

      {nearPrompt !== null && !claimStep && (
        <NearPrompt
          diff={nearPrompt}
          initial={nickname}
          onClose={() => setNearPrompt(null)}
          onSave={async (name) => {
            const id = identityRef.current;
            if (!id) return;
            const r = await tenboolApi.setName(codeId, id, name);
            setNickname(r.nickname);
            setNicknameSet(true);
            setNearPrompt(null);
          }}
        />
      )}

      {claimStep && (
        <ClaimFlow
          step={claimStep}
          setStep={setClaimStep}
          fontFamily={font.family}
          attempts={wonAttempts ?? attempts}
          initialName={nicknameSet ? nickname : ''}
          place={place}
          onVerified={() => setVerified(true)}
          onClaimed={(r) => {
            setClaimed(true);
            setPlace(r.place);
            setNickname(r.nickname);
            setNicknameSet(true);
          }}
          codeId={codeId}
          identity={() => identityRef.current}
        />
      )}
    </>
  );
}

function NearPrompt({
  diff,
  initial,
  onSave,
  onClose,
}: {
  diff: number;
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div dir="rtl" className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form
        className="mx-auto max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl p-4 space-y-3"
        style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif' }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onSave(name);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <p className="font-bold">
              נכנסתם לרשימת הכי קרובים! <span dir="ltr">({formatDiff(diff)})</span>
            </p>
            <p className="text-sm text-gray-600">איך לקרוא לכם על המסך הגדול?</p>
          </div>
          <button type="button" onClick={onClose} aria-label="סגרו" className="p-1 -m-1 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={initial}
            maxLength={20}
            className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-gray-900"
            aria-label="כינוי"
          />
          <button type="submit" disabled={busy || name.trim().length < 2} className="rounded-xl bg-gray-900 px-4 font-bold text-white disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמרו'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

function ClaimFlow({
  step,
  setStep,
  fontFamily,
  attempts,
  initialName,
  place,
  onVerified,
  onClaimed,
  codeId,
  identity,
}: {
  step: ClaimStep;
  setStep: (s: ClaimStep | null) => void;
  fontFamily: string;
  attempts: number;
  initialName: string;
  place: number | null;
  onVerified: () => void;
  onClaimed: (r: { place: number | null; nickname: string }) => void;
  codeId: string;
  identity: () => PlayerIdentity | null;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(initialName);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const run = async (fn: (id: PlayerIdentity) => Promise<void>) => {
    const id = identity();
    if (!id) return setError('משהו השתבש, רעננו את הדף');
    setBusy(true);
    setError(null);
    try {
      await fn(id);
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ApiError && e.code === 'COOLDOWN' && typeof e.data.secondsLeft === 'number') setCooldown(e.data.secondsLeft);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async (id) => {
      const r = await tenboolApi.sendCode(codeId, id, phone);
      setCooldown(r.cooldownSeconds);
      setCode('');
      setStep('code');
    });

  const input = 'w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-lg text-white placeholder-white/40 outline-none focus:border-white/60';
  const primary = 'w-full flex items-center justify-center gap-2 rounded-xl bg-white text-gray-900 py-3.5 text-lg font-black active:scale-[.98] transition-transform disabled:opacity-40';

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto"
      style={{ fontFamily: `'${fontFamily}', var(--font-assistant), system-ui, sans-serif` }}
    >
      <div className="min-h-full flex items-center justify-center p-5">
        <div className="w-full max-w-sm text-white text-center space-y-5">
          {step !== 'done' && (
            <div className="space-y-1">
              <div className="text-5xl font-black">בול!</div>
              <div className="text-lg opacity-80">{attempts === 1 ? 'כבר בניסיון הראשון' : `בניסיון ה-${attempts}`}</div>
            </div>
          )}

          {step === 'phone' && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <p className="opacity-90">כדי להיכנס ללוח ולפרסים, אמתו את מספר הטלפון. נשלח לכם קוד בוואטסאפ.</p>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                className={`${input} text-center tracking-wider`}
                aria-label="מספר טלפון"
              />
              <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9} className={primary}>
                {busy && <Loader2 className="w-5 h-5 animate-spin" />}
                שלחו לי קוד
              </button>
            </form>
          )}

          {step === 'code' && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async (id) => {
                  await tenboolApi.verifyCode(codeId, id, code);
                  onVerified();
                  setStep('profile');
                });
              }}
            >
              <p className="opacity-90">
                הקלידו את הקוד שקיבלתם בוואטסאפ למספר <span dir="ltr">{phone}</span>
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className={`${input} text-center text-3xl tracking-[0.6em] font-black`}
                aria-label="קוד אימות"
                autoFocus
              />
              <button type="submit" disabled={busy || code.length !== 4} className={primary}>
                {busy && <Loader2 className="w-5 h-5 animate-spin" />}
                אמתו
              </button>
              <div className="flex justify-center gap-4 text-sm">
                <button type="button" onClick={() => setStep('phone')} className="underline opacity-70">
                  שנו מספר
                </button>
                <button type="button" disabled={cooldown > 0 || busy} onClick={() => void sendCode()} className="underline opacity-70 disabled:no-underline disabled:opacity-40">
                  {cooldown > 0 ? `שלחו שוב בעוד ${cooldown}` : 'שלחו קוד שוב'}
                </button>
              </div>
            </form>
          )}

          {step === 'profile' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async (id) => {
                  const r = await tenboolApi.claim(codeId, id, name, photo);
                  onClaimed(r);
                  setStep('done');
                });
              }}
            >
              <p className="opacity-90">צלמו סלפי וכתבו שם — ככה תופיעו על המסך הגדול</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mx-auto block w-36 h-36 rounded-full overflow-hidden border-2 border-dashed border-white/50 bg-white/5"
                aria-label={photo ? 'צלמו שוב' : 'צלמו סלפי'}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1">
                    <Camera className="w-9 h-9" />
                    <span className="text-sm font-bold">צלמו סלפי</span>
                  </span>
                )}
              </button>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="השם שיופיע בלוח"
                maxLength={20}
                className={`${input} text-center`}
                aria-label="שם"
              />
              <button type="submit" disabled={busy || name.trim().length < 2} className={primary}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                {photo ? 'עלו ללוח' : 'עלו ללוח בלי תמונה'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCropFile(f);
                  e.target.value = '';
                }}
              />
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-yellow-400/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-yellow-300" />
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-black">אתם בלוח!</div>
                <div className="text-lg opacity-80">
                  {place ? `מקום ${place} · ` : ''}
                  {attempts === 1 ? 'בניסיון הראשון' : `${attempts} ניסיונות`}
                </div>
              </div>
              <p className="opacity-80">הסתכלו על המסך הגדול</p>
              <button type="button" onClick={() => setStep(null)} className={primary}>
                המשיכו לשחק בשביל הכיף
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="text-red-300 font-bold">
              {error}
            </p>
          )}
        </div>
      </div>

      {cropFile && (
        <SquareImageCropper
          file={cropFile}
          outputSize={600}
          onCancel={() => setCropFile(null)}
          onConfirm={(blob) => {
            setCropFile(null);
            setPhoto(blob);
            if (photoPreview) URL.revokeObjectURL(photoPreview);
            setPhotoPreview(URL.createObjectURL(blob));
          }}
          labels={{ title: 'מסדרים את התמונה', hint: 'הזיזו והגדילו עם האצבעות', confirm: 'אישור', cancel: 'ביטול', processing: 'מעבדים…' }}
        />
      )}
    </div>
  );
}
