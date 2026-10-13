'use client';

// Q.Vote XP + packs on the voter's screen. The numbers always come from the server
// (/api/qvote/vote returns the XP it just awarded, /api/qvote/xp the full status,
// /api/qvote/pack/open the prize) — the browser never computes or claims XP itself.
// Reuses the shared gamification UI: XPPopup for "+N XP", PackOpeningModal for the reveal.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, Star, X } from 'lucide-react';
import { RARITY_CONFIG, type PackOpening, type PrizeRarity } from '@/types';
import { XPPopupContainer, useXPPopup } from '@/components/gamification/XPPopup';
import PackOpeningModal from '@/components/gamification/PackOpeningModal';

interface XpOpening {
  id: string;
  prizeId: string;
  prizeName: string;
  prizeNameEn: string;
  prizeRarity: PrizeRarity;
  openedAt: string | null;
}

interface XpStatus {
  xp: number;
  packsAvailable: number;
  progress: { current: number; needed: number; percent: number };
  openings: XpOpening[];
  prizesLeft: number;
  xpPerVote: number;
  threshold: number;
  voterCode: string;
}

export interface VoteXpReward {
  earned: number;
  xp: number;
  packsAvailable: number;
}

const translations = {
  he: {
    yourPoints: 'הנקודות שלכם',
    // \u2066…\u2069 isolate "50 XP" so it doesn't flip inside the RTL sentence
    howItWorks: 'כל הצבעה = \u2066{xp} XP\u2069 · כל \u2066{threshold} XP\u2069 = חבילת פרס',
    toNextPack: 'עוד \u2066{n} XP\u2069 לחבילה הבאה',
    openPack: 'פתחו חבילה',
    packsWaiting: '{n} חבילות מחכות לכם',
    noPrizesNow: 'אין כרגע פרסים זמינים — החבילות יחכו לכם כאן',
    yourPrizes: 'הפרסים שלכם',
    showStaff: 'הציגו את המסך הזה לצוות כדי לקבל את הפרס',
    yourCode: 'הקוד שלכם',
    packReason: 'צברתם מספיק נקודות!',
    noPacksError: 'אין חבילות לפתיחה',
    noPrizesError: 'הפרסים אזלו',
    genericError: 'משהו השתבש, נסו שוב',
    close: 'סגירה',
  },
  en: {
    yourPoints: 'Your points',
    howItWorks: 'Every vote = {xp} XP · every {threshold} XP = a prize pack',
    toNextPack: '{n} XP to your next pack',
    openPack: 'Open a pack',
    packsWaiting: '{n} packs waiting for you',
    noPrizesNow: 'No prizes available right now — your packs will wait here',
    yourPrizes: 'Your prizes',
    showStaff: 'Show this screen to the staff to collect your prize',
    yourCode: 'Your code',
    packReason: 'You earned enough points!',
    noPacksError: 'No packs to open',
    noPrizesError: 'Prizes ran out',
    genericError: 'Something went wrong, please try again',
    close: 'Close',
  },
};

