'use client';

// Groups on one phone: switch group, add one, see the recovery code — and "עריכת הקבוצה"
// (Rani 13.11.2026): rename, pick another symbol from the same sideways row, a new selfie
// (same consent line) or remove the photo. Pure overlay: the game underneath keeps its place.
// What is SELECTED is what shows: picking an emoji while the group has a photo removes the photo.

import { useState } from 'react';
import { Avatar } from './Avatar';
import { SelfieFlow, SymbolRow } from './SymbolPicker';
import { useSfx } from './ui';
import { avatarOf, type PlayerProfileView, type ProfilePatchResult, type SelfieShot } from './types';

const MAX_NAME = 20;

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
  onUpdateProfile?(patch: { familyName?: string; emoji?: string }): Promise<ProfilePatchResult>;
  /** Sounds on / off (moved here from the header, Rani 13.11.2026). */
  muted?: boolean;
  onToggleMute?(): void;
}

/** "צלילים" on / off as a switch row. */
function SoundRow({ muted, onToggle }: { muted: boolean; onToggle(): void }) {
  return (
    <button type="button" role="switch" aria-checked={!muted} onClick={onToggle}
      className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-start"
      style={{ background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
      <span aria-hidden className="text-2xl">{muted ? '🔇' : '🔊'}</span>
      <span className="flex-1 text-xl font-bold">צלילים</span>
      <span aria-hidden className="relative h-8 w-14 rounded-full transition-colors" style={{ background: muted ? 'rgba(255,244,218,.2)' : 'var(--tc-mint)' }}>
        <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: muted ? 4 : 28 }} />
      </span>
    </button>
  );
}

interface EditProps {
  profile: PlayerProfileView;
  selfieOn: boolean;
  name: string;
  setName(v: string): void;
  value: string;
  setValue(v: string): void;
  shot: SelfieShot | null;
  error: string | null;
  saving: boolean;
  onCamera(): void;
  onSave(): void;
  onCancel(): void;
}

