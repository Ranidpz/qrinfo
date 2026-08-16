'use client';

import { useCallback, useState } from 'react';
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

export default function RaffleDemoPage() {
  const [participants, setParticipants] = useState<RaffleParticipant[]>(() =>
    generateDemoParticipants(1000)
  );
  const [winners, setWinners] = useState<RaffleWinner[]>([]);
  const [config, setConfig] = useState<RaffleConfig>(DEFAULT_RAFFLE_CONFIG);
  const [isDemoData, setIsDemoData] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  // Demo data follows the list type, so switching to a code raffle previews
  // against real codes instead of names.
  const demoDataFor = useCallback(
    (listType: RaffleConfig['listType']) =>
      listType === 'codes' ? generateDemoCodes(3000) : generateDemoParticipants(1000),
    []
  );

  const onConfigChange = useCallback(
    (patch: Partial<RaffleConfig>) => {
      const nextType = patch.listType;
      if (nextType && nextType !== (config.listType ?? 'people') && isDemoData) {
        setParticipants(demoDataFor(nextType));
        setWinners([]);
      }
      setConfig((c) => ({ ...c, ...patch }));
    },
    [config.listType, isDemoData, demoDataFor]
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
  }, [demoDataFor, config.listType]);

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
    setParticipants(demoDataFor(DEFAULT_RAFFLE_CONFIG.listType));
    setWinners([]);
    setConfig(DEFAULT_RAFFLE_CONFIG);
    setIsDemoData(true);
  }, [demoDataFor]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <RaffleStage
        participants={participants}
        config={config}
        onRequestDraw={onRequestDraw}
        canShowPhones
      />

      <button
        onClick={() => setPanelOpen(true)}
        aria-label="הגדרות"
        className="fixed left-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
      >
        <Menu size={22} />
      </button>

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
    </main>
  );
}
