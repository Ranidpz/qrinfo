'use client';

// Siblings on one phone: switch family, add one, see the recovery code.

import type { PlayerProfileView } from './types';

interface Props {
  open: boolean;
  profile: PlayerProfileView | null;
  profiles: PlayerProfileView[];
  onClose(): void;
  onSwitch(id: string): void;
  onAdd(): void;
}

export default function ProfileSheet({ open, profile, profiles, onClose, onSwitch, onAdd }: Props) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="הקבוצות בטלפון הזה">
      <button type="button" aria-label="סגירה" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="tc-a-rise relative rounded-t-[28px] px-5 pb-8 pt-3" style={{ background: 'linear-gradient(180deg,#1E2766,#141A48)', boxShadow: '0 -10px 40px rgba(0,0,0,.5)' }}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" aria-hidden />
        <h2 className="tc-display mb-3 text-2xl">מי משחק עכשיו?</h2>
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => {
            const isActive = p.id === profile?.id;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onSwitch(p.id)} aria-current={isActive}
                  className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 text-start transition-transform active:scale-[.98]"
                  style={isActive ? { background: 'rgba(244,183,64,.18)', boxShadow: 'inset 0 0 0 2px var(--tc-brass)' } : { background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
                  <span className="text-3xl" aria-hidden>{p.emoji}</span>
                  <span className="flex-1 text-xl font-bold">{p.familyName}</span>
                  <span className="tc-num text-lg" style={{ color: 'var(--tc-brass)' }}>{p.points.toLocaleString('en-US')}</span>
                  {isActive && <span aria-hidden className="text-xl" style={{ color: 'var(--tc-brass)' }}>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="tc-btn tc-btn-ghost mt-3 w-full" onClick={onAdd}>
          <span aria-hidden>＋</span> קבוצה נוספת בטלפון הזה
        </button>
        {profile && (
          <div className="mt-5 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,.25)' }}>
            <p className="text-base" style={{ color: 'var(--tc-soft)' }}>קוד השחזור של {profile.familyName}</p>
            <p className="tc-num my-1 text-center text-4xl tracking-[.18em]" style={{ color: 'var(--tc-brass-hi)' }}>{profile.recoveryCode}</p>
            <p className="text-sm" style={{ color: 'var(--tc-soft)' }}>צלמו את המסך. עם הקוד הזה ממשיכים מכל טלפון, גם אם הדפדפן נמחק.</p>
          </div>
        )}
      </div>
    </div>
  );
}
