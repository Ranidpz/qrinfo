'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Camera, CircleAlert, ExternalLink, Film, Loader2, MonitorPlay, RefreshCw, Trash2, Volume2 } from 'lucide-react';
import { SELFIE_LIMITS, resolveSelfie } from '@/lib/thecode/selfie';
import type { LobbySlot, ScreenProps } from './model';
import { Card, NumberInput, Toggle, cx } from './ui';

// קוד הגמדים admin — wave 3 settings: group selfies + the big screen's three videos.

/** "סלפי של הקבוצה": on/off + retention. Absent settings = on, 14 days (resolveSelfie). */
export function SelfieCard({ state, actions }: Pick<ScreenProps, 'state' | 'actions'>) {
  const s = resolveSelfie(state.config);
  const set = (patch: Partial<typeof s>) => actions.updateConfig({ selfie: { ...s, ...patch } });
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Camera size={20} className="text-accent" aria-hidden /> סלפי של הקבוצה
          </h2>
          <p className="mt-1 text-text-secondary">
            קבוצות מצטלמות במצלמה בהרשמה, והתמונה מופיעה במקום הסמל — בטלפון ועל המסך הגדול. התמונות נמחקות אוטומטית.
          </p>
        </div>
        <Toggle checked={s.enabled} onChange={(enabled) => set({ enabled })} label="סלפי של הקבוצה" />
      </div>
      {s.enabled && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-bg-secondary px-4 py-3">
          <span>התמונות נמחקות אחרי</span>
          <NumberInput
            label="ימים עד מחיקה"
            value={s.retentionDays}
            min={SELFIE_LIMITS.minDays}
            max={SELFIE_LIMITS.maxDays}
            suffix="ימים"
            onChange={(retentionDays) => set({ retentionDays })}
          />
          <span className="basis-full text-sm text-text-secondary">
            בין {SELFIE_LIMITS.minDays} ל־{SELFIE_LIMITS.maxDays} ימים. אפשר גם להסיר תמונה של קבוצה במסך הקבוצות.
          </span>
        </div>
      )}
    </Card>
  );
}

const SLOTS: { slot: LobbySlot; title: string; text: string }[] = [
  { slot: 'idle', title: 'המתנה, בלולאה', text: 'מתנגן כשאף אחד לא סורק.' },
  { slot: 'explain', title: 'הסבר, אחרי סריקה', text: 'פעם אחת, כשמישהו סורק את הקוד שעל המסך.' },
  { slot: 'after', title: 'אחרי ההסבר, בלולאה', text: 'עד הסריקה הבאה.' },
];

const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_VIDEO = 100 * 1024 * 1024;

