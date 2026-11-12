'use client';

import type { TheCodeBranding } from '@/types/thecode';
import type { ScreenProps } from './model';
import ImageDropZone from './ImageDropZone';
import { Card, Field } from './ui';

/** Same limit the server enforces (src/lib/thecode/server/admin.ts THECODE_LIMITS.welcomeText). */
export const WELCOME_MAX = 140;

export const hasBranding = (b?: TheCodeBranding) => !!(b && (b.backgroundUrl || b.logoUrl || b.welcomeText));

export const defaultWelcome = (title: string) => `ברוכים הבאים ל${title.trim() || 'הרפתקה'}! מצאו את הגמדים ופתחו את המזוודה.`;

/**
 * "מיתוג המלון": the families' opening screen (after the first scan) belongs to the venue —
 * its photo, its logo and a welcome line, then register / "יש לנו קוד". Inside the game our
 * own look stays. Every field is optional; removing one sets it to undefined, and a branding
 * with nothing left is dropped.
 */
export default function BrandingCard({ state, actions, uploadImage }: Pick<ScreenProps, 'state' | 'actions' | 'uploadImage'>) {
  const { config } = state;
  const b = config.branding || {};

  const set = (patch: Partial<TheCodeBranding>) => actions.updateBranding(patch);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">מיתוג המקום</h2>
      <p className="mt-1 text-text-secondary">
        המסך הראשון שקבוצה רואה אחרי שסרקה גמד הוא שלכם: תמונה, לוגו ומשפט פתיחה, ואז הרשמה. בתוך המשחק נשאר העיצוב שלנו.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-6">
          <ImageDropZone
            label="תמונת רקע"
            emptyText="תמונה לאורך (הטלפון מוחזק זקוף) — למשל הלובי או הבריכה. תמונה גדולה תוקטן אוטומטית."
            aspect="aspect-[3/4] max-w-[15rem]"
            value={b.backgroundUrl}
            upload={uploadImage}
            onChange={(url) => set({ backgroundUrl: url })}
          />

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
        </div>

        <div className="flex flex-col items-center">
          <span className="mb-2 text-sm font-medium text-text-secondary">כך הקבוצות יראו את מסך הפתיחה</span>
          <PhonePreview branding={b} title={config.title} />
        </div>
      </div>
    </Card>
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

/** Close to the player's opening screen — not pixel-identical, enough to judge photo + logo + text. */
export function PhonePreview({ branding: b, title }: { branding: TheCodeBranding; title: string }) {
  return (
    <div dir="rtl" className="relative h-[460px] w-[220px] overflow-hidden rounded-[2rem] border-[6px] border-zinc-800 bg-zinc-900 shadow-xl" aria-label="תצוגה מקדימה של מסך הפתיחה">
      {b.backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.backgroundUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-700 via-emerald-900 to-zinc-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/80" />
      <div className="absolute inset-x-0 top-2 mx-auto h-4 w-20 rounded-full bg-black/70" aria-hidden />

      <div className="relative flex h-full flex-col items-center px-4 pb-4 pt-10 text-center text-white">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" className="h-14 max-w-[160px] object-contain drop-shadow" />
        ) : (
          <div className="flex h-14 w-32 items-center justify-center rounded-lg border border-dashed border-white/50 text-xs text-white/70">הלוגו שלכם</div>
        )}
        <div className="mt-auto">
          <div className="text-3xl font-extrabold tracking-tight drop-shadow">קוד הגמדים</div>
          <p className={b.welcomeText ? 'mt-2 line-clamp-3 text-sm leading-snug text-white/90 drop-shadow' : 'mt-2 line-clamp-3 text-sm italic leading-snug text-white/50'}>
            {b.welcomeText || defaultWelcome(title)}
          </p>
        </div>
        <div className="mt-5 w-full space-y-2">
          <div className="rounded-xl bg-white py-2.5 text-sm font-bold text-zinc-900">בואו נתחיל</div>
          <div className="rounded-xl border border-white/60 py-2.5 text-sm font-semibold">יש לנו קוד</div>
        </div>
        <div className="mt-3 text-[10px] text-white/60" dir="ltr">Powered by Playzone</div>
      </div>
    </div>
  );
}
