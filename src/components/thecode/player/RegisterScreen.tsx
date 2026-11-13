'use client';

import { useState } from 'react';
import { describeGnome } from '@/components/thecode/GnomeFigure';
import type { TheCodeBranding } from '@/types/thecode';
import { BrandLogo, PoweredBy } from './Branding';
import { HowToPlayButton } from './HowToPlaySheet';
import { Avatar } from './Avatar';
import { EMOJIS, SelfieFlow, SymbolRow } from './SymbolPicker';
import { GnomeStage, ScreenBody, useSfx } from './ui';
import type { PlayerGnomeView, SelfieShot } from './types';

const MAX_NAME = 20;

interface Props {
  /** The venue's look on the opening screen (photo behind is drawn by the player shell). */
  branding?: TheCodeBranding | null;
  venueName: string;
  mode: 'new' | 'recover';
  firstGnome?: PlayerGnomeView;
  recoverError?: string;
  /** The server refused the family name. */
  nameError?: string;
  /** Adding a sibling from the switcher (not the first scan). */
  addingProfile: boolean;
  onRegister(familyName: string, emoji: string, photo?: SelfieShot): void;
  onRecover(code: string): void;
  onMode(mode: 'new' | 'recover'): void;
  /** Opens "איך משחקים" (absent = no button). */
  onHowToPlay?(): void;
  /** Offer a selfie as the group's symbol (absent / disabled = no camera tile at all). */
  selfie?: { enabled: boolean; days: number } | null;
  /** Back out of "add a family" to the family that was playing. */
  onCancel?(): void;
}

/** The vault title, the one big typographic moment of the app. */
export function CodeTitle({ small, smaller }: { small?: boolean; smaller?: boolean }) {
  return (
    <h1 className={`tc-display text-balance text-center leading-none ${smaller ? 'text-3xl' : small ? 'text-4xl' : 'text-6xl'}`}
      style={{ color: 'var(--tc-brass)', textShadow: '0 4px 0 #6E400C, 0 18px 40px rgba(244,183,64,.35)' }}>
      קוד הגמדים
    </h1>
  );
}

