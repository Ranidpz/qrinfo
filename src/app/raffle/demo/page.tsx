'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import RaffleStage from '@/components/raffle/RaffleStage';
import RaffleSettingsPanel from '@/components/raffle/RaffleSettingsPanel';
import RaffleParticipantsTable from '@/components/raffle/RaffleParticipantsTable';
import {
  DEFAULT_RAFFLE_CONFIG,
  type RaffleConfig,
  type RaffleParticipant,
  type RaffleWinner,
} from '@/lib/raffle/types';
import { generateDemoParticipants, generateDemoCodes } from '@/lib/raffle/demo';

type Fields = { firstName: string; lastName: string; phone: string; quantity: number };

// Module scope so the participants state initializer can call it before the
// component's own callbacks exist.
function demoDataFor(listType: RaffleConfig['listType']): RaffleParticipant[] {
  return listType === 'codes' ? generateDemoCodes(3000) : generateDemoParticipants(1000);
}

// A code list only reads right with the character-by-character reveal, and a
// name list with the wheel. Pairing them keeps the demo from opening on the
// animation the viewer did not come to see.
function styleFor(listType: RaffleConfig['listType']): RaffleConfig['animationStyle'] {
  return listType === 'codes' ? 'codeReveal' : 'wheel';
}

export default function RaffleDemoPage() {
  return (
    <Suspense fallback={<main className="h-screen w-screen bg-black" />}>
      <RaffleDemo />
    </Suspense>
  );
}

function RaffleDemo() {
  // A link handed to a client should land on exactly what was pitched, so the
  // demo opens straight into a given list type and animation:
  //   ?list=codes|people   ?style=code|wheel   ?panel=off
  const search = useSearchParams();
  const initial = useMemo<{ config: RaffleConfig; panelHidden: boolean }>(() => {
    const listParam = (search.get('list') || '').toLowerCase();
    const styleParam = (search.get('style') || '').toLowerCase();

    const listType: RaffleConfig['listType'] =
      listParam === 'codes' ? 'codes' : listParam === 'people' ? 'people' : DEFAULT_RAFFLE_CONFIG.listType;

    const animationStyle: RaffleConfig['animationStyle'] =
      styleParam === 'code' || styleParam === 'codereveal'
        ? 'codeReveal'
        : styleParam === 'wheel'
          ? 'wheel'
          : listParam
            ? styleFor(listType)
            : DEFAULT_RAFFLE_CONFIG.animationStyle;

    return {
      config: { ...DEFAULT_RAFFLE_CONFIG, listType, animationStyle },
      panelHidden: (search.get('panel') || '').toLowerCase() === 'off',
    };
  }, [search]);

  const [participants, setParticipants] = useState<RaffleParticipant[]>(() =>
    demoDataFor(initial.config.listType)
  );
  const [winners, setWinners] = useState<RaffleWinner[]>([]);
  const [config, setConfig] = useState<RaffleConfig>(initial.config);
  const [isDemoData, setIsDemoData] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  const onConfigChange = useCallback(
    (patch: Partial<RaffleConfig>) => {
      const nextType = patch.listType;
      const switching = !!nextType && nextType !== (config.listType ?? 'people');
      if (switching && isDemoData) {
        setParticipants(demoDataFor(nextType));
        setWinners([]);
      }
      setConfig((c) => {
        const next = { ...c, ...patch };
        // Follow the list type, unless this same change picked a style itself.
        if (switching && patch.animationStyle === undefined) {
          next.animationStyle = styleFor(nextType);
        }
        return next;
      });
    },
    [config.listType, isDemoData]
  );

  // Demo draw: pick a random eligible participant, decrement quantity, record
  // the winner. In Phase 2 this becomes an atomic server call to Supabase.
  const onRequestDraw = useCallback((): RaffleWinner | null => {
    const pool = participants.filter((p) => p.remaining > 0);
    if (pool.length === 0) return null;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === pick.id
          ? { ...p, remaining: config.allowRepeat ? p.remaining - 1 : 0 }
          : p
      )
    );

    const winner: RaffleWinner = {
      id: pick.id,
      firstName: pick.firstName,
      lastName: pick.lastName,
      phone: pick.phone,
      rank: winners.length + 1,
      wonAt: Date.now(),
    };
    setWinners((prev) => [...prev, winner]);
    return winner;
  }, [participants, config.allowRepeat, winners.length]);

  const onLoadDemo = useCallback(() => {
    setParticipants(demoDataFor(config.listType));
    setWinners([]);
    setIsDemoData(true);
  }, [config.listType]);

  const onImport = useCallback((list: RaffleParticipant[], mode: 'replace' | 'merge' = 'replace') => {
    setParticipants((prev) => {
      if (mode === 'replace') return list;
      const byId = new Map(prev.map((p) => [p.id, p]));
      list.forEach((p) => byId.set(p.id, p));
      return [...byId.values()];
    });
    setWinners([]);
    setIsDemoData(false);
  }, []);

  const onResetWinners = useCallback(() => {
    setWinners([]);
    // restore remaining for all rows
    setParticipants((prev) => prev.map((p) => ({ ...p, remaining: p.quantity })));
  }, []);

  // Local stand-ins for the editor's server-backed list management, so the demo
  // previews the real management UI too.
  const onUpdateRow = useCallback((id: string, f: Fields) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...f, remaining: f.quantity } : p))
    );
  }, []);
  const onDeleteRow = useCallback((id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const onDeleteRows = useCallback((ids: string[]) => {
    const kill = new Set(ids);
    setParticipants((prev) => prev.filter((p) => !kill.has(p.id)));
  }, []);
  const onDeleteAllRows = useCallback(() => {
    setParticipants([]);
    setWinners([]);
  }, []);
  const onAddRow = useCallback((f: Fields) => {
    setParticipants((prev) => [
      { id: f.phone || f.firstName || `row-${prev.length}`, ...f, remaining: f.quantity },
      ...prev,
    ]);
    setIsDemoData(false);
  }, []);

  const onResetAll = useCallback(() => {
    // Reset to what the link promised, not to the global default — a demo
    // opened as a code raffle should stay a code raffle after a reset.
    setParticipants(demoDataFor(initial.config.listType));
    setWinners([]);
    setConfig(initial.config);
    setIsDemoData(true);
  }, [initial.config]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <RaffleStage
        participants={participants}
        config={config}
        onRequestDraw={onRequestDraw}
        canShowPhones
        nextRank={winners.length + 1}
      />

      {/* ?panel=off hands out a bare screen — no settings, no participant
          manager — for links that go to a client rather than an operator. */}
      {!initial.panelHidden && (
        <button
          onClick={() => setPanelOpen(true)}
          aria-label="הגדרות"
          className="fixed left-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <Menu size={22} />
        </button>
      )}

      {!initial.panelHidden && (
      <RaffleSettingsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        config={config}
        onConfigChange={onConfigChange}
        participantCount={participants.length}
        isDemoData={isDemoData}
        winners={winners}
        onLoadDemo={onLoadDemo}
        onImport={onImport}
        onResetWinners={onResetWinners}
        onResetAll={onResetAll}
        participantsManager={
          <RaffleParticipantsTable
            participants={participants}
            listType={config.listType ?? 'people'}
            onUpdate={onUpdateRow}
            onDelete={onDeleteRow}
            onAdd={onAddRow}
            onDeleteMany={onDeleteRows}
            onDeleteAll={onDeleteAllRows}
          />
        }
      />
      )}
    </main>
  );
}
