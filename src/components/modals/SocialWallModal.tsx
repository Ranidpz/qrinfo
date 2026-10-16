'use client';

// Social Wall owner modal (code page only). Save-and-stay-open like QBet/Selfie Beam: the parent's
// handleSaveSocialWall uploads the logo/cover, persists the config and returns it; the modal adopts
// the saved config. The screen/staff tokens are generated here on first save and split off to
// codes/{id}/private/secrets by db.ts (SECRET_FIELDS) — they never sit on the public doc.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, Copy, Heart, ImagePlus, Loader2, Lock, MessageCircle, Palette, Plus, RefreshCw, Settings2,
  ShieldCheck, Trash2, Users, X, ListChecks, Globe, AlertTriangle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { compressImage } from '@/lib/imageCompression';
import {
  CHEER_PLACEHOLDERS,
  DEFAULT_CHEERS,
  resolveCheers,
  type SocialWallCheersConfig,
  DEFAULT_SOCIALWALL_CONFIG,
  accessUsesAllowlist,
  type SocialWallAccess,
  type SocialWallConfig,
  type SocialWallGroup,
} from '@/types/socialwall';
import { ModerationPanel, MembersPanel, type SwRequest } from '@/components/socialwall/ModerationPanel';
import AllowlistPanel from '@/components/socialwall/AllowlistPanel';

type Tab = 'settings' | 'list' | 'moderation' | 'members';

const ACCESS_OPTIONS: { key: SocialWallAccess; title: string; text: string; icon: typeof Globe }[] = [
  { key: 'open', title: 'פתוח לכל מי שסורק', text: 'שם ומחלקה וזהו. הכי מהיר, מתאים לאירוע עם קהל סגור במקום.', icon: Globe },
  { key: 'whatsapp', title: 'אימות בוואטסאפ', text: 'כל משתתף מאמת את הטלפון בקוד. משתתף אחד לכל טלפון. עלות הודעה לכל כניסה.', icon: MessageCircle },
  { key: 'allowlist', title: 'רשימת עובדים', text: 'רק טלפונים מהרשימה של HR נכנסים. בלי קוד, אז מי שיודע מספר של עובד יכול להיכנס בשמו.', icon: ListChecks },
  { key: 'allowlist_whatsapp', title: 'רשימת עובדים + וואטסאפ', text: 'הכי מאובטח: רק מהרשימה, ורק עם קוד לטלפון. מומלץ לחברות גדולות.', icon: ShieldCheck },
];