export function useQVoteXp({ codeId, voterId, enabled }: { codeId: string; voterId: string; enabled: boolean }) {
  const [status, setStatus] = useState<XpStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const { popups, showPopup, removePopup } = useXPPopup();
  const voterRef = useRef(voterId);
  voterRef.current = voterId;

  const refresh = useCallback(async () => {
    if (!enabled || !voterId) return;
    try {
      const res = await fetch('/api/qvote/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, voterId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Tablet mode swaps the voter id between voters — drop a late answer for the previous one.
      if (voterRef.current !== voterId) return;
      setStatus(data.enabled ? (data as XpStatus) : null);
    } catch {
      // Network blip — the chip just stays as it was.
    }
  }, [codeId, voterId, enabled]);

  // New voter (first load or tablet reset): start from the server's view of them.
  useEffect(() => {
    setStatus(null);
    setSheetOpen(false);
    setPackOpen(false);
    refresh();
  }, [refresh]);

  /** Called with the `xp` block the vote API returned. */
  const onVoteReward = useCallback((reward: VoteXpReward | undefined) => {
    if (!enabled || !reward || reward.earned <= 0) return;
    showPopup(reward.earned);
    setStatus((prev) => (prev ? { ...prev, xp: reward.xp, packsAvailable: reward.packsAvailable } : prev));
    setSheetOpen(true);
    refresh();
  }, [enabled, refresh, showPopup]);

  const openPack = useCallback(async (locale: 'he' | 'en'): Promise<PackOpening> => {
    const t = translations[locale];
    const res = await fetch('/api/qvote/pack/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, voterId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.opening) {
      if (data.errorCode === 'NO_PACKS') throw new Error(t.noPacksError);
      if (data.errorCode === 'NO_PRIZES') throw new Error(t.noPrizesError);
      throw new Error(t.genericError);
    }
    const o = data.opening as XpOpening;
    return {
      id: o.id,
      visitorId: voterId,
      visitorNickname: '',
      routeId: codeId,
      prizeId: o.prizeId,
      prizeName: o.prizeName,
      prizeNameEn: o.prizeNameEn,
      prizeRarity: o.prizeRarity,
      openedAt: new Date(),
      redeemed: false,
    };
  }, [codeId, voterId]);

  return {
    enabled,
    status,
    sheetOpen,
    setSheetOpen,
    packOpen,
    setPackOpen,
    popups,
    removePopup,
    refresh,
    onVoteReward,
    openPack,
    /** True while the voter is looking at points/prizes — tablet mode holds its reset. */
    busy: sheetOpen || packOpen,
  };
}

export type QVoteXpState = ReturnType<typeof useQVoteXp>;

/** Small header chip: XP total + a pulsing gift when a pack is waiting. */
export function QVoteXpChip({ xp, locale }: { xp: QVoteXpState; locale: 'he' | 'en' }) {
  const s = xp.status;
  if (!xp.enabled || !s || (s.xp <= 0 && s.openings.length === 0)) return null;
  const canOpen = s.packsAvailable > 0 && s.prizesLeft > 0;
  return (
    <button
      type="button"
      onClick={() => xp.setSheetOpen(true)}
      className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 transition text-white text-sm font-semibold"
      aria-label={translations[locale].yourPoints}
    >
      <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
      <span dir="ltr">{s.xp}</span>
      {canOpen && (
        <span className="relative flex items-center">
          <Gift className="w-4 h-4 text-pink-300" />
          <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-pink-400 animate-ping" />
        </span>
      )}
    </button>
  );
}

/** Popups + bottom sheet + pack reveal. Render once at the viewer root. */
export function QVoteXpLayer({ xp, locale }: { xp: QVoteXpState; locale: 'he' | 'en' }) {
  const t = translations[locale];
  const s = xp.status;
  const isRTL = locale === 'he';

  return (
    <>
      {/* Own stacking context so the "+N XP" burst shows above the sheet */}
      <div className="relative z-[70]">
        <XPPopupContainer popups={xp.popups} onRemove={xp.removePopup} locale={locale} />
      </div>

      {xp.enabled && s && xp.sheetOpen && !xp.packOpen && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60" onClick={() => xp.setSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl p-5 pb-8 space-y-5 text-white animate-in slide-in-from-bottom-8 duration-300"
            style={{ backgroundColor: '#1b1b2b', borderTop: '1px solid rgba(255,255,255,0.1)' }}
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{t.yourPoints}</h3>
              <button
                type="button"
                onClick={() => xp.setSheetOpen(false)}
                className="w-11 h-11 -me-2 flex items-center justify-center rounded-full hover:bg-white/10"
                aria-label={t.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-4xl font-black">
                <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
                <span dir="ltr">{s.xp} XP</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-pink-500 transition-all duration-700"
                  style={{ width: `${s.progress.percent}%` }}
                />
              </div>
              <p className="text-sm text-white/70">
                {t.toNextPack.replace('{n}', String(s.progress.needed - s.progress.current))}
              </p>
              <p className="text-xs text-white/45">
                {t.howItWorks.replace('{xp}', String(s.xpPerVote)).replace('{threshold}', String(s.threshold))}
              </p>
            </div>

            {s.packsAvailable > 0 && (
              s.prizesLeft > 0 ? (
                <button
                  type="button"
                  onClick={() => xp.setPackOpen(true)}
                  className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-500 shadow-lg shadow-purple-500/30 active:scale-[0.98] transition"
                >
                  <Gift className="w-6 h-6" />
                  {t.openPack}
                  {s.packsAvailable > 1 && (
                    <span className="ms-1 px-2 py-0.5 rounded-full bg-white/20 text-sm" dir="ltr">×{s.packsAvailable}</span>
                  )}
                </button>
              ) : (
                <p className="text-center text-sm text-white/70">
                  {t.packsWaiting.replace('{n}', String(s.packsAvailable))}. {t.noPrizesNow}
                </p>
              )
            )}

            {s.openings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white/80">{t.yourPrizes}</h4>
                <ul className="space-y-2">
                  {s.openings.map((o) => {
                    const r = RARITY_CONFIG[o.prizeRarity] || RARITY_CONFIG.common;
                    return (
                      <li
                        key={o.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: `${r.color}22`, border: `1px solid ${r.color}66` }}
                      >
                        <span className="text-2xl">{r.emoji}</span>
                        <span className="flex-1 font-semibold">{locale === 'en' ? o.prizeNameEn || o.prizeName : o.prizeName}</span>
                        <span className="text-xs" style={{ color: r.color }}>{isRTL ? r.name : r.nameEn}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-white/60 text-center pt-1">
                  {t.showStaff}
                </p>
                <p className="text-center text-sm">
                  {t.yourCode}: <span dir="ltr" className="font-mono font-bold tracking-widest">{s.voterCode}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {xp.enabled && xp.packOpen && (
        <PackOpeningModal
          isOpen
          openPack={() => xp.openPack(locale)}
          reasonLabel={t.packReason}
          onClose={() => {
            xp.setPackOpen(false);
            xp.refresh();
          }}
          onOpened={() => xp.refresh()}
          locale={locale}
        />
      )}
    </>
  );
}