/** The edit form (module scope: a stable identity, so its entrance animation never replays). */
function EditGroup({ profile, selfieOn, name, setName, value, setValue, shot, error, saving, onCamera, onSave, onCancel }: EditProps) {
  const photo = shot?.preview ?? profile.photoUrl ?? null;
  return (
    <div className="tc-a-rise flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar value={value} size={56} />
        <h2 className="tc-display text-2xl">עריכת הקבוצה</h2>
      </div>
      <label className="block">
        <span className="tc-display mb-2 block text-lg">השם של הקבוצה</span>
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))} autoComplete="off" enterKeyHint="done"
          className="h-14 w-full rounded-2xl bg-black/30 px-4 text-xl font-bold outline-none focus:ring-4 focus:ring-[var(--tc-brass)]"
          style={{ boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }} />
      </label>
      <fieldset className="min-w-0">
        <legend className="tc-display mb-1 text-lg">{selfieOn ? 'הסמל: סלפי או ציור' : 'הסמל'}</legend>
        <SymbolRow value={value} onChange={setValue} selfie={selfieOn} photo={photo} onCamera={onCamera} />
      </fieldset>
      {error && <p role="alert" className="tc-a-shake text-center text-lg font-bold" style={{ color: 'var(--tc-coral)' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="tc-btn tc-btn-primary flex-1 text-lg" disabled={saving || name.trim().length < 2} onClick={onSave}>
          {saving ? 'שומרים…' : 'שמירה'}
        </button>
        <button type="button" className="tc-btn tc-btn-ghost" disabled={saving} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

export default function ProfileSheet(p: Props) {
  const { open, profile, profiles, selfie, photoBusy, onClose, onSwitch, onAdd, onSetPhoto, onRemovePhoto, onUpdateProfile, muted, onToggleMute } = p;
  const sfx = useSfx();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [shot, setShot] = useState<SelfieShot | null>(null);
  const [step, setStep] = useState<'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;
  const selfieOn = !!selfie?.enabled && !!onSetPhoto;
  const canEdit = !!profile && !!onUpdateProfile;

  const startEdit = () => {
    if (!profile) return;
    sfx('tap');
    setName(profile.familyName);
    setValue(avatarOf(profile));
    setShot(null);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!profile || !onUpdateProfile) return;
    const patch: { familyName?: string; emoji?: string } = {};
    const trimmed = name.trim();
    if (trimmed !== profile.familyName) patch.familyName = trimmed;
    const choseNewPhoto = !!shot && value === shot.preview;
    const choseOldPhoto = !!profile.photoUrl && value === profile.photoUrl;
    const choseEmoji = !choseNewPhoto && !choseOldPhoto;
    if (choseEmoji && value !== profile.emoji) patch.emoji = value;
    setSaving(true);
    setError(null);
    if (patch.familyName !== undefined || patch.emoji !== undefined) {
      const r = await onUpdateProfile(patch);
      if (r !== 'ok') {
        setSaving(false);
        setError(r === 'invalidName' ? 'השם הזה לא מתאים. בחרו שם אחר.' : 'לא הצלחנו לשמור. נסו שוב.');
        return;
      }
    }
    if (choseNewPhoto) onSetPhoto?.(shot!);
    else if (choseEmoji && profile.photoUrl) onRemovePhoto?.();
    setSaving(false);
    setEditing(false);
    sfx('correct');
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="הקבוצות בטלפון הזה">
      <button type="button" aria-label="סגירה" className="absolute inset-0 bg-black/60" onClick={() => { setEditing(false); onClose(); }} />
      <div className="tc-a-rise relative max-h-[92%] overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-3" style={{ background: 'linear-gradient(180deg,#1E2766,#141A48)', boxShadow: '0 -10px 40px rgba(0,0,0,.5)' }}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25" aria-hidden />
        {editing && profile ? (
          <EditGroup profile={profile} selfieOn={selfieOn} name={name} setName={setName} value={value} setValue={setValue}
            shot={shot} error={error} saving={saving || !!photoBusy} onCamera={() => setStep('consent')}
            onSave={() => { void save(); }} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <h2 className="tc-display mb-3 text-2xl">מי משחק עכשיו?</h2>
            <ul className="flex flex-col gap-2">
              {profiles.map((x) => {
                const isActive = x.id === profile?.id;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => onSwitch(x.id)} aria-current={isActive}
                      className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 text-start transition-transform active:scale-[.98]"
                      style={isActive ? { background: 'rgba(244,183,64,.18)', boxShadow: 'inset 0 0 0 2px var(--tc-brass)' } : { background: 'var(--tc-panel)', boxShadow: 'inset 0 0 0 1.5px var(--tc-line)' }}>
                      <Avatar value={avatarOf(x)} size={36} />
                      <span className="flex-1 text-xl font-bold">{x.familyName}</span>
                      <span className="tc-num text-lg" style={{ color: 'var(--tc-brass)' }}>{x.points.toLocaleString('en-US')}</span>
                      {isActive && <span aria-hidden className="text-xl" style={{ color: 'var(--tc-brass)' }}>✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex gap-2">
              {canEdit && (
                <button type="button" className="tc-btn tc-btn-ghost flex-1 !text-base" onClick={startEdit}>
                  <span aria-hidden>✏️</span> עריכת הקבוצה
                </button>
              )}
              <button type="button" className="tc-btn tc-btn-ghost flex-1 !text-base" onClick={onAdd}>
                <span aria-hidden>＋</span> קבוצה נוספת
              </button>
            </div>
            {onToggleMute && <SoundRow muted={!!muted} onToggle={onToggleMute} />}
            {profile && (
              <div className="mt-5 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,.25)' }}>
                <p className="text-base" style={{ color: 'var(--tc-soft)' }}>קוד השחזור של {profile.familyName}</p>
                <p className="tc-num my-1 text-center text-4xl tracking-[.18em]" style={{ color: 'var(--tc-brass-hi)' }}>{profile.recoveryCode}</p>
                <p className="text-sm" style={{ color: 'var(--tc-soft)' }}>צלמו את המסך. עם הקוד הזה ממשיכים מכל טלפון, גם אם הדפדפן נמחק.</p>
              </div>
            )}
          </>
        )}
      </div>
      {selfieOn && (
        <SelfieFlow step={step} days={selfie!.days} onCancel={() => setStep(null)}
          onPhoto={(s) => { setShot(s); setValue(s.preview); }} />
      )}
    </div>
  );
}
