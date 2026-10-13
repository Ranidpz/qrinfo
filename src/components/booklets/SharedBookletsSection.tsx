'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, CheckCircle2, ExternalLink, FileText, History, Loader2, RefreshCw, X } from 'lucide-react';
import PdfHistoryModal from './PdfHistoryModal';
import {
  bookletErrorKey,
  fetchEditableBooklets,
  isPdfFile,
  MAX_BOOKLET_UPLOAD_BYTES,
  uploadBookletPdf,
  type EditableBooklet,
} from '@/lib/booklets/client';

type Pdf = EditableBooklet['pdfs'][number];

interface PendingReplace {
  booklet: EditableBooklet;
  pdf: Pdf;
  file: File;
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Dashboard section for booklet editors: booklets a super admin let this user update.
 * Renders nothing when the user has no grants. Replace / history / restore go through the
 * server routes, which re-check the grant on every request.
 */
export default function SharedBookletsSection() {
  const t = useTranslations('booklets');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [booklets, setBooklets] = useState<EditableBooklet[]>([]);
  const [pending, setPending] = useState<PendingReplace | null>(null);
  const [progress, setProgress] = useState<{ pdfId: string; percent: number } | null>(null);
  const [status, setStatus] = useState<{ pdfId: string; ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<EditableBooklet | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const reload = useCallback(() => fetchEditableBooklets().then(setBooklets).catch((err) => {
    console.error('Failed to load editable booklets:', err);
  }), []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (booklets.length === 0) return null;

  const pickFile = (booklet: EditableBooklet, pdf: Pdf, file: File | undefined) => {
    setStatus(null);
    if (!file) return;
    if (!isPdfFile(file)) {
      setStatus({ pdfId: pdf.id, ok: false, message: t('onlyPdf') });
      return;
    }
    if (file.size > MAX_BOOKLET_UPLOAD_BYTES) {
      setStatus({ pdfId: pdf.id, ok: false, message: t('tooLarge', { size: '4.4MB' }) });
      return;
    }
    setPending({ booklet, pdf, file });
  };

  const confirmReplace = async () => {
    if (!pending) return;
    const { booklet, pdf, file } = pending;
    setPending(null);
    setProgress({ pdfId: pdf.id, percent: 0 });
    try {
      await uploadBookletPdf(booklet.codeId, pdf.id, file, (percent) => setProgress({ pdfId: pdf.id, percent }));
      setStatus({ pdfId: pdf.id, ok: true, message: t('replaced') });
      await reload();
    } catch (err) {
      setStatus({ pdfId: pdf.id, ok: false, message: t(bookletErrorKey(err), { size: '4.4MB' }) });
    } finally {
      setProgress(null);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '';

  return (
    <section className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">{t('sharedTitle')}</h2>
          <p className="text-sm text-text-secondary">{t('sharedHint')}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {booklets.flatMap((booklet) => booklet.pdfs.map((pdf) => {
          const uploading = progress?.pdfId === pdf.id;
          const rowStatus = status?.pdfId === pdf.id ? status : null;
          return (
            <li key={`${booklet.codeId}-${pdf.id}`} className="p-3 bg-bg-secondary rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{booklet.title}</p>
                    <p className="text-xs text-text-secondary truncate">
                      <bdi>{pdf.filename}</bdi> · {formatSize(pdf.size)}
                      {pdf.pageCount ? <> · {t('pages', { count: pdf.pageCount })}</> : null}
                      {booklet.updatedAt ? <> · {t('updated', { date: formatDate(booklet.updatedAt) })}</> : null}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/v/${booklet.shortId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn bg-bg-card text-text-primary hover:bg-bg-hover text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t('view')}
                  </a>
                  <button
                    onClick={() => setHistory(booklet)}
                    className="btn bg-bg-card text-text-primary hover:bg-bg-hover text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <History className="w-4 h-4" />
                    {t('historyButton')}
                  </button>
                  <button
                    onClick={() => fileInputs.current[pdf.id]?.click()}
                    disabled={!!progress}
                    className="btn bg-accent hover:bg-accent-hover text-white text-sm py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {uploading ? t('uploading', { percent: progress?.percent ?? 0 }) : t('replacePdf')}
                  </button>
                  <input
                    ref={(el) => { fileInputs.current[pdf.id] = el; }}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      pickFile(booklet, pdf, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              {rowStatus && (
                <p className={rowStatus.ok ? 'text-sm text-green-500 flex items-center gap-1.5' : 'text-sm text-red-500'}>
                  {rowStatus.ok && <CheckCircle2 className="w-4 h-4" />}
                  {rowStatus.message}
                </p>
              )}
            </li>
          );
        }))}
      </ul>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPending(null)} />
          <div className="relative bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">{t('replaceConfirmTitle')}</h2>
              <button onClick={() => setPending(null)} className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            <p className="font-medium text-text-primary">{pending.booklet.title}</p>
            <div className="space-y-2">
              <div className="p-3 bg-bg-secondary rounded-xl">
                <p className="text-xs text-text-secondary">{t('currentFile')}</p>
                <p className="text-sm text-text-primary truncate" dir="ltr">{pending.pdf.filename}</p>
              </div>
              <div className="p-3 bg-bg-secondary rounded-xl">
                <p className="text-xs text-text-secondary">{t('newFile')}</p>
                <p className="text-sm text-text-primary truncate" dir="ltr">{pending.file.name}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">{t('replaceConfirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setPending(null)} className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover flex-1">
                {tCommon('cancel')}
              </button>
              <button onClick={confirmReplace} className="btn bg-amber-500 hover:bg-amber-600 text-white flex-1">
                {t('replaceButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      <PdfHistoryModal
        isOpen={!!history}
        codeId={history?.codeId || ''}
        title={history?.title}
        onClose={() => setHistory(null)}
        onRestored={() => { reload(); }}
      />
    </section>
  );
}
