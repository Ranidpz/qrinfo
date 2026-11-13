'use client';

// Siblings on one phone: switch group, add one, see the recovery code, change / remove the
// group's selfie (when selfies are on; removing always works while there is a photo).

import { useState } from 'react';
import { Avatar } from './Avatar';
import { SelfieFlow } from './SymbolPicker';
import { avatarOf, type PlayerProfileView, type SelfieShot } from './types';

interface Props {
  open: boolean;
  profile: PlayerProfileView | null;
  profiles: PlayerProfileView[];
  selfie?: { enabled: boolean; days: number } | null;
  photoBusy?: boolean;
  onClose(): void;
  onSwitch(id: string): void;
  onAdd(): void;
  onSetPhoto?(photo: SelfieShot): void;
  onRemovePhoto?(): void;
}

export default function ProfileSheet({ open, profile, profiles, selfie, photoBusy, onClose, onSwitch, onAdd, onSetPhoto, onRemovePhoto }: Props) {
  const [step, setStep] = useState<'consent' | null>(null);
  if (!open) return null;
  const canShoot = !!selfie?.enabled && !!onSetPhoto;
  const hasPhoto = !!profile?.photoUrl;
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
                  <Avatar value={avatarOf(p)} size={36} />
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
        {profile && (canShoot || (hasPhoto && onRemovePhoto)) && (
          <div className="mt-3 flex gap-2">
            {canShoot && (
              <button type="button" className="tc-btn tc-btn-ghost flex-1 !text-base" disabled={photoBusy} onClick={() => setStep('consent')}>
                📷 {hasPhoto ? 'סלפי חדש' : 'צלמו סלפי'}
              </button>
            )}
            {hasPhoto && onRemovePhoto && (
              <button type="button" className="tc-btn tc-btn-ghost flex-1 !text-base" disabled={photoBusy} onClick={onRemovePhoto}>
                {photoBusy ? 'רגע…' : 'הסירו את התמונה'}
              </button>
            )}
          </div>
        )}
        {profile && (
          <div className="mt-5 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,.25)' }}>
            <p className="text-base" style={{ color: 'var(--tc-soft)' }}>קוד השחזור של {profile.familyName}</p>
            <p className="tc-num my-1 text-center text-4xl tracking-[.18em]" style={{ color: 'var(--tc-brass-hi)' }}>{profile.recoveryCode}</p>
            <p className="text-sm" style={{ color: 'var(--tc-soft)' }}>צלמו את המסך. עם הקוד הזה ממשיכים מכל טלפון, גם אם הדפדפן נמחק.</p>
          </div>
        )}
      </div>
      {canShoot && (
        <SelfieFlow step={step} days={selfie!.days} onCancel={() => setStep(null)}
          onPhoto={(shot) => { onSetPhoto!(shot); }} />
      )}
    </div>
  );
}
