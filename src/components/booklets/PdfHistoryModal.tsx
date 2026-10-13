'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { History, Loader2, RotateCcw, UserMinus, UserPlus, X, FileText } from 'lucide-react';
import {
  bookletErrorKey,
  fetchPdfHistory,
  restorePdfVersion,
  type PdfHistoryEntry,
  type PdfActorVia,
} from '@/lib/booklets/client';

interface PdfHistoryModalProps {
  isOpen: boolean;
  codeId: string;
  title?: string;
  onClose: () => void;
  /** Called with the restored media item so the caller can update its local state. */
  onRestored?: (media: Record<string, unknown>) => void;
}

const VIA_KEY: Record<PdfActorVia, string> = {
  owner: 'viaOwner',
  collaborator: 'viaCollaborator',
  super_admin: 'viaSuperAdmin',
  editor: 'viaEditor',
  intake: 'viaIntake',
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function ActionIcon({ action }: { action: PdfHistoryEntry['action'] }) {
  if (action === 'grant') return <UserPlus className="w-4 h-4" />;
  if (action === 'revoke') return <UserMinus className="w-4 h-4" />;
  if (action === 'restore') return <RotateCcw className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

export default function PdfHistoryModal({ isOpen, codeId, title, onClose, onRestored }: PdfHistoryModalProps) {
  const t = useTranslations('booklets');
  const locale = useLocale();
  const [entries, setEntries] = useState<PdfHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await fetchPdfHistory(codeId));
    } catch (err) {
      setEntries([]);
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  }, [codeId, t]);

  useEffect(() => {
    if (!isOpen) return;
    setEntries(null);
    setNotice(null);
    load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const handleRestore = async (entry: PdfHistoryEntry) => {
    if (!window.confirm(t('restoreConfirm'))) return;
    setRestoringId(entry.id);
    setError(null);
    try {
      const media = await restorePdfVersion(codeId, entry.id);
      onRestored?.(media);
      setNotice(t('restored'));
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';

  const actionLabel = (entry: PdfHistoryEntry) => ({
    replace: t('actionReplace'),
    restore: t('actionRestore'),
    grant: t('actionGrant'),
    revoke: t('actionRevoke'),
  }[entry.action]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary">{t('historyTitle')}</h2>
              {title && <p className="text-sm text-text-secondary truncate">{title}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <p className="text-xs text-text-secondary">{t('historyNote')}</p>
          {notice && <p className="text-sm text-green-500">{notice}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {entries === null ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">{t('historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => {
                const actorName = entry.actor?.name || entry.actor?.email || '';
                return (
                  <li key={entry.id} className="p-3 bg-bg-secondary rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-accent flex-shrink-0"><ActionIcon action={entry.action} /></span>
                        <span className="text-sm font-medium text-text-primary">{actionLabel(entry)}</span>
                      </div>
                      <span className="text-xs text-text-secondary flex-shrink-0">{formatDate(entry.at)}</span>
                    </div>

                    <div className="text-xs text-text-secondary">
                      {entry.actor && <span>{t(VIA_KEY[entry.actor.via] || 'viaOwner')}</span>}
                      {actorName && entry.actor?.via !== 'intake' && (
                        <span> · <bdi>{actorName}</bdi></span>
                      )}
                      {entry.target && (
                        <span> · <bdi>{t('forUser', { name: entry.target.name || entry.target.email || '' })}</bdi></span>
                      )}
                    </div>

                    {entry.next && (
                      <div className="text-xs">
                        <span className="text-text-secondary">{t('newFile')}: </span>
                        <bdi className="text-text-primary">{entry.next.filename}</bdi>
                        <span className="text-text-secondary"> · {formatSize(entry.next.size)}</span>
                        {entry.next.pageCount ? <span className="text-text-secondary"> · {t('pages', { count: entry.next.pageCount })}</span> : null}
                      </div>
                    )}
                    {entry.previous && (
                      <div className="text-xs">
                        <span className="text-text-secondary">{t('previousFile')}: </span>
                        <bdi className="text-text-primary">{entry.previous.filename}</bdi>
                        <span className="text-text-secondary"> · {entry.previous.retained ? t('previousKept') : entry.previous.restored ? t('previousRestored') : t('previousGone')}</span>
                      </div>
                    )}

                    {entry.canRestore && (
                      <button
                        onClick={() => handleRestore(entry)}
                        disabled={restoringId !== null}
                        className="btn bg-amber-500 hover:bg-amber-600 text-white text-sm py-1.5 px-3 inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {restoringId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        {t('restore')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
