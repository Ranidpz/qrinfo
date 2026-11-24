'use client';

// קוד הגמדים — "סוג המשחק": guided (the original) or free (23.11.2026), and the free game's own
// settings: when a sleeping gnome wakes (days / hours / minutes), attempts per riddle, the hint
// for where the big screen stands, and Cliostro's two "video call" clips (any text is edited into
// the clip itself). Everything is saved like the rest of the settings (immediately).

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { TheCodeFreeSettings } from '@/types/thecode';
import { DEFAULT_FREE_RULES, MAX_REFRESH_MINUTES, joinRefresh, splitRefresh } from '@/lib/thecode/engineFree';
import type { ScreenProps } from './model';
import { Button, Card, Field, NumberInput, Segmented } from './ui';
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
  // Switching the game while groups already played asks first and points at "סבב חדש"
  // (Rani 24.11.2026) — a group half-way through the other game would be left stranded.
  const [asking, setAsking] = useState<'free' | 'guided' | null>(null);
  const played = state.players.length;
  const setMode = (m: 'free' | 'guided') => actions.updateConfig({ mode: m === 'free' ? 'free' : undefined });
  const chooseMode = (m: 'free' | 'guided') => {
    if (m === (free ? 'free' : 'guided')) return;
    if (played > 0) setAsking(m);
    else setMode(m);
  };
  const toNewRound = () => document.getElementById('new-round')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const setRefresh = (part: 'days' | 'hours' | 'minutes') => (n: number) => set({ refreshMinutes: joinRefresh({ ...refresh, [part]: n }) });

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">סוג המשחק</h2>
      <p className="mb-4 text-sm text-text-secondary">
        במשחק החופשי סורקים כל גמד ער, עונים על החידה שלו, והוא נרדם עד שיתעורר עם חידה חדשה. בלי משפט סודי ובלי מזוודה.
      </p>
      <Segmented label="סוג המשחק" value={free ? 'free' : 'guided'}
        onChange={(m) => chooseMode(m as 'free' | 'guided')}
        options={[{ value: 'guided', label: 'מונחה (מזוודה)' }, { value: 'free', label: 'חופשי' }]} />
      {asking ? (
        <div className="mt-3 rounded-lg bg-warning/10 px-4 py-3 text-sm">
          <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {`${played === 1 ? 'קבוצה אחת כבר שיחקה' : `${played} קבוצות כבר שיחקו`} במשחק ${free ? 'החופשי' : 'המונחה'}. כדי שאף קבוצה לא תישאר באמצע, התחילו "סבב חדש" אחרי ההחלפה. הגמדים, החידות והקודים המודפסים לא משתנים.`}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>ביטול</Button>
            <Button size="sm" onClick={() => { setMode(asking); setAsking(null); }}>החליפו בלי סבב חדש</Button>
            <Button size="sm" variant="primary" onClick={() => { setMode(asking); setAsking(null); window.setTimeout(toNewRound, 50); }}>
              החליפו ועברו לסבב חדש
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">
          החליפו סוג משחק רק יחד עם &quot;סבב חדש&quot; בתחתית העמוד, כדי שאף קבוצה לא תישאר באמצע המשחק הקודם.
        </p>
      )}

      {free && (
        <div className="mt-6 space-y-5">
          <Field label="גמד מתעורר אחרי" hint={`מהרגע שקבוצה פתרה את החידה שלו, או שנגמרו לה הניסיונות. עד ${MAX_REFRESH_MINUTES / 1440} ימים.`}>
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
          <Field label="אחרי החידה האחרונה של גמד" hint="כשקבוצה ענתה על כל החידות של גמד.">
            <Segmented label="אחרי החידה האחרונה של גמד" value={(f.wrapRiddles ?? DEFAULT_FREE_RULES.wrapRiddles) ? 'wrap' : 'stop'}
              onChange={(v) => set({ wrapRiddles: v === 'wrap' ? undefined : false })}
              options={[{ value: 'wrap', label: 'מתחילים מההתחלה' }, { value: 'stop', label: 'הגמד סיים' }]} />
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
