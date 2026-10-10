'use client';

import { useRef, useState } from 'react';
import { Maximize2, Play } from 'lucide-react';
import { tenboolDemoSrc, type DemoBoard as Board } from '@/lib/landing/site';

const BOARDS: Board[] = ['wins', 'counter', 'lives'];

// The live game in a contained frame. The iframe only loads on the first click, so the page
// itself stays light (good for load speed) and the game never grabs focus or keys uninvited.
export default function TenBoolDemo({
  labels,
}: {
  labels: { label: string; start: string; hint: string; fullscreen: string; modes: Record<Board, string> };
}) {
  const [board, setBoard] = useState<Board>('wins');
  const [live, setLive] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" aria-label={labels.label} className="flex gap-1 rounded-xl bg-bg-hover p-1 text-sm">
          {BOARDS.map((b) => (
            <button
              key={b}
              role="tab"
              aria-selected={board === b}
              onClick={() => setBoard(b)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                board === b ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {labels.modes[b]}
            </button>
          ))}
        </div>
        <a
          href={tenboolDemoSrc(board)}
          target="_blank"
          rel="noopener"
          title={labels.fullscreen}
          aria-label={labels.fullscreen}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Maximize2 className="h-5 w-5" />
        </a>
      </div>

      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10 sm:aspect-[16/10]">
        {live ? (
          <iframe
            ref={frameRef}
            key={board}
            src={tenboolDemoSrc(board)}
            title={labels.label}
            allow="autoplay; fullscreen"
            className="absolute inset-0 h-full w-full border-0"
            // so Enter / Space reach the game right away
            onLoad={() => frameRef.current?.contentWindow?.focus()}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLive(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-6 text-white"
            aria-label={labels.start}
          >
            <span
              dir="ltr"
              className="font-black leading-none tabular-nums text-[min(22vw,7.5rem)] transition-transform duration-300 group-hover:scale-105"
            >
              10.00
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform group-hover:scale-105 group-active:scale-95">
              <Play className="h-5 w-5 fill-current" />
              {labels.start}
            </span>
          </button>
        )}
      </div>
      <p className="mt-3 text-sm text-text-secondary">{labels.hint}</p>
    </div>
  );
}