/** "המסך הגדול": three video slots + open the screen. */
export function BigScreenCard({ state, actions, uploadVideo, links }: Pick<ScreenProps, 'state' | 'actions' | 'uploadVideo' | 'links'>) {
  const videos = state.config.lobby?.videos || {};
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MonitorPlay size={20} className="text-accent" aria-hidden /> המסך הגדול
          </h2>
          <p className="mt-1 text-text-secondary">לוח התוצאות לטלוויזיה במקום. אפשר להוסיף שלושה סרטונים קצרים עם קול. משבצת ריקה מציגה אנימציה מצוירת.</p>
        </div>
        {links ? (
          <a href={links.lobby} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90">
            <ExternalLink size={16} aria-hidden /> פתחו את המסך הגדול
          </a>
        ) : (
          <span className="text-sm text-text-secondary">הקישור יופיע כשההרפתקה שמורה.</span>
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <Volume2 size={16} aria-hidden /> על טלוויזיה, לחצו פעם אחת על המסך כדי להפעיל קול.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {SLOTS.map((s) => (
          <VideoSlot
            key={s.slot}
            title={s.title}
            text={s.text}
            value={videos[s.slot]}
            upload={(file, onProgress) => uploadVideo(s.slot, file, onProgress)}
            onChange={(url) => actions.updateLobbyVideo(s.slot, url)}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-text-secondary">MP4 או WebM, עד 100MB לכל סרטון. כדאי סרטונים קצרים.</p>
    </Card>
  );
}

type Phase = { kind: 'idle' } | { kind: 'uploading'; progress: number } | { kind: 'error'; message: string };

function VideoSlot({
  title,
  text,
  value,
  upload,
  onChange,
}: {
  title: string;
  text: string;
  value?: string;
  upload: (file: File, onProgress: (f: number) => void) => Promise<string>;
  onChange: (url: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const depth = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const take = async (file: File | undefined) => {
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      setPhase({ kind: 'error', message: 'אפשר להעלות רק סרטון MP4 או WebM.' });
      return;
    }
    if (file.size > MAX_VIDEO) {
      setPhase({ kind: 'error', message: 'הסרטון גדול מ־100MB. קצרו או דחסו אותו ונסו שוב.' });
      return;
    }
    setPhase({ kind: 'uploading', progress: 0 });
    try {
      const url = await upload(file, (f) => alive.current && setPhase({ kind: 'uploading', progress: f }));
      if (!alive.current) return;
      onChange(url);
      setPhase({ kind: 'idle' });
    } catch {
      if (alive.current) setPhase({ kind: 'error', message: 'ההעלאה נכשלה. בדקו את החיבור ונסו שוב.' });
    }
  };

  const busy = phase.kind === 'uploading';
  const pick = () => !busy && inputRef.current?.click();

  return (
    <div className="flex flex-col rounded-xl border border-border p-3">
      <div className="font-medium">{title}</div>
      <div className="mb-2 text-sm text-text-secondary">{text}</div>
      <div
        role="button"
        tabIndex={0}
        aria-label={value ? `${title} — החליפו סרטון` : `${title} — העלו סרטון`}
        aria-busy={busy}
        onClick={() => !value && pick()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !value && (e.preventDefault(), pick())}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setOver(false);
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          depth.current = 0;
          setOver(false);
          void take(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          'relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-bg-secondary text-text-secondary',
          over ? 'border-accent bg-accent/10 text-accent' : 'border-border',
          !value && !busy && 'cursor-pointer hover:bg-bg-hover'
        )}
      >
        {value && !busy ? (
          <video src={value} muted controls playsInline preload="metadata" className="size-full bg-black object-contain" />
        ) : busy ? (
          <div className="flex w-4/5 flex-col items-center gap-2 text-sm">
            <Loader2 size={20} className="animate-spin" aria-hidden />
            <span>מעלים… {Math.round(phase.progress * 100)}%</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </span>
          </div>
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center text-sm">
            <Film size={22} aria-hidden />
            <span className="font-medium text-text-primary">גררו לכאן סרטון או לחצו לבחירה</span>
          </span>
        )}
        {over && value && <span className="absolute inset-0 flex items-center justify-center bg-accent/30 font-semibold text-white">שחררו כדי להחליף</span>}
        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <div className="mt-2 flex min-h-9 flex-wrap items-center gap-1 text-sm">
        {phase.kind === 'error' && (
          <span role="alert" className="flex items-center gap-1 text-danger">
            <CircleAlert size={14} aria-hidden /> {phase.message}
          </span>
        )}
        {value && !busy && (
          confirmRemove ? (
            <span className="ms-auto flex items-center gap-1">
              <span className="text-danger">להסיר?</span>
              <button type="button" onClick={() => setConfirmRemove(false)} className="min-h-9 rounded-md px-2 text-text-secondary hover:bg-bg-hover">ביטול</button>
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setConfirmRemove(false);
                  setPhase({ kind: 'idle' });
                }}
                className="min-h-9 rounded-md px-2 font-medium text-danger hover:bg-danger/10"
              >
                הסירו
              </button>
            </span>
          ) : (
            <span className="ms-auto flex gap-1">
              <button type="button" onClick={pick} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-text-secondary hover:bg-bg-hover">
                <RefreshCw size={14} aria-hidden /> החליפו
              </button>
              <button type="button" onClick={() => setConfirmRemove(true)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-danger hover:bg-danger/10">
                <Trash2 size={14} aria-hidden /> הסירו
              </button>
            </span>
          )
        )}
      </div>
    </div>
  );
}

