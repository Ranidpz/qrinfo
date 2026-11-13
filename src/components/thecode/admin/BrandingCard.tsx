'use client';

import type { CSSProperties } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import type { TheCodeBranding } from '@/types/thecode';
import type { ScreenProps } from './model';
import ImageDropZone from './ImageDropZone';
import { VideoSlot } from './LobbyCards';
import { MIN_TEXT_CONTRAST, contrastRatio, normalizeHex, readableOn } from './colors';
import { Card, Field, Segmented } from './ui';

/** Same limit the server enforces (src/lib/thecode/server/admin.ts THECODE_LIMITS.welcomeText). */
export const WELCOME_MAX = 140;
/** Opening-screen background video limit (contract: lobby-video-url slot 'opening'). */
const OPENING_VIDEO_MAX = 30 * 1024 * 1024;

export const hasBranding = (b?: TheCodeBranding) =>
  !!(b && (b.backgroundUrl || b.logoUrl || b.welcomeText || b.backgroundType || b.backgroundVideoUrl || b.textColor || b.buttonColor));

export const defaultWelcome = (title: string) => `ברוכים הבאים ל${title.trim() || 'הרפתקה'}! מצאו את הגמדים ופתחו את המזוודה.`;

type BgType = NonNullable<TheCodeBranding['backgroundType']>;

/** What really fills the screen: an explicit type, else 'image' when a photo exists. */
export function effectiveBackground(b: TheCodeBranding): BgType | null {
  if (b.backgroundType) return b.backgroundType;
  return b.backgroundUrl ? 'image' : null;
}

/** Defaults the colour pickers start from (our green), so a choice is never empty. */
const DEFAULTS = { color: '#0E7C66', from: '#0E7C66', to: '#0B1F33', text: '#FFFFFF', button: '#FFFFFF' };

/**
 * "מיתוג המקום": the opening screen (after the first scan) belongs to the venue — a photo,
 * colour, gradient or video behind it, its logo, a welcome line and its colours for the text and
 * the main button, then register / "יש לנו קוד". Inside the game our own look stays. Every field
 * is optional; removing one sets it to undefined (updateBranding drops empties).
 */
