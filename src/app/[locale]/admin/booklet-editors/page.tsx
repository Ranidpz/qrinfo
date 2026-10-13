'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, CheckCircle2, ExternalLink, Loader2, Search, X } from 'lucide-react';
import {
  bookletErrorKey,
  fetchAllBooklets,
  grantBookletEditorBulk,
  revokeBookletEditor,
  type AdminBooklet,
  type BookletEditor,
  type BulkGrantStatus,
} from '@/lib/booklets/client';

/**
 * Super admin: pick several booklets and give one email PDF-update access to all of them.
 * Also shows who can update each booklet and revokes per booklet. Ownership never changes.
 * (The admin layout already restricts this route to super admins; the API re-checks.)
 */
export default function BookletEditorsAdminPage() {
  const t = useTranslations('booklets');
  const [booklets, setBooklets] = useState<AdminBooklet[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchAllBooklets();
      list.sort((a, b) => a.title.localeCompare(b.title, 'he'));
      setBooklets(list);
    } catch (err) {
      setBooklets([]);
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!booklets) return [];
    if (!q) return booklets;
    return booklets.filter((b) =>
      [b.title, b.shortId, b.ownerEmail, b.ownerName, ...b.editors.map((e) => e.email)]
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [booklets, query]);

  const allVisibleSelected = visible.length > 0 && visible.every((b) => selected.has(b.codeId));

  const toggle = (codeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(codeId)) next.delete(codeId);
      else next.add(codeId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of visible) {
        if (allVisibleSelected) next.delete(b.codeId);
        else next.add(b.codeId);
      }
      return next;
    });
  };

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (selected.size === 0) {
      setError(t('bulkSelectFirst'));
      return;
    }
    if (!email.trim()) {
      setError(t('bulkEmailFirst'));
      return;
    }
    setBusy(true);
    try {
      const { results } = await grantBookletEditorBulk([...selected], email.trim());
      const count = (status: BulkGrantStatus) => results.filter((r) => r.status === status).length;
      const skipped = results.length - count('granted') - count('already');
      setSummary(t('bulkResult', { granted: count('granted'), already: count('already'), skipped }));
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (booklet: AdminBooklet, editor: BookletEditor) => {
    if (!window.confirm(t('revokeConfirm', { email: editor.email }))) return;
    setError(null);
    try {
      await revokeBookletEditor(booklet.codeId, editor.uid);
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{t('bulkTitle')}</h1>
          <p className="text-sm text-text-secondary">{t('bulkHint')}</p>
        </div>
      </div>

      {/* Grant bar — stays in view while scrolling the list */}
      <form
        onSubmit={handleGrant}
        className="sticky top-16 z-10 bg-bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center"
      >
        <span className="text-sm font-medium text-text-primary whitespace-nowrap">
          {t('bulkSelected', { count: selected.size })}
        </span>
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="input flex-1 min-w-0"
          disabled={busy}
        />
        <button type="submit" disabled={busy} className="btn bg-accent hover:bg-accent-hover text-white whitespace-nowrap disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('bulkGrant', { count: selected.size })}
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {summary && (
        <p className="text-sm text-green-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          {summary}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('bulkSearch')}
            className="input ps-10 w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer select-none">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="w-4 h-4 accent-accent" />
          {t('bulkSelectAll', { count: visible.length })}
        </label>
      </div>

      {booklets === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : visible.length === 0 ? (
        <p className="text-center py-12 text-text-secondary">{t('bulkEmpty')}</p>
      ) : (
        <ul className="bg-bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {visible.map((booklet) => (
            <li key={booklet.codeId} className="flex items-start gap-3 p-3 sm:p-4 hover:bg-bg-hover/40">
              <input
                type="checkbox"
                checked={selected.has(booklet.codeId)}
                onChange={() => toggle(booklet.codeId)}
                className="w-4 h-4 mt-1 accent-accent flex-shrink-0 cursor-pointer"
                aria-label={booklet.title}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button type="button" onClick={() => toggle(booklet.codeId)} className="font-medium text-text-primary truncate text-start">
                    {booklet.title}
                  </button>
                  <a
                    href={`/v/${booklet.shortId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-secondary hover:text-accent flex-shrink-0"
                    aria-label={t('view')}
                    title={t('view')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-xs text-text-secondary truncate">
                  {t('bulkOwner')}: <bdi>{booklet.ownerName || booklet.ownerEmail}</bdi>
                  {booklet.ownerName && booklet.ownerEmail ? <> · <span dir="ltr">{booklet.ownerEmail}</span></> : null}
                </p>
                {booklet.editors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {booklet.editors.map((editor) => (
                      <span key={editor.uid} className="inline-flex items-center gap-1 ps-2 pe-1 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs">
                        <span dir="ltr">{editor.email}</span>
                        <button
                          type="button"
                          onClick={() => handleRevoke(booklet, editor)}
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