export default function RegisterScreen(p: Props) {
  const sfx = useSfx();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<SelfieShot | null>(null);
  // The emoji the server needs anyway (the selfie only replaces it on screen).
  const [lastEmoji, setLastEmoji] = useState(EMOJIS[0]);
  const allowSelfie = !!p.selfie?.enabled;
  const usingPhoto = !!photo && emoji === photo.preview;
  const [selfieStep, setSelfieStep] = useState<'consent' | null>(null);
  const canGo = name.trim().length >= 2;
  const logo = p.branding?.logoUrl;
  const branded = !!(p.branding?.backgroundUrl || logo);
  // Top corner, so it is on screen without scrolling and never competes with "יוצאים לדרך".
  const howTo = p.onHowToPlay ? <div className="-mb-2 flex justify-end"><HowToPlayButton onClick={p.onHowToPlay} /></div> : null;

  if (p.mode === 'recover') {
    return (
      <ScreenBody className="items-stretch justify-center gap-6">
        {howTo}
        <BrandLogo url={p.branding?.logoUrl} name={p.venueName} />
        <CodeTitle small={!p.branding?.logoUrl} smaller={!!p.branding?.logoUrl} />
        <div className="tc-a-rise text-center">
          <h2 className="tc-display text-3xl">כבר שיחקתם אצלנו?</h2>
          <p className="mt-2 text-lg" style={{ color: 'var(--tc-soft)' }}>הקלידו את קוד השחזור של הקבוצה, והנקודות והמזוודות יחזרו אליכם.</p>
        </div>
        <label className="block">
          <span className="sr-only">קוד שחזור</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 9))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            dir="ltr"
            placeholder="ABC-123"
            className="tc-num h-16 w-full rounded-2xl bg-black/30 text-center text-3xl tracking-[.2em] outline-none placeholder:text-white/25 focus:ring-4 focus:ring-[var(--tc-brass)]"
            style={{ boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}
          />
        </label>
        {p.recoverError && <p role="alert" className="tc-a-shake text-center text-lg font-bold" style={{ color: 'var(--tc-coral)' }}>{p.recoverError}</p>}
        <button type="button" className="tc-btn tc-btn-primary w-full" disabled={code.replace(/[^A-Z0-9]/g, '').length < 4}
          onClick={() => { sfx('tap'); p.onRecover(code); }}>
          שחזרו את הקבוצה
        </button>
        <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => p.onMode('new')}>
          אנחנו קבוצה חדשה
        </button>
        <PoweredBy />
      </ScreenBody>
    );
  }

  return (
    <>
    <ScreenBody className="items-stretch gap-5">
      {howTo}
      {logo && <div className="mt-2"><BrandLogo url={logo} name={p.venueName} /></div>}
      {p.firstGnome ? (
        <div className="tc-a-rise mt-2 flex items-center gap-4">
          <GnomeStage gnome={p.firstGnome} size={84} />
          <div>
            <p className="tc-display text-3xl leading-tight">מצאתם את הגמד הראשון!</p>
            <p className="mt-1 text-base" style={{ color: 'var(--tc-soft)' }}>{describeGnome(p.firstGnome.bodyColor, p.firstGnome.hatColor)}</p>
          </div>
        </div>
      ) : logo ? (
        <CodeTitle smaller />
      ) : (
        <div className="mt-6"><CodeTitle /></div>
      )}

      <div className="tc-a-rise tc-delay-1">
        {p.firstGnome && <CodeTitle small={!logo} smaller={!!logo} />}
        <p className="mt-3 whitespace-pre-line text-center text-lg" style={{ color: branded ? 'var(--tc-cream)' : 'var(--tc-soft)', textShadow: branded ? '0 1px 8px rgba(0,0,0,.6)' : undefined }}>
          {p.addingProfile ? 'עוד קבוצה משחקת מהטלפון הזה? בחרו לה כינוי.' : (p.branding?.welcomeText?.trim() || `הגמדים של ${p.venueName} שומרים על מזוודות נעולות. מי יפצח את הקוד?`)}
        </p>
      </div>

      <label className="tc-a-rise tc-delay-2 block">
        <span className="tc-display mb-2 block text-xl">איך תקראו לעצמכם?</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
          placeholder="למשל: הנמרים מקומה 3"
          autoComplete="off"
          enterKeyHint="done"
          className="h-16 w-full rounded-2xl bg-black/30 px-4 text-2xl font-bold outline-none placeholder:font-normal placeholder:text-white/30 focus:ring-4 focus:ring-[var(--tc-brass)]"
          style={{ boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}
        />
      </label>

      <fieldset className="tc-a-rise tc-delay-3 min-w-0">
        <legend className="tc-display mb-1 text-xl">{allowSelfie ? 'והסמל שלכם: סלפי או ציור' : 'והסמל שלכם'}</legend>
        <SymbolRow value={emoji} selfie={allowSelfie} photo={photo?.preview ?? null} onCamera={() => setSelfieStep('consent')}
          onChange={(v) => { setEmoji(v); if (!photo || v !== photo.preview) setLastEmoji(v); }} />
      </fieldset>

      {p.nameError && <p role="alert" className="tc-a-shake text-center text-lg font-bold" style={{ color: 'var(--tc-coral)' }}>{p.nameError}</p>}
      <p className="text-center text-sm" style={{ color: 'var(--tc-soft)' }}>
        {allowSelfie ? 'בלי שמות אמיתיים. סלפי רק אם תרצו, ובסוף הוא נמחק.' : 'בלי שמות אמיתיים ובלי תמונות. רק כינוי וסמל.'}
      </p>

      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className="tc-btn tc-btn-primary w-full text-xl" disabled={!canGo}
          onClick={() => { sfx('correct'); p.onRegister(name, usingPhoto ? lastEmoji : emoji, usingPhoto ? photo! : undefined); }}>
          <Avatar value={emoji} size={30} /> יוצאים לדרך
        </button>
        {p.addingProfile ? (
          p.onCancel && <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={p.onCancel}>ביטול</button>
        ) : (
          <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={() => p.onMode('recover')}>
            יש לנו קוד
          </button>
        )}
        {!p.addingProfile && <PoweredBy />}
      </div>
    </ScreenBody>
    {allowSelfie && (
      <SelfieFlow step={selfieStep} days={p.selfie!.days} onCancel={() => setSelfieStep(null)}
        onPhoto={(shot) => { setPhoto(shot); setEmoji(shot.preview); sfx('correct'); }} />
    )}
    </>
  );
}
