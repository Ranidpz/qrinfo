'use client';

import { useCallback, useState } from 'react';
import { Menu } from 'lucide-react';
import RaffleDisplay from '@/components/raffle/RaffleDisplay';
import RaffleSettingsPanel from '@/components/raffle/RaffleSettingsPanel';
import {
  DEFAULT_RAFFLE_CONFIG,
  type RaffleConfig,
  type RaffleParticipant,
  type RaffleWinner,
} from '@/lib/raffle/types';
import { generateDemoParticipants } from '@/lib/raffle/demo';

export default function RaffleDemoPage() {
  const [participants, setParticipants] = useState<RaffleParticipant[]>(() =>
    generateDemoParticipants(1000)
  );
  const [winners, setWinners] = useState<RaffleWinner[]>([]);
  const [config, setConfig] = useState<RaffleConfig>(DEFAULT_RAFFLE_CONFIG);
  const [isDemoData, setIsDemoData] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  const onConfigChange = useCallback((patch: Partial<RaffleConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

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
    setParticipants(generateDemoParticipants(1000));
    setWinners([]);
    setIsDemoData(true);
  }, []);

  const onImport = useCallback((list: RaffleParticipant[]) => {
    setParticipants(list);
    setWinners([]);
    setIsDemoData(false);
  }, []);

  const onResetWinners = useCallback(() => {
    setWinners([]);
    // restore remaining for all rows
    setParticipants((prev) => prev.map((p) => ({ ...p, remaining: p.quantity })));
  }, []);

  const onResetAll = useCallback(() => {
    setParticipants(generateDemoParticipants(1000));
    setWinners([]);
    setConfig(DEFAULT_RAFFLE_CONFIG);
    setIsDemoData(true);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      <RaffleDisplay
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
      />
    </main>
  );
}
