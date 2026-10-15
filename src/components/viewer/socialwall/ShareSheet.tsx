'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Share2, X } from 'lucide-react';
import type { SocialWallStrings } from './i18n';

// "Bring a friend": a big scan code of the event link, so a participant can hold up their phone
// and the person next to them scans it. The link is this page's own address (no query, no hash -
// the staff token rides the #fragment and must never end up in a code), which is /v/{shortId} on a
// real event and /play/social-wall in the demo.
export default function ShareSheet({ t, eventTitle, onClose, onCopied }: { t: SocialWallStrings; eventTitle: string; onClose: () => void; onCopied: () => void }) {
  const [url, setUrl] = useState('');
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(window.location.origin + window.location.pathname);
    setCanShare(typeof navigator.share === 'function');
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
    } catch {
      // clipboard blocked (old in-app browsers): the link is on screen to copy by hand
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: eventTitle, text: t.shareMessage, url });
    } catch {
      // cancelled
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t.shareTitle}>
      <div className="absolute inset-0 bg-black/50 sw-fade" onClick={onClose} />
      <div className="relative bg-white rounded-t-[28px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] sw-sheet">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.shareTitle}</h2>
          <button type="button" onClick={onClose} className="w-11 h-11 -me-2 flex items-center justify-center rounded-full active:bg-gray-100" aria-label={t.close}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <p className="text-sm text-gray-500">{t.shareText}</p>
        <div className="mt-5 flex justify-center">
          <div className="rounded-3xl border border-gray-100 p-4 shadow-sm">
            {url ? <QRCodeSVG value={url} size={220} level="M" marginSize={0} /> : <div className="w-[220px] h-[220px]" />}
          </div>
        </div>
        <p className="mt-3 text-center font-bold">{eventTitle}</p>
        <p dir="ltr" className="mt-1 text-center text-xs text-gray-400 break-all select-all">{url}</p>
        <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: canShare ? '1fr 1fr' : '1fr' }}>
          {canShare && (
            <button
              type="button"
              onClick={share}
              className="h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-white active:scale-[.98] transition-transform"
              style={{ background: 'var(--sw-primary)' }}
            >
              <Share2 className="w-5 h-5" />
              {t.shareSend}
            </button>
          )}
          <button type="button" onClick={copy} className="h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold bg-gray-100 text-gray-800 active:bg-gray-200">
            <Copy className="w-5 h-5" />
            {t.copyLink}
          </button>
        </div>
      </div>
    </div>
  );
}
