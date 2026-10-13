'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, UserCog, UserMinus, X } from 'lucide-react';
import {
  bookletErrorKey,
  fetchBookletEditors,
  grantBookletEditor,
  revokeBookletEditor,
  type BookletEditor,
} from '@/lib/booklets/client';

interface BookletEditorsModalProps {
  isOpen: boolean;
  codeId: string;
  title?: string;
  onClose: () => void;
}

/** Super admin: grant / revoke PDF-update access to one booklet. Ownership never changes. */
export default function BookletEditorsModal({ isOpen, codeId, title, onClose }: BookletEditorsModalProps) {
  const t = useTranslations('booklets');
  const locale = useLocale();
  const [editors, setEditors] = useState<BookletEditor[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEditors(await fetchBookletEditors(codeId));
    } catch (err) {
      setEditors([]);
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    }
  }, [codeId, t]);

  useEffect(() => {
    if (!isOpen) return;
    setEditors(null);
    setError(null);
    setEmail('');
    load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await grantBookletEditor(codeId, email.trim());
      setEmail('');
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (editor: BookletEditor) => {
    if (!window.confirm(t('revokeConfirm', { email: editor.email }))) return;
    setBusy(true);
    setError(null);
    try {
      await revokeBookletEditor(codeId, editor.uid);
      await load();
    } catch (err) {
      setError(t(bookletErrorKey(err), { size: '4.4MB' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-md mx-4 shadow-xl">
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

        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary">{t('editorsHint')}</p>

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
            <button type="submit" disabled={busy || !email.trim()} className="btn bg-accent hover:bg-accent-hover text-white disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('grant')}
            </button>
          </form>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {editors === null ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
          ) : editors.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-4">{t('editorsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {editors.map((editor) => (
                <li key={editor.uid} className="flex items-center justify-between gap-3 p-3 bg-bg-secondary rounded-xl">
                  <div className="min-w-0">
                    {editor.name && <p className="text-sm font-medium text-text-primary truncate">{editor.name}</p>}
                    <p className="text-xs text-text-secondary truncate" dir="ltr">{editor.email}</p>
                    {editor.grantedAt && (
                      <p className="text-xs text-text-secondary">
                        {t('grantedAt', { date: new Date(editor.grantedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US') })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevoke(editor)}
                    disabled={busy}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0 disabled:opacity-60"
                    title={t('revoke')}
                    aria-label={t('revoke')}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
