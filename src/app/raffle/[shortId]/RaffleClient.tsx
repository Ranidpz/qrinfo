'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu, X, RotateCcw, Trophy, Eye, Volume2, Palette, ChevronDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import RaffleDisplay from '@/components/raffle/RaffleDisplay';
import type { RaffleConfig, RaffleParticipant, RaffleWinner } from '@/lib/raffle/types';
import { fullName } from '@/lib/raffle/types';

interface RaffleClientProps {
  config: RaffleConfig;
  codeId: string;
  token: string;
  authorized: boolean;
}

export default function RaffleClient({ config, codeId, token, authorized }: RaffleClientProps) {
  const [participants, setParticipants] = useState<RaffleParticipant[]>([]);
  const [loadingNames, setLoadingNames] = useState(true); // until the first fetch resolves
  const [sessionWinners, setSessionWinners] = useState<RaffleWinner[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [barShown, setBarShown] = useState(false); // hamburger reveals on top-strip hover
  const [winnersOpen, setWinnersOpen] = useState(true); // main live view — open by default
  const [displayOpen, setDisplayOpen] = useState(false); // local display tweaks — collapsed
  // LOCAL display overrides — ephemeral, never saved to the server, so tweaking
  // the look on the big screen can't overwrite the owner's saved config.
  const [display, setDisplay] = useState<RaffleConfig>(config);

  const fetchNames = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/raffle/names?codeId=${encodeURIComponent(codeId)}&token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      if (!r.ok) {
        setParticipants([]);
        return;
      }
      const data = await r.json();
      setParticipants(
        (data.participants || []).map(
          (p: { id: string; firstName: string; lastName: string; remaining?: number }) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            phone: '',
            quantity: 1,
            remaining: p.remaining ?? 1,
          })
        )
      );
    } catch {
      setParticipants([]);
    } finally {
      setLoadingNames(false);
    }
  }, [codeId, token]);

  useEffect(() => {
    if (authorized) fetchNames();
  }, [authorized, fetchNames]);

  const onRequestDraw = useCallback(async (): Promise<RaffleWinner | null> => {
    try {
      const r = await fetch('/api/raffle/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, token }),
      });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data.winner) return null;
      const w: RaffleWinner = {
        id: data.winner.id,
        firstName: data.winner.firstName,
        lastName: data.winner.lastName,
        phone: '',
        rank: data.winner.rank,
        wonAt: Date.now(),
      };
      setSessionWinners((prev) => [...prev, w]);
      fetchNames();
      return w;
    } catch {
      return null;
    }
  }, [codeId, token, fetchNames]);

  const onReset = useCallback(async () => {
    setResetting(true);
    try {
      await fetchWithAuth(`/api/raffle/winners?codeId=${encodeURIComponent(codeId)}`, {
        method: 'DELETE',
      });
    } catch {
      /* not the owner / offline — still clear the local session */
    } finally {
      setSessionWinners([]);
      await fetchNames();
      setResetting(false);
    }
  }, [codeId, fetchNames]);

  const patchDisplay = (p: Partial<RaffleConfig>) => setDisplay((d) => ({ ...d, ...p }));

  if (!authorized) {
    return (
      <div
        dir="rtl"
        className="flex h-screen w-screen items-center justify-center bg-black px-6 text-center text-white/55"
        style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
      >
        <div className="text-2xl font-medium">הלינק אינו מורשה</div>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <RaffleDisplay
        participants={participants}
        config={display}
        onRequestDraw={onRequestDraw}
        canShowPhones={false}
        loading={loadingNames}
      />

      {/* Top hover strip — reveals the control hamburger only when the mouse is
          near the top of the screen (animated), keeping the projection clean. */}
      <div
        className="fixed inset-x-0 top-0 z-30 h-16"
        onMouseEnter={() => setBarShown(true)}
        onMouseLeave={() => setBarShown(false)}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="שליטה"
          className={`absolute left-5 top-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 ${
            barShown || drawerOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-3 opacity-0'
          }`}
        >
          <Menu size={22} />
        </button>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
      )}
      <aside
        dir="rtl"
        className={`fixed inset-y-0 right-0 z-50 flex w-[360px] max-w-[88vw] flex-col bg-[#0d0d12] text-white shadow-2xl transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ fontFamily: 'var(--font-assistant), sans-serif' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-lg font-bold">שליטה במסך</h2>
          <button onClick={() => setDrawerOpen(false)} className="text-white/60 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {/* Winners — open by default (the main live view) */}
          <Accordion
            title={`זוכים בהגרלה זו (${sessionWinners.length})`}
            icon={<Trophy size={15} />}
            open={winnersOpen}
            onToggle={() => setWinnersOpen((v) => !v)}
          >
            <button
              onClick={onReset}
              disabled={resetting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCcw size={15} /> {resetting ? 'מאפס…' : 'אפס הגרלה (התחל מחדש)'}
            </button>
            {sessionWinners.length === 0 ? (
              <p className="text-xs text-white/40">עדיין לא הוגרלו זוכים.</p>
            ) : (
              <div className="space-y-2">
                {[...sessionWinners]
                  .sort((a, b) => b.rank - a.rank)
                  .map((w) => (
                    <div key={`${w.id}-${w.rank}`} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-black">
                        {w.rank}
                      </span>
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{fullName(w)}</div>
                      <span className="shrink-0 text-xs text-white/40">
                        {new Date(w.wonAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Accordion>

          {/* Local display tweaks — collapsed by default */}
          <Accordion
            title="תצוגה (מקומי)"
            icon={<Palette size={15} />}
            open={displayOpen}
            onToggle={() => setDisplayOpen((v) => !v)}
          >
            <ColorRow label="צבע טקסט" value={display.fontColor} onChange={(v) => patchDisplay({ fontColor: v })} />
            <ColorRow label="צבע זוכה" value={display.winnerColor} onChange={(v) => patchDisplay({ winnerColor: v })} />
            {display.backgroundType === 'color' && (
              <ColorRow label="צבע רקע" value={display.backgroundColor} onChange={(v) => patchDisplay({ backgroundColor: v })} />
            )}
            <label className="flex cursor-pointer items-center justify-between pt-1">
              <span className="flex items-center gap-2 text-sm">
                <Volume2 size={15} className="text-white/50" /> צלילים
              </span>
              <button
                type="button"
                onClick={() => patchDisplay({ soundsEnabled: !display.soundsEnabled })}
                className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
                  display.soundsEnabled ? 'border-amber-400 bg-amber-400 text-black' : 'border-white/25'
                }`}
              >
                {display.soundsEnabled && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            </label>
            <button
              onClick={() => setDisplay(config)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10"
            >
              <Eye size={13} /> חזרה להגדרות השמורות
            </button>
          </Accordion>
        </div>
      </aside>
    </main>
  );
}

function Accordion({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-3 text-sm font-semibold text-white/75"
      >
        <span className="flex items-center gap-2">
          <span className="text-amber-400">{icon}</span>
          {title}
        </span>
        <ChevronDown size={18} className={`text-white/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
      />
    </label>
  );
}