export default function BrandingCard({ state, actions, uploadImage, uploadVideo }: Pick<ScreenProps, 'state' | 'actions' | 'uploadImage' | 'uploadVideo'>) {
  const { config } = state;
  const b = config.branding || {};
  const set = (patch: Partial<TheCodeBranding>) => actions.updateBranding(patch);
  const type = effectiveBackground(b) ?? 'image';

  const chooseType = (t: BgType) => {
    const patch: Partial<TheCodeBranding> = { backgroundType: t };
    if (t === 'color' && !b.backgroundColor) patch.backgroundColor = DEFAULTS.color;
    if (t === 'gradient' && !b.gradientFrom) patch.gradientFrom = DEFAULTS.from;
    if (t === 'gradient' && !b.gradientTo) patch.gradientTo = DEFAULTS.to;
    set(patch);
  };

  const warn = lowContrast(b);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">מיתוג המקום</h2>
      <p className="mt-1 text-text-secondary">
        המסך הראשון שקבוצה רואה אחרי שסרקה גמד הוא שלכם: רקע, לוגו, משפט פתיחה וצבעים, ואז הרשמה. בתוך המשחק נשאר העיצוב שלנו.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-6">
          <Field label="הרקע">
            <Segmented
              label="סוג הרקע"
              value={type}
              onChange={chooseType}
              options={[
                { value: 'image', label: 'תמונה' },
                { value: 'color', label: 'צבע' },
                { value: 'gradient', label: 'מעבר צבעים' },
                { value: 'video', label: 'סרטון' },
              ]}
            />
          </Field>

          {type === 'image' && (
            <ImageDropZone
              label="תמונת רקע"
              emptyText="תמונה לאורך (הטלפון מוחזק זקוף) — למשל הלובי או הבריכה. תמונה גדולה תוקטן אוטומטית."
              aspect="aspect-[3/4] max-w-[15rem]"
              value={b.backgroundUrl}
              upload={uploadImage}
              onChange={(url) => set({ backgroundUrl: url })}
            />
          )}
          {type === 'color' && (
            <ColorField label="צבע הרקע" value={b.backgroundColor} fallback={DEFAULTS.color} onChange={(v) => set({ backgroundColor: v })} />
          )}
          {type === 'gradient' && (
            <div className="flex flex-wrap gap-6">
              <ColorField label="למעלה" value={b.gradientFrom} fallback={DEFAULTS.from} onChange={(v) => set({ gradientFrom: v })} />
              <ColorField label="למטה" value={b.gradientTo} fallback={DEFAULTS.to} onChange={(v) => set({ gradientTo: v })} />
            </div>
          )}
          {type === 'video' && (
            <div className="max-w-sm">
              <VideoSlot
                title="סרטון רקע"
                text="מתנגן בלי קול, בלולאה. סרטון לאורך, קצר. MP4 או WebM, עד 30MB."
                value={b.backgroundVideoUrl}
                maxBytes={OPENING_VIDEO_MAX}
                upload={(file, onProgress) => uploadVideo('opening', file, onProgress)}
                onChange={(url) => set({ backgroundVideoUrl: url })}
              />
            </div>
          )}

          <div>
            <ImageDropZone
              label="הלוגו שלכם"
              emptyText="קובץ PNG עם רקע שקוף נראה הכי טוב. השקיפות נשמרת."
              aspect="aspect-[3/1] max-w-sm"
              fit="contain"
              keepAlpha
              value={b.logoUrl}
              upload={uploadImage}
              onChange={(url) => set({ logoUrl: url })}
            />
            {b.logoUrl && (
              <div className="mt-1 flex max-w-sm gap-2" aria-label="הלוגו על רקע כהה ועל רקע בהיר">
                <Swatch url={b.logoUrl} dark />
                <Swatch url={b.logoUrl} />
              </div>
            )}
          </div>

          <Field label="משפט פתיחה" hint={`שורה אחת, עד ${WELCOME_MAX} תווים.`}>
            <input
              className="input"
              maxLength={WELCOME_MAX}
              value={b.welcomeText || ''}
              placeholder={defaultWelcome(config.title)}
              onChange={(e) => set({ welcomeText: e.target.value.replace(/[\r\n]+/g, ' ') || undefined })}
            />
            <span className="mt-1 block text-end text-xs text-text-secondary tabular-nums">{(b.welcomeText || '').length}/{WELCOME_MAX}</span>
          </Field>

          <div className="flex flex-wrap gap-6">
            <ColorField label="צבע הטקסט" value={b.textColor} fallback={DEFAULTS.text} resettable onChange={(v) => set({ textColor: v })} />
            <ColorField label="צבע הכפתור" value={b.buttonColor} fallback={DEFAULTS.button} resettable onChange={(v) => set({ buttonColor: v })} />
          </div>
          {warn && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> הטקסט עלול להיות קשה לקריאה על הרקע הזה. נסו צבע טקסט בהיר יותר או כהה יותר.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center">
          <span className="mb-2 text-sm font-medium text-text-secondary">כך הקבוצות יראו את מסך הפתיחה</span>
          <PhonePreview branding={b} title={config.title} />
        </div>
      </div>
    </Card>
  );
}

/** Text vs a known flat background (colour / both gradient ends). Photos and videos: unknown. */
function lowContrast(b: TheCodeBranding): boolean {
  const text = normalizeHex(b.textColor) || DEFAULTS.text;
  const type = effectiveBackground(b);
  const bgs =
    type === 'color' ? [normalizeHex(b.backgroundColor)]
    : type === 'gradient' ? [normalizeHex(b.gradientFrom), normalizeHex(b.gradientTo)]
    : [];
  return bgs.some((bg) => bg && contrastRatio(text, bg) < MIN_TEXT_CONTRAST);
}

