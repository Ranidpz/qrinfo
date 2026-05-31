'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import RaffleSettingsPanel from '@/components/raffle/RaffleSettingsPanel';
import RaffleParticipantsTable, { type ParticipantRow } from '@/components/raffle/RaffleParticipantsTable';
import {
  DEFAULT_RAFFLE_CONFIG,
  type RaffleConfig,
  type RaffleParticipant,
  type RaffleWinner,
} from '@/lib/raffle/types';

interface RaffleModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Persists the raffle config onto the code (creates the media on first save).
  // Returns the saved config (with the actual token) so the link stays in sync.
  onSave: (config: RaffleConfig) => void | RaffleConfig | Promise<void | RaffleConfig>;
  initialConfig?: RaffleConfig;
  codeId: string;
  shortId: string;
}

function genToken(): string {
  // crypto.randomUUID is available in modern browsers.
  return `tkn_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

export default function RaffleModal({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  codeId,
  shortId,
}: RaffleModalProps) {
  const [config, setConfig] = useState<RaffleConfig>(
    () => initialConfig || { ...DEFAULT_RAFFLE_CONFIG, token: genToken() }
  );
  // The token actually persisted to Firestore — the share link uses THIS so it
  // can never drift from what the public page validates against.
  const [savedToken, setSavedToken] = useState<string | undefined>(initialConfig?.token);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantsList, setParticipantsList] = useState<ParticipantRow[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [winners, setWinners] = useState<RaffleWinner[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);

  // Re-sync when opening for a different media item.
  useEffect(() => {
    if (isOpen) {
      setConfig(initialConfig || { ...DEFAULT_RAFFLE_CONFIG, token: genToken() });
      setSavedToken(initialConfig?.token);
      savedOnce.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const refreshParticipants = useCallback(async () => {
    setLoadingParticipants(true);
    try {
      const r = await fetchWithAuth(`/api/raffle/participants?codeId=${encodeURIComponent(codeId)}`);
      if (!r.ok) return;
      const data = await r.json();
      setParticipantCount(data.count || 0);
      setParticipantsList(
        (data.participants || []).map(
          (p: { id: string; firstName?: string; lastName?: string; phone?: string; quantity?: number }) => ({
            id: p.id,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            phone: p.phone || '',
            quantity: p.quantity || 1,
          })
        )
      );
    } catch {
      /* ignore */
    } finally {
      setLoadingParticipants(false);
    }
  }, [codeId]);

  const updateParticipant = useCallback(
    async (id: string, fields: { firstName: string; lastName: string; phone: string; quantity: number }) => {
      await fetchWithAuth('/api/raffle/participants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, participantId: id, ...fields }),
      });
      refreshParticipants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeId]
  );

  const deleteParticipant = useCallback(
    async (id: string) => {
      await fetchWithAuth(
        `/api/raffle/participants?codeId=${encodeURIComponent(codeId)}&participantId=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      refreshParticipants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeId]
  );

  const addParticipant = useCallback(
    async (fields: { firstName: string; lastName: string; phone: string; quantity: number }) => {
      await fetchWithAuth('/api/raffle/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, mode: 'merge', participants: [fields] }),
      });
      refreshParticipants();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeId]
  );

  const refreshWinners = useCallback(async () => {
    try {
      const r = await fetchWithAuth(`/api/raffle/winners?codeId=${encodeURIComponent(codeId)}`);
      if (!r.ok) return;
      const data = await r.json();
      setWinners(
        (data.winners || []).map(
          (w: { id: string; firstName: string; lastName: string; phone?: string; rank: number; wonAt?: number }) => ({
            id: w.id,
            firstName: w.firstName,
            lastName: w.lastName,
            phone: w.phone || '',
            rank: w.rank,
            wonAt: w.wonAt || Date.now(),
          })
        )
      );
    } catch {
      /* ignore */
    }
  }, [codeId]);

  // On open: ensure the media exists (persist token so the link works) + load data.
  useEffect(() => {
    if (!isOpen) return;
    if (!savedOnce.current) {
      savedOnce.current = true;
      void (async () => {
        const saved = await Promise.resolve(onSave(config));
        const tok = (saved && saved.token) || config.token;
        if (tok) {
          setSavedToken(tok);
          setConfig((c) => (c.token === tok ? c : { ...c, token: tok }));
        }
      })();
    }
    refreshParticipants();
    refreshWinners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Debounced config persistence.
  const persistSoon = useCallback(
    (next: RaffleConfig) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void Promise.resolve(onSave(next));
      }, 500);
    },
    [onSave]
  );

  const onConfigChange = useCallback(
    (patch: Partial<RaffleConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch, token: prev.token || genToken() };
        persistSoon(next);
        return next;
      });
    },
    [persistSoon]
  );

  // Upload bg image/video / custom sound to R2 (owner-only route).
  const uploadAsset = useCallback(
    async (file: File, kind: 'image' | 'video'): Promise<string> => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('codeId', codeId);
      fd.append('kind', kind);
      const r = await fetchWithAuth('/api/raffle/upload', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('upload failed');
      const data = await r.json();
      return data.url as string;
    },
    [codeId]
  );

  const onImport = useCallback(
    async (participants: RaffleParticipant[]) => {
      setLoadingParticipants(true);
      try {
        await fetchWithAuth('/api/raffle/participants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeId,
            mode: 'replace',
            participants: participants.map((p) => ({
              firstName: p.firstName,
              lastName: p.lastName,
              phone: p.phone,
              quantity: p.quantity,
            })),
          }),
        });
        // ALWAYS refresh from the server so the table reflects what was saved.
        await refreshParticipants();
      } catch {
        setLoadingParticipants(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeId]
  );

  const onResetWinners = useCallback(async () => {
    try {
      await fetchWithAuth(`/api/raffle/winners?codeId=${encodeURIComponent(codeId)}`, { method: 'DELETE' });
      setWinners([]);
    } catch {
      /* ignore */
    }
  }, [codeId]);

  const onResetAll = useCallback(async () => {
    try {
      await fetchWithAuth(`/api/raffle/participants?codeId=${encodeURIComponent(codeId)}`, { method: 'DELETE' });
      await fetchWithAuth(`/api/raffle/winners?codeId=${encodeURIComponent(codeId)}`, { method: 'DELETE' });
      setParticipantCount(0);
      setWinners([]);
    } catch {
      /* ignore */
    }
  }, [codeId]);

  const handleClose = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void Promise.resolve(onSave(config));
    onClose();
  }, [config, onSave, onClose]);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Use the CONFIRMED-saved token (falls back to the local one) so the link
  // always matches what the public page validates against.
  const linkToken = savedToken || config.token;
  const bigScreenUrl = linkToken ? `${origin}/raffle/${shortId}?token=${linkToken}` : undefined;

  return (
    <RaffleSettingsPanel
      open={isOpen}
      onClose={handleClose}
      config={config}
      onConfigChange={onConfigChange}
      participantCount={participantCount}
      isDemoData={false}
      winners={winners}
      onImport={onImport}
      onResetWinners={onResetWinners}
      onResetAll={onResetAll}
      uploadAsset={uploadAsset}
      hideDemo
      bigScreenUrl={bigScreenUrl}
      variant="modal"
      participantsManager={
        <RaffleParticipantsTable
          participants={participantsList}
          loading={loadingParticipants}
          onUpdate={updateParticipant}
          onDelete={deleteParticipant}
          onAdd={addParticipant}
        />
      }
    />
  );
}
