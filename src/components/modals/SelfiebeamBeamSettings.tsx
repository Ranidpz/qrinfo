'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Sparkles } from 'lucide-react';
import { onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GallerySettings } from '@/types';

// Defaults for a Selfie Beam big screen (mirror SELFIEBEAM_DEFAULTS in GalleryClient).
const SB_DEFAULTS: GallerySettings = {
  displayMode: 'shuffle',
  displayLimit: 300,
  gridColumns: 5,
  headerHidden: false,
  showNames: false,
  fadeEffect: true,
  borderRadius: 0,
  nameSize: 14,
  showNewBadge: false,
  displaySpeed: 4.5,
  featureNewPhotos: false,
};

interface Props {
  codeId: string;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-accent' : 'bg-border'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  );
}

/**
 * Live editor for the big-screen beam appearance. Reads/writes codes/{id}.gallerySettings,
 * the SAME field the /gallery beam page edits — so changes here reflect on the beam instantly.
 */
export default function SelfiebeamBeamSettings({ codeId }: Props) {
  const t = useTranslations('modals');
  const [settings, setSettings] = useState<GallerySettings>(SB_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'codes', codeId), (snap) => {
      if (!snap.exists()) return;
      const fb = snap.data().gallerySettings as GallerySettings | undefined;
      if (fb && !savingRef.current) setSettings({ ...SB_DEFAULTS, ...fb });
      setLoaded(true);
    });
    return () => unsub();
  }, [codeId]);

  const update = async (patch: Partial<GallerySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savingRef.current = true;
    try {
      await updateDoc(doc(db, 'codes', codeId), { gallerySettings: next });
    } catch (err) {
      console.error('Failed to save beam settings:', err);
    } finally {
      setTimeout(() => { savingRef.current = false; }, 600);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Columns */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">{t('selfiebeamColumns')}</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={2}
            max={8}
            value={settings.gridColumns}
            onChange={(e) => update({ gridColumns: Number(e.target.value) })}
            className="w-32 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <span className="text-sm text-text-primary w-4 text-center">{settings.gridColumns}</span>
        </div>
      </div>

      {/* Swap speed: slider + number (seconds between each photo swap) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">{t('selfiebeamSpeed')}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={10}
              step={0.5}
              value={settings.displaySpeed ?? 4.5}
              onChange={(e) => update({ displaySpeed: Number(e.target.value) })}
              className="w-28 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <input
              type="number"
              min={2}
              max={10}
              step={0.5}
              value={settings.displaySpeed ?? 4.5}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) update({ displaySpeed: Math.min(10, Math.max(2, v)) });
              }}
              className="input w-16 text-center px-1 py-1 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-text-secondary">{t('selfiebeamSpeedDesc')}</p>
      </div>

      {/* Photos shown (rolling window) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm text-text-secondary">{t('selfiebeamPhotoLimit')}</span>
        <div className="flex gap-1">
          {[100, 200, 300, 400].map((n) => (
            <button
              key={n}
              onClick={() => update({ displayLimit: n })}
              className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
                settings.displayLimit === n ? 'bg-accent text-white' : 'bg-bg-card text-text-secondary hover:text-text-primary'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Corners */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">{t('selfiebeamCorners')}</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={50}
            value={settings.borderRadius ?? 0}
            onChange={(e) => update({ borderRadius: Number(e.target.value) })}
            className="w-32 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <span className="text-sm text-text-primary w-8 text-center">{settings.borderRadius ?? 0}%</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <Toggle label={t('selfiebeamMotion')} value={settings.fadeEffect ?? true} onChange={(v) => update({ fadeEffect: v })} />
      <Toggle label={t('selfiebeamShowNames')} value={settings.showNames ?? false} onChange={(v) => update({ showNames: v })} />
      <Toggle label={t('selfiebeamShowNew')} value={settings.showNewBadge ?? false} onChange={(v) => update({ showNewBadge: v })} />
      <Toggle label={t('selfiebeamFeatureNew')} value={settings.featureNewPhotos ?? false} onChange={(v) => update({ featureNewPhotos: v })} />

      <p className="text-xs text-text-secondary flex items-center gap-1.5 pt-1">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        {t('selfiebeamBeamLiveHint')}
      </p>
    </div>
  );
}
