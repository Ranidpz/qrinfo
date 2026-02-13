'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { QTagGuest, QTagStats } from '@/types/qtag';

function parseGuestDoc(docId: string, data: Record<string, unknown>): QTagGuest {
  return {
    id: docId,
    codeId: data.codeId as string,
    name: data.name as string,
    phone: data.phone as string,
    plusOneCount: (data.plusOneCount as number) || 0,
    plusOneDetails: (data.plusOneDetails as QTagGuest['plusOneDetails']) || [],
    qrToken: data.qrToken as string,
    isVerified: (data.isVerified as boolean) || false,
    verifiedAt: data.verifiedAt instanceof Timestamp ? data.verifiedAt.toDate() : undefined,
    status: (data.status as QTagGuest['status']) || 'registered',
    arrivedAt: data.arrivedAt instanceof Timestamp ? data.arrivedAt.toDate() : undefined,
    arrivedMarkedBy: data.arrivedMarkedBy as string | undefined,
    qrSentViaWhatsApp: (data.qrSentViaWhatsApp as boolean) || false,
    qrSentAt: data.qrSentAt instanceof Timestamp ? data.qrSentAt.toDate() : undefined,
    registeredAt: data.registeredAt instanceof Timestamp ? data.registeredAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
    registeredByAdmin: (data.registeredByAdmin as boolean) || false,
  };
}

function computeStats(guests: QTagGuest[]): QTagStats {
  let totalRegistered = 0;
  let totalGuests = 0;
  let totalArrived = 0;
  let totalArrivedGuests = 0;

  for (const g of guests) {
    if (g.status !== 'cancelled') {
      totalRegistered++;
      totalGuests += 1 + g.plusOneCount;
    }
    if (g.status === 'arrived') {
      totalArrived++;
      totalArrivedGuests += 1 + g.plusOneCount;
    }
  }

  return { totalRegistered, totalGuests, totalArrived, totalArrivedGuests };
}

export function useQTagGuests(codeId: string | null, enabled = true) {
  const [guests, setGuests] = useState<QTagGuest[]>([]);
  const [stats, setStats] = useState<QTagStats>({
    totalRegistered: 0, totalGuests: 0, totalArrived: 0, totalArrivedGuests: 0,
  });
  const [loading, setLoading] = useState(true);
  const guestsMapRef = useRef<Map<string, QTagGuest>>(new Map());

  useEffect(() => {
    if (!enabled || !db || !codeId) {
      setGuests([]);
      setStats({ totalRegistered: 0, totalGuests: 0, totalArrived: 0, totalArrivedGuests: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    guestsMapRef.current.clear();

    const guestsRef = collection(db, 'codes', codeId, 'qtagGuests');
    const unsubscribe = onSnapshot(guestsRef, (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0 && guestsMapRef.current.size > 0) return;

      for (const change of changes) {
        if (change.type === 'removed') {
          guestsMapRef.current.delete(change.doc.id);
        } else {
          // 'added' or 'modified'
          guestsMapRef.current.set(
            change.doc.id,
            parseGuestDoc(change.doc.id, change.doc.data())
          );
        }
      }

      const sorted = Array.from(guestsMapRef.current.values())
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());

      setGuests(sorted);
      setStats(computeStats(sorted));
      setLoading(false);
    });

    return () => {
      unsubscribe();
      guestsMapRef.current.clear();
    };
  }, [enabled, codeId]);

  return { guests, stats, loading };
}
