'use client';

// Q.Vote gamification → the pack prize pool + who won what (owner only).
// Prize editing reuses PrizeManagementModal (same rarity / drop-rate / stock model as
// route prizes) through a store that talks to /api/qvote/prizes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Trophy, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { RARITY_CONFIG, type Prize, type PrizeRarity } from '@/types';
import PrizeManagementModal, { type PrizeStore } from './PrizeManagementModal';

interface Winner {
  id: string;
  prizeName: string;
  prizeNameEn: string;
  prizeRarity: PrizeRarity;
  openedAt: string | null;
  voterCode: string;
}

export default function QVotePrizesPanel({ codeId, isRTL }: { codeId?: string; isRTL: boolean }) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const load = useCallback(async () => {
    if (!codeId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/qvote/prizes?codeId=${encodeURIComponent(codeId)}`);
      if (res.ok) {
        const data = await res.json();
        setPrizes(data.prizes || []);
        setWinners(data.winners || []);
      }
    } catch (error) {
      console.error('[QVotePrizesPanel] load failed', error);
    } finally {
      setLoading(false);
    }
  }, [codeId]);

  useEffect(() => { load(); }, [load]);

  const store = useMemo<PrizeStore | undefined>(() => {
    if (!codeId) return undefined;
    const send = async (method: 'POST' | 'PUT' | 'DELETE', body: Record<string, unknown>) => {
      const res = await fetchWithAuth('/api/qvote/prizes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, ...body }),
      });
      if (!res.ok) throw new Error('Prize save failed');
    };
    return {
      list: async () => {
        const res = await fetchWithAuth(`/api/qvote/prizes?codeId=${encodeURIComponent(codeId)}`);
        if (!res.ok) throw new Error('Prize load failed');
        const data = await res.json();
        return data.prizes as Prize[];
      },
      create: (prize) => send('POST', { prize }),
      update: (prizeId, prize) => send('PUT', { prizeId, prize }),
      remove: (prizeId) => send('DELETE', { prizeId }),
    };
  }, [codeId]);

  if (!codeId) {
    return (
      <p className="text-xs text-text-secondary">
        {isRTL ? 'שמרו את ההצבעה פעם אחת, ואז תוכלו להוסיף פרסים לחבילות.' : 'Save the vote once, then you can add prizes to the packs.'}
      </p>
    );
  }

  const active = prizes.filter((p) => p.isActive);
  const left = active.reduce((sum, p) => sum + Math.max(0, p.totalAvailable - p.claimed), 0);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowManager(true)}
        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Gift className="w-4 h-4 text-purple-400" />
          {isRTL ? 'פרסים בחבילות' : 'Pack prizes'}
        </span>
        <span className="text-xs text-text-secondary">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : active.length === 0 ? (
            isRTL ? 'אין פרסים — הוסיפו' : 'No prizes — add some'
          ) : isRTL ? (
            `${active.length} פרסים · נותרו ${left}`
          ) : (
            `${active.length} prizes · ${left} left`
          )}
        </span>
      </button>

      {!loading && active.length === 0 && (
        <p className="text-xs text-amber-500">
          {isRTL
            ? 'בלי פרסים המצביעים יצברו נקודות, אבל החבילות לא ייפתחו עד שתוסיפו פרסים.'
            : 'Without prizes voters still earn points, but packs won’t open until you add prizes.'}
        </p>
      )}

      {winners.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Trophy className="w-4 h-4 text-yellow-500" />
            {isRTL ? `זוכים (${winners.length})` : `Winners (${winners.length})`}
          </div>
          <p className="text-xs text-text-secondary">
            {isRTL
              ? 'הזוכים מציגים לצוות את המסך עם הקוד שלהם — בדקו שהוא מופיע כאן.'
              : 'Winners show their screen with their code to the staff — check it appears here.'}
          </p>
          <ul className="max-h-56 overflow-y-auto divide-y divide-border rounded-lg border border-border">
            {winners.slice(0, 200).map((w) => {
              const r = RARITY_CONFIG[w.prizeRarity] || RARITY_CONFIG.common;
              return (
                <li key={w.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span>{r.emoji}</span>
                  <span className="flex-1 truncate text-text-primary">{isRTL ? w.prizeName : w.prizeNameEn || w.prizeName}</span>
                  <span dir="ltr" className="font-mono text-xs text-text-secondary">{w.voterCode}</span>
                  <span dir="ltr" className="text-xs text-text-secondary">
                    {w.openedAt ? new Date(w.openedAt).toLocaleTimeString(isRTL ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showManager && store && (
        <PrizeManagementModal
          routeId={codeId}
          store={store}
          isOpen={showManager}
          onClose={() => setShowManager(false)}
          onUpdate={load}
          emptyHint={isRTL ? 'הוסיפו את הפרס הראשון לחבילות' : 'Add the first prize for the packs'}
          locale={isRTL ? 'he' : 'en'}
        />
      )}
    </div>
  );
}
