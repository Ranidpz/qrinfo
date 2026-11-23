'use client';

// קוד הגמדים — "install the game" (Rani 23.11.2026): before a group registers, offer to add the
// game to the home screen, so it plays full screen like an app without downloading anything.
// Installing BEFORE registering also avoids the iPhone trap: a home-screen web app does not see
// what Safari stored, so the group registers inside the installed app itself.
//
// Platforms: Android Chrome / Edge / Samsung fire `beforeinstallprompt` → one "התקינו" button.
// iPhone: no prompt exists; Safari (and Chrome / Edge on iOS 16.4+) add it from the share menu →
// short illustrated steps. Inside WhatsApp / Instagram (in-app browsers) nothing can be installed
// → "open in the browser" first. Desktop: no install step.

import { useCallback, useEffect, useState } from 'react';
import { isInAppBrowser } from '@/lib/inAppBrowser';

export type InstallPlatform = 'android' | 'ios-safari' | 'ios-other' | 'inapp' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (isInAppBrowser()) return 'inapp';
  // iPadOS reports itself as a Mac — touch points tell it apart.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Already running from the home screen (installed). */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true;
}

/** The browser's own install prompt (Android), kept from page load until the group taps "התקינו". */
let held: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    held = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    held = null;
    listeners.forEach((fn) => fn());
  });
}

export function useInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [standalone, setStandalone] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setPlatform(detectInstallPlatform());
    setStandalone(isStandaloneApp());
    const sync = () => setCanPrompt(!!held);
    sync();
    const onInstalled = () => setInstalled(true);
    listeners.add(sync);
    window.addEventListener('appinstalled', onInstalled);
    return () => { listeners.delete(sync); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  /** Shows the browser's own dialog. true = the group accepted. */
  const prompt = useCallback(async (): Promise<boolean> => {
    const p = held;
    if (!p) return false;
    held = null;
    setCanPrompt(false);
    try {
      await p.prompt();
      const choice = await p.userChoice;
      if (choice.outcome === 'accepted') { setInstalled(true); return true; }
    } catch { /* the dialog could not open */ }
    return false;
  }, []);
  return { platform, standalone, canPrompt, installed, prompt };
}
