'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, UserCog, X } from 'lucide-react';
import {
  bookletErrorKey,
  fetchBookletEditors,
  grantBookletEditorBulk,
  revokeBookletEditor,
  type BookletEditor,
  type BulkGrantStatus,
} from '@/lib/booklets/client';

interface BulkBooklet {
  codeId: string;
  title: string;
}

interface BookletEditorsBulkModalProps {
  isOpen: boolean;
  /** Folder name shown under the title. */
  title?: string;
  booklets: BulkBooklet[];
  onClose: () => void;
}

/**
 * Super admin, from a folder: give one email PDF-update access to the folder's booklets
 * (all ticked by default), see who already has access, revoke per booklet.
 */
export default function BookletEditorsBulkModal({ isOpen, title, booklets, onClose }: BookletEditorsBulkModalProps) {
  const t = useTranslations('booklets');
  const [editors, setEditors] = useState<Record<string, BookletEditor[]> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const codeIdsKey = booklets.map((b) => b.codeId).join(',');

  const load = useCallback(async () => {
    const ids = codeIdsKey ? codeIdsKey.split(',') : [];
    try {
      const lists = await Promise.all(ids.map((id) => fetchBookletEditors(id)));
      setEditors(Object.fromEntries(ids.map((id, i) => [id, lists[i]])));
    } catch (err) {
      setEditors({});
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  }, [codeIdsKey, t]);

  useEffect(() => {
    if (!isOpen) return;
    setEditors(null);
    setError(null);
    setSummary(null);
    setEmail('');
    setSelected(new Set(codeIdsKey ? codeIdsKey.split(',') : []));
    load();
  }, [isOpen, codeIdsKey, load]);

  if (!isOpen) return null;

  const allSelected = booklets.length > 0 && booklets.every((b) => selected.has(b.codeId));

  const toggle = (codeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(codeId)) next.delete(codeId);
      else next.add(codeId);
      return next;
    });
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (selected.size === 0) return setError(t('bulkSelectFirst'));
    if (!email.trim()) return setError(t('bulkEmailFirst'));
    setBusy(true);
    try {
      const { results } = await grantBookletEditorBulk([...selected], email.trim());
      const count = (status: BulkGrantStatus) => results.filter((r) => r.status === status).length;
      const skipped = results.length - count('granted') - count('already');
      setSummary(t('bulkResult', { granted: count('granted'), already: count('already'), skipped }));
      setEmail('');
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (codeId: string, editor: BookletEditor) => {
    if (!window.confirm(t('revokeConfirm', { email: editor.email }))) return;
    setError(null);
    try {
      await revokeBookletEditor(codeId, editor.uid);
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
              <UserCog className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary">{t('editorsTitle')}</h2>
              {title && <p className="text-sm text-text-secondary truncate">{title}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-sm text-text-secondary">{t('bulkHint')}</p>

          <form onSubmit={handleGrant} className="flex gap-2">
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="input flex-1 min-w-0"
              disabled={busy}
            />
            <button type="submit" disabled={busy} className="btn bg-accent hover:bg-accent-hover text-white whitespace-nowrap disabled:opacity-60 inline-flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('bulkGrant', { count: selected.size })}
            </button>
          </form>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {summary && (
            <p className="text-sm text-green-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {summary}
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(booklets.map((b) => b.codeId)))}
              className="w-4 h-4 accent-accent"
            />
            {t('bulkSelectAll', { count: booklets.length })}
          </label>

          <ul className="border border-border rounded-xl divide-y divide-border">
            {booklets.map((booklet) => (
              <li key={booklet.codeId} className="p-3 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(booklet.codeId)}
                    onChange={() => toggle(booklet.codeId)}
                    className="w-4 h-4 accent-accent flex-shrink-0"
                  />
                  <span className="text-sm font-medium text-text-primary truncate">{booklet.title}</span>
                </label>
                {editors === null ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-text-secondary ms-6" />
                ) : (editors[booklet.codeId] || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ms-6">
                    {editors[booklet.codeId].map((editor) => (
                      <span key={editor.uid} className="inline-flex items-center gap-1 ps-2 pe-1 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs">
                        <span dir="ltr">{editor.email}</span>
                        <button
                          type="button"
                          onClick={() => handleRevoke(booklet.codeId, editor)}
                          className="p-0.5 rounded-full hover:bg-yellow-500/20"
                          aria-label={t('revoke')}
                          title={t('revoke')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
