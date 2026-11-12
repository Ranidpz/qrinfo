'use client';

// Screens where the game cannot go on right now: nothing left, paused, wrong browser, offline.

import { CountUp, HintCard, ScreenBody, StarCoin } from './ui';
import type { TheCodeBranding } from '@/types/thecode';
import { BrandLogo } from './Branding';
import type { NetworkProblem, PlayerProfileView } from './types';

function BigIcon({ children }: { children: string }) {
  return <div className="tc-a-pop text-8xl leading-none" aria-hidden>{children}</div>;
}

export function AllDoneScreen({ profile, onSummary }: { profile: PlayerProfileView | null; onSummary(): void }) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <div className="relative flex items-end justify-center gap-1" aria-hidden>
        <span className="tc-a-drop text-6xl">🧳</span>
        <span className="tc-a-drop tc-delay-2 text-8xl">🧳</span>
        <span className="tc-a-drop tc-delay-4 text-6xl">🧳</span>
      </div>
      <h2 className="tc-display text-5xl leading-tight" style={{ color: 'var(--tc-brass-hi)' }}>פתחתם את כל המזוודות!</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>
        אין כרגע מזוודות חדשות במלון. בביקור הבא יחכו לכם גמדים וחידות חדשים.
      </p>
      {profile && (
        <div className="flex items-center gap-2 text-4xl"><StarCoin size={34} /><CountUp value={profile.points} /></div>
      )}
      <button type="button" className="tc-btn tc-btn-primary mt-2 w-full text-xl" onClick={onSummary}>לטבלת המשפחות</button>
    </ScreenBody>
  );
}

export function PausedScreen() {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <BigIcon>🌙</BigIcon>
      <h2 className="tc-display text-5xl">המשחק בהפסקה</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>הגמדים נחים עכשיו. הנקודות והאותיות שלכם שמורות, ואפשר להמשיך כשהמשחק יחזור.</p>
    </ScreenBody>
  );
}

export function InAppBrowserScreen({ onOpen, onDismiss }: { onOpen(): void; onDismiss(): void }) {
  return (
    <ScreenBody className="items-stretch justify-center gap-5 text-center">
      <BigIcon>🧭</BigIcon>
      <h2 className="tc-display text-4xl leading-tight">פתחו את המשחק בדפדפן</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>
        נראה שהקישור נפתח מתוך וואטסאפ או אינסטגרם. שם המשחק לא זוכר אתכם, והנקודות עלולות ללכת לאיבוד.
      </p>
      <HintCard className="text-start">
        <ol className="list-inside list-decimal space-y-1">
          <li>הקישו על שלוש הנקודות או על סמל השיתוף</li>
          <li>בחרו ״פתיחה בדפדפן״</li>
        </ol>
      </HintCard>
      <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onOpen}>פתחו בדפדפן</button>
      <button type="button" className="tc-btn tc-btn-ghost w-full" onClick={onDismiss}>להמשיך כאן בכל זאת</button>
    </ScreenBody>
  );
}

const NETWORK_TEXT: Record<NetworkProblem, { icon: string; title: string; text: string }> = {
  offline: { icon: '📡', title: 'אין חיבור לאינטרנט', text: 'שום דבר לא אבד. הבחירה שלכם שמורה, ונשלח אותה ברגע שהחיבור יחזור.' },
  rateLimited: { icon: '🐢', title: 'רגע, לאט לאט', text: 'הגמדים לא עומדים בקצב. נשמו רגע ונמשיך מאותו מקום.' },
  server: { icon: '🛠️', title: 'משהו השתבש אצלנו', text: 'הבחירה שלכם שמורה. נסו שוב בעוד רגע.' },
};

export function NetworkErrorScreen({ onRetry, problem = 'offline', retryInSeconds }: { onRetry(): void; problem?: NetworkProblem; retryInSeconds?: number }) {
  const t = NETWORK_TEXT[problem];
  const waiting = !!retryInSeconds && retryInSeconds > 0;
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <BigIcon>{t.icon}</BigIcon>
      <h2 className="tc-display text-4xl">{t.title}</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>{t.text}</p>
      <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onRetry} disabled={waiting}>
        {waiting ? <>עוד <span className="tc-num">{retryInSeconds}</span> שניות</> : 'נסו שוב'}
      </button>
    </ScreenBody>
  );
}

export function LoadingScreen({ branding, venueName = '' }: { branding?: TheCodeBranding | null; venueName?: string }) {
  return (
    <ScreenBody className="items-center justify-center gap-6 text-center">
      {branding?.logoUrl && <div className="w-full"><BrandLogo url={branding.logoUrl} name={venueName} /></div>}
      <span aria-hidden className="tc-spin h-16 w-16 rounded-full border-[6px] border-white/15 border-t-[var(--tc-brass)]" />
      <p className="tc-display text-2xl" style={{ color: 'var(--tc-soft)' }}>מעירים את הגמדים…</p>
    </ScreenBody>
  );
}

export function NotFoundScreen({ title, text }: { title: string; text: string }) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <BigIcon>🧭</BigIcon>
      <h2 className="tc-display text-4xl leading-tight">{title}</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>{text}</p>
    </ScreenBody>
  );
}
