'use client';

// Screens where the game cannot go on right now: nothing left, paused, wrong browser, offline.

import { CountUp, HintCard, ScreenBody, StarCoin } from './ui';
import type { PlayerProfileView } from './types';

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

export function NetworkErrorScreen({ onRetry }: { onRetry(): void }) {
  return (
    <ScreenBody className="items-center justify-center gap-5 text-center">
      <BigIcon>📡</BigIcon>
      <h2 className="tc-display text-4xl">אין חיבור לאינטרנט</h2>
      <p className="text-xl" style={{ color: 'var(--tc-soft)' }}>שום דבר לא אבד. הבחירה שלכם שמורה, ונשלח אותה ברגע שהחיבור יחזור.</p>
      <button type="button" className="tc-btn tc-btn-primary w-full text-xl" onClick={onRetry}>נסו שוב</button>
    </ScreenBody>
  );
}