/** Native colour picker + the hex + (optionally) "back to default". Always stores '#RRGGBB'. */
function ColorField({
  label,
  value,
  fallback,
  onChange,
  resettable,
}: {
  label: string;
  value?: string;
  fallback: string;
  onChange: (v: string | undefined) => void;
  resettable?: boolean;
}) {
  const shown = normalizeHex(value) || fallback;
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <label className="relative inline-flex size-11 cursor-pointer overflow-hidden rounded-lg ring-1 ring-border" style={{ background: shown }}>
          <input
            type="color"
            aria-label={label}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            value={shown.toLowerCase()}
            onChange={(e) => onChange(normalizeHex(e.target.value))}
          />
        </label>
        <span dir="ltr" className="font-mono text-sm text-text-secondary">{value ? shown : 'ברירת מחדל'}</span>
        {resettable && value && (
          <button type="button" onClick={() => onChange(undefined)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-text-secondary hover:bg-bg-hover" aria-label={`${label}: חזרה לברירת המחדל`}>
            <RotateCcw size={14} aria-hidden /> ברירת מחדל
          </button>
        )}
      </div>
    </div>
  );
}

function Swatch({ url, dark }: { url: string; dark?: boolean }) {
  return (
    <div className={dark ? 'flex h-16 flex-1 items-center justify-center rounded-lg bg-zinc-900 p-2' : 'flex h-16 flex-1 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-border'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      <span className="sr-only">{dark ? 'על רקע כהה' : 'על רקע בהיר'}</span>
    </div>
  );
}

/** Close to the player's opening screen — not pixel-identical, enough to judge the look. */
export function PhonePreview({ branding: b, title }: { branding: TheCodeBranding; title: string }) {
  const type = effectiveBackground(b);
  const text = normalizeHex(b.textColor);
  const button = normalizeHex(b.buttonColor);
  const media: CSSProperties = {
    objectPosition: b.backgroundFocus ? `${b.backgroundFocus.x}% ${b.backgroundFocus.y}%` : undefined,
    transform: b.backgroundZoom && b.backgroundZoom !== 1 ? `scale(${b.backgroundZoom})` : undefined,
  };
  const scrim = type === 'image' || type === 'video';
  return (
    <div dir="rtl" className="relative h-[460px] w-[220px] overflow-hidden rounded-[2rem] border-[6px] border-zinc-800 bg-zinc-900 shadow-xl" aria-label="תצוגה מקדימה של מסך הפתיחה">
      {type === 'image' && b.backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.backgroundUrl} alt="" className="absolute inset-0 size-full object-cover" style={media} />
      ) : type === 'video' && b.backgroundVideoUrl ? (
        <video src={b.backgroundVideoUrl} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" style={media} />
      ) : type === 'color' ? (
        <div className="absolute inset-0" style={{ background: normalizeHex(b.backgroundColor) || DEFAULTS.color }} />
      ) : type === 'gradient' ? (
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${normalizeHex(b.gradientFrom) || DEFAULTS.from}, ${normalizeHex(b.gradientTo) || DEFAULTS.to})` }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-700 via-emerald-900 to-zinc-900" />
      )}
      {scrim && <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/80" />}
      <div className="absolute inset-x-0 top-2 mx-auto h-4 w-20 rounded-full bg-black/70" aria-hidden />

      <div className="relative flex h-full flex-col items-center px-4 pb-4 pt-10 text-center text-white" style={text ? { color: text } : undefined}>
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" className="h-14 max-w-[160px] object-contain drop-shadow" />
        ) : (
          <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed border-current text-xs opacity-60">הלוגו שלכם</div>
        )}
        <div className="mt-auto">
          <div className="text-3xl font-extrabold tracking-tight drop-shadow">קוד הגמדים</div>
          <p className={b.welcomeText ? 'mt-2 line-clamp-3 text-sm leading-snug opacity-90 drop-shadow' : 'mt-2 line-clamp-3 text-sm italic leading-snug opacity-50'}>
            {b.welcomeText || defaultWelcome(title)}
          </p>
        </div>
        <div className="mt-5 w-full space-y-2">
          <div className="rounded-xl py-2.5 text-sm font-bold" style={{ background: button || '#FFFFFF', color: readableOn(button || '#FFFFFF') }}>בואו נתחיל</div>
          <div className="rounded-xl border border-current py-2.5 text-sm font-semibold opacity-80">יש לנו קוד</div>
        </div>
        <div className="mt-3 text-[10px] opacity-60" dir="ltr">Powered by Playzone</div>
      </div>
    </div>
  );
}
