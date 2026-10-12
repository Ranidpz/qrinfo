'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { QTagGuest, QTagStats } from '@/types/qtag';
import { computeQTagStats } from '@/hooks/useQTagGuests';

const POLL_MS = 4000;

interface ScannerGuestRow extends Omit<QTagGuest, 'qrToken' | 'arrivedAt' | 'registeredAt' | 'verifiedAt' | 'qrSentAt' | 'updatedAt'> {
  arrivedAt: number | null;
  registeredAt: number | null;
}

/**
 * Guest list for the door scanner, polled from /api/qtag/scanner-guests (owner token or
 * scanner PIN). The guests subcollection is no longer readable by clients — it holds phones.
 * `fetchList` performs the authorized POST; `refresh()` re-polls right after an action.
 */
export function useQTagScannerGuests(
  enabled: boolean,
  fetchList: () => Promise<Response>
) {
  const [guests, setGuests] = useState<QTagGuest[]>([]);
  const [stats, setStats] = useState<QTagStats>({
    totalRegistered: 0, totalGuests: 0, totalArrived: 0, totalArrivedGuests: 0,
  });
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetchList);
  fetchRef.current = fetchList;
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetchRef.current();
      if (!res.ok) return;
      const data = (await res.json()) as { guests: ScannerGuestRow[] };
      const parsed: QTagGuest[] = data.guests
        .map((g) => ({
          ...g,
          qrToken: '',
          arrivedAt: g.arrivedAt ? new Date(g.arrivedAt) : undefined,
          registeredAt: g.registeredAt ? new Date(g.registeredAt) : new Date(0),
        }) as QTagGuest)
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setGuests(parsed);
      setStats(computeQTagStats(parsed));
      setLoading(false);
    } catch (err) {
      console.error('[QTag] Failed to load guests:', err);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(() => {
      // Don't poll from a hidden tab; catch up the moment it is visible again.
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { guests, stats, loading, refresh };
}
