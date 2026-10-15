'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Maximize2 } from 'lucide-react';

const SRC = '/play/social-wall';

// The real participant app (on in-memory demo data) inside a phone frame. The iframe loads on the
// first tap, so the page stays light and the demo's timed "new posts" start when someone looks.
export default function SocialWallPreview({ labels }: { labels: { label: string; start: string; fullscreen: string } }) {
  const [live, setLive] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <div className="relative aspect-[9/18] w-full max-w-[360px] overflow-hidden rounded-[2.4rem] border-[6px] border-[#1a1f2e] bg-black shadow-2xl">
        {live ? (
          <iframe src={SRC} title={labels.label} allow="clipboard-write; web-share" className="absolute inset-0 h-full w-full border-0 bg-white" />
        ) : (
          <button type="button" onClick={() => setLive(true)} className="group absolute inset-0 flex items-end justify-center pb-10" aria-label={labels.start}>
            <Image src="/play/social-wall/p8.webp" alt="" fill sizes="360px" className="object-cover opacity-70 transition-opacity group-hover:opacity-80" />
            <span className="relative inline-flex min-h-12 items-center rounded-xl bg-accent px-7 text-base font-semibold text-white shadow-lg transition-transform group-active:scale-95">
              {labels.start}
            </span>
          </button>
        )}
      </div>
      <a href={SRC} target="_blank" rel="noopener" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:underline">
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
        {labels.fullscreen}
      </a>
    </div>
  );
}