const GROUP_COLORS = ['#db2777', '#2563eb', '#7c3aed', '#ea580c', '#059669', '#0891b2', '#dc2626', '#ca8a04', '#4f46e5', '#0d9488'];
const COLOR_PRESETS: [string, string][] = [
  ['#5b21b6', '#2563eb'],
  ['#be185d', '#7c3aed'],
  ['#0f766e', '#2563eb'],
  ['#ea580c', '#db2777'],
  ['#111827', '#4b5563'],
];

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
const newGroupId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface SocialWallSaveFiles {
  logoFile?: File | null;
  coverFile?: File | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SocialWallConfig, files: SocialWallSaveFiles) => Promise<SocialWallConfig | void>;
  initialConfig?: SocialWallConfig;
  codeId: string;
  shortId: string;
  title: string;
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        {hint && <p className="text-xs text-text-secondary mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ImagePick({
  label, url, onPick, onClear, transparent,
}: {
  label: string; url?: string | null; onPick: (f: File) => void; onClear: () => void; transparent?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className={`relative h-28 rounded-xl border border-border overflow-hidden flex items-center justify-center ${transparent ? 'bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:16px_16px]' : 'bg-bg-secondary'}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`max-w-full max-h-full ${transparent ? 'object-contain p-2' : 'w-full h-full object-cover'}`} />
        ) : (
          <ImagePlus className="w-7 h-7 text-text-secondary" />
        )}
        <div className="absolute bottom-2 end-2 flex gap-1.5">
          <button type="button" onClick={() => ref.current?.click()} className="h-8 px-3 rounded-lg bg-black/60 text-white text-xs font-semibold">
            {url ? 'החלפה' : 'בחירה'}
          </button>
          {url && (
            <button type="button" onClick={onClear} className="h-8 w-8 rounded-lg bg-black/60 text-white flex items-center justify-center" aria-label="הסרה">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </div>
  );
}

function CopyRow({ label, value, onRegenerate }: { label: string; value: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-1.5">
        <input readOnly value={value} dir="ltr" className="input flex-1 text-xs font-mono" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="h-10 w-10 shrink-0 rounded-lg bg-bg-secondary text-text-primary flex items-center justify-center hover:bg-bg-hover"
          aria-label="העתקה"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} title="קישור חדש (הישן יפסיק לעבוד)" className="h-10 w-10 shrink-0 rounded-lg bg-bg-secondary text-text-primary flex items-center justify-center hover:bg-bg-hover">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const GROUP_PRESETS = [
  'שיווק', 'מכירות', 'פיתוח', 'R&D', 'משאבי אנוש', 'HR', 'תפעול', 'כספים', 'IT', 'הנהלה',
  'שירות לקוחות', 'לוגיסטיקה', 'ייצור', 'רכש', 'QA', 'מוצר', 'משפטית', 'אדמיניסטרציה',
];

/** Departments as tags: the event's own (tap to rename, × to remove), ready-made ones to add in
 *  one tap, and a field for a new one. Renaming keeps the id, so posts keep their department. */
function GroupTagsEditor({ groups, onChange }: { groups: SocialWallGroup[]; onChange: (g: SocialWallGroup[]) => void }) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const has = (label: string) => groups.some((g) => g.label.trim().toLowerCase() === label.trim().toLowerCase());
  const add = (label: string) => {
    const clean = label.trim().slice(0, 40);
    if (!clean || has(clean)) return;
    onChange([...groups, { id: newGroupId(), label: clean, color: GROUP_COLORS[groups.length % GROUP_COLORS.length] }]);
  };
  const presets = GROUP_PRESETS.filter((p) => !has(p));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border border-border bg-bg-secondary/40">
        {groups.length === 0 && <span className="text-sm text-text-secondary px-1 py-1.5">עוד אין מחלקות. בחרו מהרשימה למטה או הוסיפו חדשה.</span>}
        {groups.map((g, i) =>
          editing === g.id ? (
            <input
              key={g.id}
              autoFocus
              defaultValue={g.label}
              maxLength={40}
              className="input h-9 w-36 text-sm"
              onBlur={(e) => {
                const v = e.target.value.trim();
                onChange(v ? groups.map((x) => (x.id === g.id ? { ...x, label: v } : x)) : groups);
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <span key={g.id} className="inline-flex items-center h-9 rounded-full ps-1.5 pe-1 gap-1 text-sm font-semibold text-white shadow-sm" style={{ background: g.color || GROUP_COLORS[i % GROUP_COLORS.length] }}>
              <label className="relative w-5 h-5 rounded-full border-2 border-white/70 cursor-pointer overflow-hidden" title="צבע">
                <input
                  type="color"
                  value={g.color || GROUP_COLORS[i % GROUP_COLORS.length]}
                  onChange={(e) => onChange(groups.map((x) => (x.id === g.id ? { ...x, color: e.target.value } : x)))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <button type="button" onClick={() => setEditing(g.id)} className="px-1" title="שינוי שם">{g.label}</button>
              <button type="button" onClick={() => onChange(groups.filter((x) => x.id !== g.id))} className="w-6 h-6 rounded-full hover:bg-black/20 flex items-center justify-center" aria-label={`הסרת ${g.label}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )
        )}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft('');
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="מחלקה חדשה" maxLength={40} className="input flex-1" />
        <button type="submit" disabled={!draft.trim()} className="h-10 px-4 rounded-lg bg-accent text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <Plus className="w-4 h-4" />
          הוספה
        </button>
      </form>
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-text-secondary">הוספה מהירה</span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => add(p)} className="h-8 px-3 rounded-full border border-dashed border-border text-sm text-text-secondary hover:border-accent hover:text-accent flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Production team" cheer posts: on/off, how often, the author name, and the lines themselves
 *  (each can be switched off or edited; placeholder chips insert live values). */
