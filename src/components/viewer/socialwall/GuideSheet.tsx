'use client';

// "How it works" card, shown once right after joining (over the feed, under the join confetti).
// The prizes line appears only when the organizer turned it on (config.guide.prizes) — never
// promise a prize the event doesn't give.

import { Camera, Heart, Share2, Trophy, X } from 'lucide-react';
import type { SocialWallStrings } from './i18n';
import { PrimaryButton } from './ui';

export default function GuideSheet({ t, prizes, onClose }: { t: SocialWallStrings; prizes: boolean; onClose: () => void }) {
  const rows = [
    { icon: Camera, color: '#7c3aed', title: t.guidePickTitle, text: t.guidePickText },
    { icon: Heart, color: '#ef4444', title: t.guideLikeTitle, text: t.guideLikeText },
    { icon: Share2, color: '#2563eb', title: t.guideShareTitle, text: t.guideShareText },
    ...(prizes ? [{ icon: Trophy, color: '#f59e0b', title: t.guidePrizeTitle, text: t.guidePrizeText }] : []),
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label={t.guideTitle}>
      <div className="absolute inset-0 bg-black/45 sw-fade" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[28px] bg-white shadow-2xl overflow-hidden sw-scale-in">
        <div className="relative px-6 pt-7 pb-6 text-white text-center" style={{ background: 'linear-gradient(135deg, var(--sw-primary), var(--sw-secondary))' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="absolute top-3 end-3 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 active:bg-white/25"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-[44px] leading-none sw-pop-in" aria-hidden>🎉</div>
          <h2 className="mt-3 text-[24px] font-black leading-tight">{t.guideTitle}</h2>
        </div>
        <ul className="px-5 pt-5 space-y-3.5">
          {rows.map(({ icon: Icon, color, title, text }, i) => (
            <li key={title} className="flex items-start gap-3 sw-enter" style={{ animationDelay: `${120 + i * 70}ms` }}>
              <span className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${color}1a`, color }}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-bold text-[15px] text-gray-900">{title}</span>
                <span className="block text-[13.5px] leading-snug text-gray-500">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mx-5 mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-[13.5px] leading-snug text-gray-700 sw-enter" style={{ animationDelay: `${120 + rows.length * 70}ms` }}>
          {t.guideTogether}
        </p>
        <div className="p-5">
          <PrimaryButton onClick={onClose}>{t.guideStart}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
