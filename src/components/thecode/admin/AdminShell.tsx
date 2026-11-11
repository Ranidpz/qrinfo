'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  CircleHelp, KeyRound, LayoutDashboard, MapPin, Moon, Printer, RotateCcw, ScanLine, Settings, Shapes, Sun, Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { AdminActions, AdminState, AdventureReport, PhraseCoverage, ScreenProps } from './model';
import type { AdminTab, AdminTarget } from './nav';
import { IconButton, cx } from './ui';
import OverviewScreen from './OverviewScreen';
import SpotsScreen from './SpotsScreen';
import GnomesScreen from './GnomesScreen';
import RiddlesScreen from './RiddlesScreen';
import PhrasesScreen from './PhrasesScreen';
import PrintScreen from './PrintScreen';
import SetupScreen from './SetupScreen';
import PlayersScreen from './PlayersScreen';
import SettingsScreen from './SettingsScreen';

const TABS: { id: AdminTab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'סקירה', icon: LayoutDashboard },
  { id: 'spots', label: 'מקומות', icon: MapPin },
  { id: 'gnomes', label: 'גמדים', icon: Shapes },
  { id: 'riddles', label: 'חידות', icon: CircleHelp },
  { id: 'phrases', label: 'משפטים', icon: KeyRound },
  { id: 'print', label: 'הדפסה', icon: Printer },
  { id: 'setup', label: 'מצב התקנה', icon: ScanLine },
  { id: 'players', label: 'משפחות', icon: Trophy },
  { id: 'settings', label: 'הגדרות', icon: Settings },
];

export interface AdminShellProps {
  state: AdminState;
  report: AdventureReport;
  actions: AdminActions;
  coverageOf: (text: string) => PhraseCoverage;
  /** Shown as a small tag in the header (e.g. "הדגמה"). */
  badge?: ReactNode;
}

export default function AdminShell({ state, report, actions, coverageOf, badge }: AdminShellProps) {
  const [target, setTarget] = useState<AdminTarget>({ tab: 'overview' });
  const [checked, setChecked] = useState(false);
  const [dark, setDark] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Keep the active tab visible in the phone tab strip.
  useEffect(() => {
    document.querySelector('[data-compact-tab][aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [target.tab]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const navigate = (next: AdminTarget) => {
    setTarget(next);
    window.scrollTo({ top: 0 });
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const props: ScreenProps = { state, report, actions, navigate, target, coverageOf, now };
  const tab = target.tab;

  return (
    <div dir="rtl" lang="he" className="min-h-dvh bg-bg-primary text-text-primary" style={{ fontFamily: 'var(--font-assistant), system-ui, sans-serif' }}>
      <header className="sticky top-0 z-30 border-b border-border bg-bg-secondary/95 backdrop-blur print:hidden">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <span className="text-lg font-bold">הקוד</span>
          <span className="truncate text-text-secondary">{state.config.title}</span>
          {badge}
          <div className="ms-auto flex items-center gap-1">
            <IconButton icon={dark ? Sun : Moon} label={dark ? 'מצב יום' : 'מצב לילה'} onClick={toggleDark} />
            <IconButton
              icon={RotateCcw}
              label="התחילו מחדש עם נתוני הדוגמה"
              onClick={() => {
                actions.reset();
                setChecked(false);
                navigate({ tab: 'overview' });
              }}
            />
          </div>
        </div>
        {/* Phone / tablet: one scrollable row of tabs */}
        <nav aria-label="ניווט" className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:hidden">
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} active={tab === t.id} errors={t.id === 'overview' ? report.errors : 0} onClick={() => navigate({ tab: t.id })} compact />
          ))}
        </nav>
      </header>

      <div className="flex">
        <nav aria-label="ניווט" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-e border-border bg-bg-secondary p-3 lg:flex print:hidden">
          {TABS.map((t) => (
            <TabButton key={t.id} tab={t} active={tab === t.id} errors={t.id === 'overview' ? report.errors : 0} onClick={() => navigate({ tab: t.id })} />
          ))}
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          {tab === 'overview' && <OverviewScreen {...props} checked={checked} onChecked={() => setChecked(true)} />}
          {tab === 'spots' && <SpotsScreen {...props} />}
          {tab === 'gnomes' && <GnomesScreen {...props} />}
          {tab === 'riddles' && <RiddlesScreen {...props} />}
          {tab === 'phrases' && <PhrasesScreen {...props} />}
          {tab === 'print' && <PrintScreen {...props} />}
          {tab === 'setup' && <SetupScreen {...props} />}
          {tab === 'players' && <PlayersScreen {...props} />}
          {tab === 'settings' && <SettingsScreen {...props} />}
        </main>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  errors,
  onClick,
  compact,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  errors: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      data-compact-tab={compact ? '' : undefined}
      className={cx(
        'flex shrink-0 items-center gap-2 rounded-lg font-medium transition-colors',
        compact ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-3',
        active ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      )}
    >
      <Icon size={compact ? 16 : 20} aria-hidden />
      <span className="whitespace-nowrap">{tab.label}</span>
      {errors > 0 && (
        <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white" aria-label={`${errors} שגיאות`}>
          {errors}
        </span>
      )}
    </button>
  );
}