function CheersEditor({ value, onChange }: { value: SocialWallCheersConfig | undefined; onChange: (v: SocialWallCheersConfig) => void }) {
  const r = resolveCheers(value);
  const set = (patch: Partial<SocialWallCheersConfig>) => onChange({ enabled: r.enabled, every: r.every, author: r.author, items: r.items, ...patch });
  const [focused, setFocused] = useState<string | null>(null);
  const insert = (key: string) => {
    const id = focused || r.items[r.items.length - 1]?.id;
    if (!id) return;
    set({ items: r.items.map((c) => (c.id === id ? { ...c, text: `${c.text} ${key}`.slice(0, 120) } : c)) });
  };
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <input type="checkbox" checked={r.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        להציג פוסטים צבעוניים של צוות ההפקה בין התמונות
      </label>
      {r.enabled && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-text-secondary">
              פוסט כל
              <input type="number" min={2} max={20} value={r.every} onChange={(e) => set({ every: Number(e.target.value) })} className="input w-16 text-center" />
              תמונות
            </label>
            <label className="flex items-center gap-2 text-text-secondary">
              בשם
              <input value={value?.author || ''} onChange={(e) => set({ author: e.target.value })} placeholder="צוות ההפקה" maxLength={40} className="input w-40" />
            </label>
          </div>
          <div className="space-y-2">
            {r.items.map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.on}
                  onChange={(e) => set({ items: r.items.map((x) => (x === c ? { ...x, on: e.target.checked } : x)) })}
                  aria-label="הפעלה"
                />
                <input
                  value={c.text}
                  onFocus={() => setFocused(c.id)}
                  onChange={(e) => set({ items: r.items.map((x) => (x === c ? { ...x, text: e.target.value } : x)) })}
                  maxLength={120}
                  className={`input flex-1 text-sm ${c.on ? '' : 'opacity-50'}`}
                />
                <button type="button" onClick={() => set({ items: r.items.filter((x) => x !== c) })} className="h-9 w-9 shrink-0 rounded-lg text-danger hover:bg-danger/10 flex items-center justify-center" aria-label="מחיקה">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => set({ items: [...r.items, { id: `c${Date.now().toString(36)}`, on: true, text: '' }] })}
              className="h-9 px-3 rounded-lg bg-bg-secondary text-sm font-medium text-text-primary flex items-center gap-1.5 hover:bg-bg-hover"
            >
              <Plus className="w-4 h-4" />
              משפט חדש
            </button>
            <button type="button" onClick={() => set({ items: DEFAULT_CHEERS })} className="h-9 px-3 rounded-lg text-sm text-text-secondary hover:text-text-primary">
              חזרה למשפטים המוצעים
            </button>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-text-secondary">ערכים חיים (לחיצה מוסיפה למשפט שנבחר). משפט שהערך שלו עוד לא קיים מחכה עד שיהיה.</span>
            <div className="flex flex-wrap gap-1.5">
              {CHEER_PLACEHOLDERS.map((p) => (
                <button key={p.key} type="button" onClick={() => insert(p.key)} title={p.he} className="h-7 px-2.5 rounded-full border border-border text-xs text-text-secondary hover:border-accent hover:text-accent">
                  {p.he}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SocialWallModal({ isOpen, onClose, onSave, initialConfig, codeId, shortId, title }: Props) {
  const [tab, setTab] = useState<Tab>('settings');
  const [cfg, setCfg] = useState<SocialWallConfig>(DEFAULT_SOCIALWALL_CONFIG);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [purgeText, setPurgeText] = useState('');
  const [purging, setPurging] = useState(false);
  const initKey = useRef<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Init once per open (a post-save parent re-render must not reset the form)
  useEffect(() => {
    if (!isOpen) {
      initKey.current = null;
      return;
    }
    if (initKey.current) return;
    initKey.current = 'open';
    setCfg({
      ...DEFAULT_SOCIALWALL_CONFIG,
      ...initialConfig,
      eventTitle: initialConfig?.eventTitle ?? title,
      branding: { ...DEFAULT_SOCIALWALL_CONFIG.branding, ...initialConfig?.branding },
      groups: initialConfig?.groups || [],
    });
    setLogoFile(null);
    setCoverFile(null);
    setStatus(null);
    setTab('settings');
  }, [isOpen, initialConfig, title]);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [logoPreview, coverPreview]);

  const set = <K extends keyof SocialWallConfig>(key: K, value: SocialWallConfig[K]) => setCfg((c) => ({ ...c, [key]: value }));
  const setBrand = (patch: Partial<NonNullable<SocialWallConfig['branding']>>) =>
    setCfg((c) => ({ ...c, branding: { ...c.branding, ...patch } }));
  const groups = useMemo(() => cfg.groups || [], [cfg.groups]);
  const setGroups = (next: SocialWallGroup[]) => set('groups', next);

  const save = useCallback(async (override?: SocialWallConfig) => {
    setSaving(true);
    setStatus(null);
    try {
      const base = override || cfg;
      const toSave: SocialWallConfig = {
        ...base,
        groups: (base.groups || []).map((g) => ({ ...g, label: g.label.trim() })).filter((g) => g.label),
        screenToken: base.screenToken || randomToken(),
        moderatorToken: base.moderatorToken || randomToken(),
      };
      const saved = await onSave(toSave, { logoFile, coverFile });
      if (saved) setCfg(saved);
      setLogoFile(null);
      setCoverFile(null);
      setStatus({ ok: true, text: 'נשמר' });
    } catch {
      setStatus({ ok: false, text: 'השמירה נכשלה, נסו שוב' });
    } finally {
      setSaving(false);
    }
  }, [cfg, logoFile, coverFile, onSave]);

  const ownerRequest: SwRequest = useCallback((path, init) => fetchWithAuth(path, init), []);

  const purge = async () => {
    setPurging(true);
    try {
      const res = await fetchWithAuth('/api/socialwall/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, confirm: 'DELETE' }),
      });
      if (!res.ok) throw new Error();
      setStatus({ ok: true, text: 'כל התמונות והמשתתפים נמחקו' });
      setPurgeText('');
    } catch {
      setStatus({ ok: false, text: 'המחיקה נכשלה, נסו שוב' });
    } finally {
      setPurging(false);
    }
  };

  if (!isOpen) return null;

  const usesList = accessUsesAllowlist(cfg.access || 'open');
  const savedOnce = !!(initialConfig?.moderatorToken || cfg.moderatorToken);
  const participantUrl = `${origin}/v/${shortId}`;
  const staffUrl = cfg.moderatorToken ? `${origin}/v/${shortId}#mod=${cfg.moderatorToken}` : '';
  const tabs: { key: Tab; label: string; icon: typeof Settings2; show: boolean }[] = [
    { key: 'settings', label: 'הגדרות', icon: Settings2, show: true },
    { key: 'list', label: 'רשימת עובדים', icon: ListChecks, show: usesList },
    { key: 'moderation', label: 'ניהול תמונות', icon: ShieldCheck, show: savedOnce },
    { key: 'members', label: 'משתתפים', icon: Users, show: savedOnce },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-bg-primary border border-border rounded-2xl w-full max-w-3xl max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-text-primary leading-tight">Social Wall</h2>
              <p className="text-xs text-text-secondary truncate" dir="ltr">{participantUrl}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-hover text-text-secondary" aria-label="סגירה">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 flex gap-1 px-4 sm:px-5 pt-3 overflow-x-auto">
          {tabs.filter((t) => t.show).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 px-3.5 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  tab === t.key ? 'bg-bg-secondary text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5 border-t border-border">
          {tab === 'settings' && (
            <div className="space-y-8">
              <Section title="מיתוג" hint="מה שהמשתתפים רואים בכניסה ובראש הפיד">
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-secondary">שם האירוע</span>
                    <input className="input w-full" value={cfg.eventTitle || ''} onChange={(e) => set('eventTitle', e.target.value)} maxLength={120} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-secondary">כותרת מסך הפתיחה</span>
                    <textarea className="input w-full resize-none py-2" rows={2} value={cfg.branding?.welcomeTitle || ''} onChange={(e) => setBrand({ welcomeTitle: e.target.value })} placeholder={'ברוכים הבאים\nליום הכיף שלנו!'} maxLength={80} />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium text-text-secondary">שורת משנה</span>
                    <input className="input w-full" value={cfg.branding?.welcomeSubtitle || ''} onChange={(e) => setBrand({ welcomeSubtitle: e.target.value })} placeholder="מצלמים. משתפים. מתחברים." maxLength={100} />
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ImagePick
                    label="לוגו (PNG שקוף מומלץ)"
                    transparent
                    url={logoPreview || cfg.branding?.logoUrl}
                    onPick={(f) => {
                      setLogoFile(f);
                      setLogoPreview(URL.createObjectURL(f));
                    }}
                    onClear={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                      setBrand({ logoUrl: undefined });
                    }}
                  />
                  <ImagePick
                    label="תמונת פתיחה"
                    url={coverPreview || cfg.branding?.coverImageUrl}
                    onPick={(f) => {
                      setCoverFile(f);
                      setCoverPreview(URL.createObjectURL(f));
                    }}
                    onClear={() => {
                      setCoverFile(null);
                      setCoverPreview(null);
                      setBrand({ coverImageUrl: undefined });
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Palette className="w-4 h-4 text-text-secondary" />
                  {COLOR_PRESETS.map(([a, b]) => (
                    <button
                      key={a + b}
                      type="button"
                      onClick={() => setBrand({ primaryColor: a, secondaryColor: b })}
                      className={`w-9 h-9 rounded-full ring-offset-2 ring-offset-bg-primary ${cfg.branding?.primaryColor === a && cfg.branding?.secondaryColor === b ? 'ring-2 ring-accent' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                      aria-label="ערכת צבעים"
                    />
                  ))}
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <input type="color" value={cfg.branding?.primaryColor || '#5b21b6'} onChange={(e) => setBrand({ primaryColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                    <input type="color" value={cfg.branding?.secondaryColor || '#2563eb'} onChange={(e) => setBrand({ secondaryColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                    צבעים חופשיים
                  </label>
                </div>
              </Section>

              <Section title="מחלקות" hint="המשתתפים בוחרים מהרשימה. בלי מחלקות, לא שואלים.">
                <label className="block space-y-1 max-w-xs">
                  <span className="text-xs font-medium text-text-secondary">איך לקרוא לזה</span>
                  <input className="input w-full" value={cfg.groupLabel || ''} onChange={(e) => set('groupLabel', e.target.value)} placeholder="המחלקה שלך" maxLength={40} />
                </label>
                <GroupTagsEditor groups={groups} onChange={setGroups} />
              </Section>

              <Section title="מי יכול להיכנס">
                <div className="grid sm:grid-cols-2 gap-2">
                  {ACCESS_OPTIONS.map((o) => {
                    const Icon = o.icon;
                    const active = (cfg.access || 'open') === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => set('access', o.key)}
                        className={`text-start p-3.5 rounded-xl border transition-colors ${active ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-text-primary text-sm">
                          <Icon className={`w-4 h-4 ${active ? 'text-accent' : 'text-text-secondary'}`} />
                          {o.title}
                          {active && <Check className="w-4 h-4 text-accent ms-auto" />}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{o.text}</p>
                      </button>
                    );
                  })}
                </div>
                {usesList && (
                  <p className="text-xs text-text-secondary flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" />
                    את רשימת העובדים מעלים בלשונית &quot;רשימת עובדים&quot; (אחרי השמירה).
                  </p>
                )}
              </Section>

              <Section title="אישור תמונות">
                <div className="grid sm:grid-cols-2 gap-2">
                  {([
                    ['post', 'עולות מיד', 'כל תמונה מופיעה בפיד מיד, ואפשר להסתיר אותה מלשונית "ניהול תמונות".'],
                    ['pre', 'רק אחרי אישור', 'תמונה מופיעה רק אחרי שמישהו מהצוות אישר. בטוח יותר, דורש מישהו זמין.'],
                  ] as const).map(([key, t1, t2]) => {
                    const active = (cfg.feedModeration || 'post') === key;
                    return (
                      <button key={key} type="button" onClick={() => set('feedModeration', key)} className={`text-start p-3.5 rounded-xl border ${active ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                        <div className="font-semibold text-sm text-text-primary flex items-center gap-2">
                          {t1}
                          {active && <Check className="w-4 h-4 text-accent ms-auto" />}
                        </div>
                        <p className="text-xs text-text-secondary mt-1">{t2}</p>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="פוסטים של צוות ההפקה" hint="משפטי עידוד בכתב גדול על רקע צבעוני, לפי הסדר, בין התמונות בפיד">
                <CheersEditor value={cfg.cheers} onChange={(v) => set('cheers', v)} />
              </Section>

              <Section title="הסבר קצר אחרי ההרשמה" hint="כרטיס שקופץ פעם אחת אחרי הכניסה: לבחור תמונות בקפידה, לפרגן בלבבות, לשתף חברים, ולהיות ביחד">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <input type="checkbox" checked={cfg.guide?.enabled !== false} onChange={(e) => set('guide', { ...cfg.guide, enabled: e.target.checked })} />
                    להציג את ההסבר למשתתפים חדשים
                  </label>
                  {cfg.guide?.enabled !== false && (
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input type="checkbox" checked={cfg.guide?.prizes === true} onChange={(e) => set('guide', { ...cfg.guide, prizes: e.target.checked })} />
                      יש פרסים לתמונות המובילות (מוסיף שורה &quot;התמונות המובילות זוכות בפרסים&quot;)
                    </label>
                  )}
                </div>
              </Section>

              <Section title="הגבלות">
                <div className="grid grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-secondary">תמונות למשתתף</span>
                    <input type="number" min={1} max={500} className="input w-full" value={cfg.maxPostsPerMember ?? 40} onChange={(e) => set('maxPostsPerMember', Number(e.target.value))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-secondary">אורך כיתוב (0 = בלי)</span>
                    <input type="number" min={0} max={280} className="input w-full" value={cfg.captionMax ?? 120} onChange={(e) => set('captionMax', Number(e.target.value))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-secondary">מקסימום משתתפים</span>
                    <input type="number" min={1} max={20000} className="input w-full" value={cfg.maxMembers ?? 3000} onChange={(e) => set('maxMembers', Number(e.target.value))} />
                  </label>
                </div>
              </Section>

              {savedOnce && (
                <Section title="קישורים">
                  <CopyRow label="קישור למשתתפים (זה שב-QR)" value={participantUrl} />
                  <CopyRow
                    label="קישור לצוות בשטח: ניהול תמונות מהטלפון, בלי התחברות. לא לשתף עם משתתפים."
                    value={staffUrl}
                    onRegenerate={() => void save({ ...cfg, moderatorToken: randomToken() })}
                  />
                </Section>
              )}

              {savedOnce && (
                <Section title="סיום האירוע">
                  <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 space-y-3">
                    <p className="text-sm text-text-primary flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                      מחיקת כל התמונות, המשתתפים ורשימת העובדים. ההגדרות נשארות. אי אפשר לשחזר. כדאי להוריד קודם את האקסל מלשונית &quot;משתתפים&quot;.
                    </p>
                    <div className="flex gap-2">
                      <input value={purgeText} onChange={(e) => setPurgeText(e.target.value)} placeholder='הקלידו "מחיקה"' className="input flex-1 text-sm" />
                      <button onClick={purge} disabled={purgeText.trim() !== 'מחיקה' || purging} className="h-10 px-4 rounded-lg bg-danger text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
                        {purging && <Loader2 className="w-4 h-4 animate-spin" />}
                        מחיקת הכל
                      </button>
                    </div>
                  </div>
                </Section>
              )}
            </div>
          )}

          {tab === 'list' && (
            <AllowlistPanel
              codeId={codeId}
              groups={groups}
              onAddGroups={(labels) => {
                const next = [
                  ...groups,
                  ...labels.map((label, i) => ({ id: newGroupId() + i, label, color: GROUP_COLORS[(groups.length + i) % GROUP_COLORS.length] })),
                ];
                const nextCfg = { ...cfg, groups: next };
                setCfg(nextCfg);
                void save(nextCfg); // the server matches list departments against the SAVED groups
              }}
            />
          )}
          {tab === 'moderation' && <ModerationPanel codeId={codeId} groups={groups} request={ownerRequest} />}
          {tab === 'members' && <MembersPanel codeId={codeId} groups={groups} request={ownerRequest} eventTitle={cfg.eventTitle || title} />}
        </div>

        {tab === 'settings' && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border">
            <div className="text-sm">
              {status && <span className={status.ok ? 'text-emerald-600 flex items-center gap-1' : 'text-danger'}>{status.ok && <Check className="w-4 h-4" />}{status.text}</span>}
              {!status && (
                <span className="text-xs text-text-secondary flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  הרשת סגורה: רק מי שנכנס רואה תמונות
                </span>
              )}
            </div>
            <button onClick={() => void save()} disabled={saving} className="btn btn-primary min-w-32 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Logo upload prep (transparent PNG), shared with the code page save handler. */
export async function prepareLogo(file: File): Promise<Blob> {
  try {
    const r = await compressImage(file, { maxWidth: 800, maxHeight: 400, maxSizeKB: 300, preserveAlpha: true });
    return r.blob;
  } catch {
    return file;
  }
}
