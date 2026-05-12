'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Zap, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { APP_VERSION, getLatestUpdate, hasNewVersion, type VersionUpdate } from '@/lib/version';

const LAST_SEEN_VERSION_KEY = 'qr_last_seen_version';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

type Mode = 'hidden' | 'changelog' | 'refresh';

export default function UpdateNotification() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverUpdate, setServerUpdate] = useState<VersionUpdate | null>(null);
  const locale = useLocale() as 'he' | 'en';
  const t = useTranslations('update');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkServerVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data: { version: string; latestUpdate: VersionUpdate } = await res.json();
      if (!data.version) return;

      if (data.version !== APP_VERSION) {
        setServerUpdate(data.latestUpdate);
        setMode('refresh');
      } else {
        setServerUpdate((prev) => {
          if (!prev) return prev;
          setMode((m) => (m === 'refresh' ? 'hidden' : m));
          return null;
        });
      }
    } catch {
      // Network error — silent. Will retry on next poll.
    }
  }, []);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

    if (lastSeenVersion === null) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    } else if (hasNewVersion(lastSeenVersion)) {
      setMode('changelog');
    }

    checkServerVersion();

    pollTimerRef.current = setInterval(checkServerVersion, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkServerVersion();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkServerVersion]);

  const handleDismissChangelog = () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    setIsOpen(false);
    setMode('hidden');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (serverUpdate) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, serverUpdate.version);
    }
    window.location.reload();
  };

  const handleClosePopover = () => {
    setIsOpen(false);
  };

  if (mode === 'hidden') return null;

  const isRefreshMode = mode === 'refresh';
  const update = isRefreshMode && serverUpdate ? serverUpdate : getLatestUpdate();
  const highlights = update.highlights[locale];
  const badgeVersion = isRefreshMode ? update.version : APP_VERSION;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 md:left-auto md:right-4 z-50 flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
          aria-label={t('buttonLabel')}
        >
          <Zap className="w-4 h-4" />
          <span>{isRefreshMode ? t('buttonLabel') : t('whatsNew')}</span>
          <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
            {badgeVersion}
          </span>
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={handleClosePopover}
          />
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 transition-all duration-300 translate-y-0 opacity-100">
            <div className="bg-bg-card border border-border rounded-xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary text-lg">
                        {t('versionLabel')} {update.version}
                      </span>
                      <span className="bg-success text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        {t('newLabel')}
                      </span>
                    </div>
                    <span className="text-text-secondary text-sm">{update.date}</span>
                  </div>
                </div>
                <button
                  onClick={handleClosePopover}
                  className="text-text-secondary hover:text-text-primary transition-colors p-2 hover:bg-bg-hover rounded-lg"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isRefreshMode && (
                <p className="text-text-secondary text-sm mb-4">
                  {t('updateAvailableSubtitle')}
                </p>
              )}

              <ul className="space-y-3 mb-6">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    <span className="text-text-primary text-base leading-relaxed">
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>

              {isRefreshMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleClosePopover}
                    className="flex-1 btn btn-secondary py-3 text-base"
                    disabled={isRefreshing}
                  >
                    {t('later')}
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-[2] btn btn-primary py-3 text-base flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? t('refreshing') : t('refreshNow')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDismissChangelog}
                  className="w-full btn btn-primary py-3 text-base"
                >
                  {t('gotIt')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
