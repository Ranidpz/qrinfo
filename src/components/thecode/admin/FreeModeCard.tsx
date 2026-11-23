'use client';

// קוד הגמדים — "סוג המשחק": guided (the original) or free (23.11.2026), and the free game's own
// settings: when a sleeping gnome wakes (days / hours / minutes), attempts per riddle, the hint
// for where the big screen stands, and Cliostro's two "video call" clips (any text is edited into
// the clip itself). Everything is saved like the rest of the settings (immediately).

import type { TheCodeFreeSettings } from '@/types/thecode';
import { DEFAULT_FREE_RULES, MAX_REFRESH_MINUTES, joinRefresh, splitRefresh } from '@/lib/thecode/engineFree';
import type { ScreenProps } from './model';
import { Card, Field, NumberInput, Segmented } from './ui';
import { VideoSlot } from './LobbyCards';

export default function FreeModeCard({ state, actions, uploadVideo }: Pick<ScreenProps, 'state' | 'actions' | 'uploadVideo'>) {
  const { config } = state;
  const free = config.mode === 'free';
  const f: TheCodeFreeSettings = config.free || {};
  const set = (patch: Partial<TheCodeFreeSettings>) => {
    const next: TheCodeFreeSettings = { ...(config.free || {}), ...patch };
    for (const k of Object.keys(next) as (keyof TheCodeFreeSettings)[]) if (next[k] === undefined || next[k] === '') delete next[k];
    actions.updateConfig({ free: Object.keys(next).length ? next : undefined });
  };
  const refresh = splitRefresh(f.refreshMinutes ?? DEFAULT_FREE_RULES.refreshMinutes);
  const setRefresh = (part: 'days' | 'hours' | 'minutes') => (n: number) => set({ refreshMinutes: joinRefresh({ ...refresh, [part]: n }) });

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">סוג המשחק</h2>
      <p className="mb-4 text-sm text-text-secondary">
        במשחק החופשי סורקים כל גמד ער, עונים על החידה שלו, והוא נרדם עד שיתעורר עם חידה חדשה. בלי משפט סודי ובלי מזוודה.
      </p>
      <Segmented label="סוג המשחק" value={free ? 'free' : 'guided'}
        onChange={(m) => actions.updateConfig({ mode: m === 'free' ? 'free' : undefined })}
        options={[{ value: 'guided', label: 'מונחה (מזוודה)' }, { value: 'free', label: 'חופשי' }]} />
      <p className="mt-2 text-sm text-text-secondary">
        החליפו סוג משחק רק יחד עם &quot;סבב חדש&quot; בתחתית העמוד, כדי שאף קבוצה לא תישאר באמצע המשחק הקודם.
      </p>

      {free && (
        <div className="mt-6 space-y-5">
          <Field label="גמד מתעורר אחרי" hint={`מהרגע שקבוצה פתרה את החידה שלו (או טעתה פעמיים). עד ${MAX_REFRESH_MINUTES / 1440} ימים.`}>
            <div className="flex flex-wrap items-center gap-2">
              <NumberInput label="ימים" value={refresh.days} onChange={setRefresh('days')} min={0} max={14} suffix="ימים" />
              <NumberInput label="שעות" value={refresh.hours} onChange={setRefresh('hours')} min={0} max={23} suffix="שעות" />
              <NumberInput label="דקות" value={refresh.minutes} onChange={setRefresh('minutes')} min={0} max={59} suffix="דקות" />
            </div>
          </Field>
          <Field label="ניסיונות לכל חידה" hint="תשובה נכונה אחרי טעות שווה חצי מהנקודות. בסוף הניסיונות הגמד נרדם בלי נקודות.">
            <Segmented label="ניסיונות לכל חידה" value={f.attemptsPerRiddle ?? DEFAULT_FREE_RULES.attemptsPerRiddle}
              onChange={(n) => set({ attemptsPerRiddle: n })} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
          <Field label="איפה המסך הגדול" hint="קבוצה שסורקת גמד לפני שנרשמה מתבקשת ללכת למסך. כאן כותבים לה איפה הוא.">
            <input className="input" maxLength={160} value={f.screenHint || ''} placeholder="למשל: בלובי, על הקיר שמול דלפק הקבלה"
              onChange={(e) => set({ screenHint: e.target.value })} />
          </Field>
          <div>
            <div className="font-medium">שיחות וידאו מהקוסם</div>
            <p className="mb-3 text-sm text-text-secondary">
              הטלפון &quot;מצלצל&quot;, הקבוצה עונה והסרטון עולה במסך מלא. כל מה שצריך לכתוב, כתבו בתוך הסרטון עצמו. בלי סרטון אין שיחה.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <VideoSlot title="אחרי ההרשמה" text="הקוסם מסביר לקבוצה מה עושים." value={f.introVideo}
                upload={(file, onProgress) => uploadVideo('explain', file, onProgress)} onChange={(url) => set({ introVideo: url })} />
              <VideoSlot title="כל הכבוד" text="כשכל הגמדים נרדמו והקבוצה סיימה להיום." value={f.wellDoneVideo}
                upload={(file, onProgress) => uploadVideo('explain', file, onProgress)} onChange={(url) => set({ wellDoneVideo: url })} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
