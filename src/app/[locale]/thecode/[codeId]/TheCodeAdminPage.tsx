'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isApprovedStatus } from '@/lib/auth/approval';
import ApprovalGate from '@/components/auth/ApprovalGate';
import { getQRCode } from '@/lib/db';
import TheCodeLiveAdmin, { MessageScreen } from '@/components/thecode/adminLive/TheCodeLiveAdmin';
import { gameUrl, lobbyUrl } from '@/components/thecode/admin/helpers';
import type { AdminLinks } from '@/components/thecode/admin/model';

type CodeCheck =
  | { kind: 'loading' }
  | { kind: 'ok'; links: AdminLinks }
  | { kind: 'notFound' }
  | { kind: 'notTheCode' }
  | { kind: 'error' };

/**
 * The admin covers the app shell (it has its own header + tab rail and prints stickers), so it
 * renders into a fixed full-screen layer on <body>. While mounted, printing shows only that layer.
 */
export default function TheCodeAdminPage({ codeId }: { codeId: string }) {
  const t = useTranslations('thecode');
  const router = useRouter();
  const { user, loading } = useAuth();
  const [check, setCheck] = useState<CodeCheck>({ kind: 'loading' });
  const [host, setHost] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  // Guests sign in first and come straight back.
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(`/thecode/${codeId}`)}`);
  }, [loading, user, router, codeId]);

  // The code doc is world-readable: use it to say "not a הקוד code" before asking the API.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getQRCode(codeId)
      .then((code) => {
        if (!alive) return;
        if (!code) return setCheck({ kind: 'notFound' });
        if (!code.media.some((m) => m.type === 'thecode')) return setCheck({ kind: 'notTheCode' });
        setCheck({ kind: 'ok', links: { game: gameUrl(code.shortId), lobby: lobbyUrl(code.shortId) } });
      })
      .catch(() => alive && setCheck({ kind: 'error' }));
    return () => {
      alive = false;
    };
  }, [user, codeId]);

  // Full-screen layer on <body>; the page under it does not scroll.
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('data-thecode-admin', '');
    el.className = 'fixed inset-0 z-[60] overflow-y-auto bg-bg-primary';
    document.body.appendChild(el);
    scrollRef.current = el;
    setHost(el);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      el.remove();
      scrollRef.current = null;
    };
  }, []);

  const back = (
    <Link href={`/code/${codeId}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-medium text-accent hover:bg-accent/10">
      <ArrowRight size={16} aria-hidden /> {t('backToCode')}
    </Link>
  );

  let body: React.ReactNode;
  if (loading || !user || check.kind === 'loading') {
    body = (
      <div dir="rtl" className="flex min-h-dvh items-center justify-center gap-3 text-text-secondary">
        <Loader2 className="animate-spin" size={22} aria-hidden /> {t('loading')}
      </div>
    );
  } else if (!isApprovedStatus(user.status)) {
    body = (
      <div className="p-4 sm:p-6">
        <ApprovalGate user={user} />
      </div>
    );
  } else if (check.kind === 'notFound') {
    body = <MessageScreen title={t('notFoundTitle')} text={t('notFoundText')} action={<Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg px-4 font-medium text-accent hover:bg-accent/10">{t('toDashboard')}</Link>} />;
  } else if (check.kind === 'notTheCode') {
    body = <MessageScreen title={t('notTheCodeTitle')} text={t('notTheCodeText')} action={back} />;
  } else if (check.kind === 'error') {
    body = <MessageScreen title={t('errorTitle')} text={t('errorText')} onRetry={() => window.location.reload()} />;
  } else {
    body = (
      <TheCodeLiveAdmin
        codeId={codeId}
        links={check.links}
        scrollRef={scrollRef}
        errorAction={back}
        extraBadge={
          <Link href={`/code/${codeId}`} className="hidden min-h-8 items-center gap-1 rounded-full px-2.5 text-sm text-text-secondary hover:bg-bg-hover sm:inline-flex">
            <ArrowRight size={14} aria-hidden /> {t('backToCode')}
          </Link>
        }
      />
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body > *:not([data-thecode-admin]) { display: none !important; }
          [data-thecode-admin] { position: static !important; overflow: visible !important; }
          body { overflow: visible !important; }
        }
      `}</style>
      {host && createPortal(body, host)}
    </>
  );
}
