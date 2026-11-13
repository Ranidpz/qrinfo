'use client';

import type { ReactNode } from 'react';
import type { TheCodeRules } from '@/types/thecode';
import type { ScreenProps } from './model';
import { Card, Field, NumberInput, ScreenHeader, Segmented, ToggleRow } from './ui';
import BrandingCard from './BrandingCard';
import HowToPlayCard from './HowToPlayCard';
import { BigScreenCard, SelfieCard } from './LobbyCards';

export default function SettingsScreen({ state, actions, report, uploadImage, uploadVideo, links }: ScreenProps) {
  const { config } = state;
  const r = config.rules;
  const rule = (key: keyof TheCodeRules) => (n: number) => actions.updateRules({ [key]: n });
  const hebrewPhrases = config.phrases.some((p) => /[א-ת]/.test(p.text));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ScreenHeader title="הגדרות" summary="השינויים נשמרים מיד." />

      <div id="branding" className="scroll-mt-32">
        <BrandingCard state={state} actions={actions} uploadImage={uploadImage} />
      </div>

      <div id="how-to-play" className="scroll-mt-32">
        <HowToPlayCard state={state} actions={actions} />
      </div>

      <div id="selfie" className="scroll-mt-32">
        <SelfieCard state={state} actions={actions} />
      </div>

      <div id="big-screen" className="scroll-mt-32">
        <BigScreenCard state={state} actions={actions} uploadVideo={uploadVideo} links={links} />
      </div>

      <Section title="כללי">
        <Field label="שם ההרפתקה" hint="מופיע לקבוצות ובלוח התוצאות.">
          <input className="input" value={config.title} onChange={(e) => actions.updateConfig({ title: e.target.value })} />
        </Field>
        <Row label="שפת המשחק" hint="שפת לוח האותיות של הקבוצות.">
          <Segmented label="שפת המשחק" value={config.language} onChange={(language) => actions.updateConfig({ language })} options={[{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }]} />
        </Row>
        {config.language === 'en' && hebrewPhrases && (
          <p className="text-sm text-danger">
            המשפטים והתשובות כתובים בעברית, ולכן הם לא תקינים בשפה הזו ({report.errors} שגיאות).
          </p>
        )}
      </Section>

      <Section title="ניקוד">
        <Row label="נקודות לכל אות" hint="תשובה נכונה ליד הגמד הנכון.">
          <NumberInput label="נקודות לכל אות" value={r.pointsPerLetter} onChange={rule('pointsPerLetter')} min={1} max={100} />
        </Row>
        <Row label="בונוס פתיחת מזוודה">
          <NumberInput label="בונוס פתיחת מזוודה" value={r.suitcaseBonus} onChange={rule('suitcaseBonus')} min={0} max={500} step={5} />
        </Row>
        <Row label="רצף חם" hint="אחרי כמה תשובות נכונות ברצף הניקוד מוכפל, עד הטעות הבאה.">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput label="תשובות ברצף" value={r.hotStreakAt} onChange={rule('hotStreakAt')} min={2} max={10} suffix="ברצף" />
            <NumberInput label="מכפיל" value={r.hotMultiplier} onChange={rule('hotMultiplier')} min={1} max={5} suffix="× נקודות" />
          </div>
        </Row>
        <Row label="מחיר רמז" hint="הרמז הראשון חינם. כל רמז נוסף עולה נקודות ושובר את הרצף.">
          <NumberInput label="מחיר רמז" value={r.hintCost} onChange={rule('hintCost')} min={0} max={50} suffix="נקודות" />
        </Row>
      </Section>

      <Section title="טעויות">
        <Row label="סריקות שגויות בחינם" hint="כמה פעמים מותר לסרוק גמד לא נכון בכל משימה בלי לאבד נקודות.">
          <Segmented label="סריקות שגויות בחינם" value={r.freeWrongScans} onChange={rule('freeWrongScans')} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
        </Row>
        <Row label="קנס על סריקה שגויה" hint="אחרי הסריקות בחינם. סריקה חוזרת של אותו גמד לא נספרת פעמיים.">
          <NumberInput label="קנס על סריקה שגויה" value={r.wrongScanPenalty} onChange={rule('wrongScanPenalty')} min={0} max={50} suffix="נקודות" />
        </Row>
        <Row label="תשובות שגויות בחינם" hint="אחר כך יש קנס והמתנה בין ניסיונות.">
          <NumberInput label="תשובות שגויות בחינם" value={r.freeWrongAnswers} onChange={rule('freeWrongAnswers')} min={0} max={5} />
        </Row>
        <Row label="קנס על תשובה שגויה">
          <NumberInput label="קנס על תשובה שגויה" value={r.wrongAnswerPenalty} onChange={rule('wrongAnswerPenalty')} min={0} max={50} suffix="נקודות" />
        </Row>
        <Row label="המתנה בין ניסיונות">
          <NumberInput label="המתנה בין ניסיונות" value={r.answerCooldownSeconds} onChange={rule('answerCooldownSeconds')} min={0} max={300} step={5} suffix="שניות" />
        </Row>
        <p className="text-sm text-text-secondary">הניקוד לא יורד מתחת לאפס, ואותיות שנאספו לא נלקחות.</p>
      </Section>

      <Section title="שעות פעילות">
        <ToggleRow
          label="רק בשעות מסוימות"
          hint="מחוץ לשעות קבוצות רואות &quot;המשחק בהפסקה&quot;, וההתקדמות שלהן נשמרת."
          checked={!!config.activeHours}
          onChange={(v) => actions.updateConfig({ activeHours: v ? { from: '08:00', to: '21:00' } : undefined })}
        />
        {config.activeHours && (
          <div className="flex flex-wrap items-end gap-4">
            <Field label="משעה">
              <input type="time" dir="ltr" className="input w-36" value={config.activeHours.from} onChange={(e) => actions.updateConfig({ activeHours: { ...config.activeHours!, from: e.target.value } })} />
            </Field>
            <Field label="עד שעה">
              <input type="time" dir="ltr" className="input w-36" value={config.activeHours.to} onChange={(e) => actions.updateConfig({ activeHours: { ...config.activeHours!, to: e.target.value } })} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="פרטיות ואימות">
        <ToggleRow
          label="אימות הורה בוואטסאפ"
          hint="קבוצה מאשרת מספר טלפון של מבוגר אחראי לפני שמתחילה. בלי זה — רק כינוי ואימוג׳י."
          checked={config.requirePhoneVerification}
          onChange={(v) => actions.updateConfig({ requirePhoneVerification: v })}
        />
        <Row label="מחיקת נתונים אוטומטית" hint="פרופיל של קבוצה שלא שיחקה זמן רב יימחק.">
          <NumberInput label="ימים" value={config.retentionDays} onChange={(n) => actions.updateConfig({ retentionDays: n })} min={7} max={365} suffix="ימים בלי משחק" />
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-56">
        <div className="font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-sm text-text-secondary">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
