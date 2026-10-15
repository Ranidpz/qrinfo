import Image from 'next/image';
import { Heart, Home, Plus, QrCode, User } from 'lucide-react';

// The hero's picture: a phone showing the feed, drawn in CSS around the demo's own photos (they are
// AI illustrations, so no "real event" photo here). The page's one motion moment: hearts float up
// from the like button (off under prefers-reduced-motion).

const HEARTS = [
  { x: '0px', delay: '0s', size: 18 },
  { x: '-14px', delay: '1.1s', size: 14 },
  { x: '10px', delay: '2.2s', size: 22 },
  { x: '-4px', delay: '3.1s', size: 16 },
];

export default function SocialWallHero({
  dir,
  labels,
}: {
  dir: 'rtl' | 'ltr';
  labels: { all: string; groups: string[]; author: string; group: string; caption: string; likes: string; alt: string };
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#3b1d2a,#0f1419_65%)]">
      <style>{`
        @keyframes sw-heart { 0% { transform: translate(0,0) scale(.6); opacity: 0 } 15% { opacity: 1 } 100% { transform: translate(var(--x), -150px) scale(1.1); opacity: 0 } }
        .sw-heart { animation: sw-heart 4.4s ease-out infinite; opacity: 0 }
        @media (prefers-reduced-motion: reduce) { .sw-heart { display: none } }
      `}</style>
      {/* a second photo peeking behind the phone */}
      <div aria-hidden="true" className="absolute hidden h-[46%] w-[34%] max-w-[240px] translate-x-[62%] translate-y-[18%] rotate-6 overflow-hidden rounded-2xl border-4 border-white/10 opacity-60 sm:block">
        <Image src="/play/social-wall/p3.webp" alt="" fill sizes="240px" className="object-cover" />
      </div>
      <div dir={dir} className="relative h-[88%] max-h-[600px] min-w-0 aspect-[9/19] -rotate-3 rounded-[2.6rem] border-[6px] border-white/15 bg-black p-1.5 shadow-2xl">
        <div className="flex h-full flex-col overflow-hidden rounded-[2.1rem] bg-white text-gray-900">
          <div className="flex h-11 shrink-0 items-center justify-center border-b border-gray-100">
            <Image src="/play/social-wall/your-logo.svg" alt="" width={84} height={22} />
          </div>
          <div className="flex shrink-0 gap-1.5 overflow-hidden px-3 py-2 text-[10px] font-semibold">
            <span className="rounded-full bg-gray-900 px-2.5 py-1 text-white">{labels.all}</span>
            {labels.groups.map((g) => (
              <span key={g} className="rounded-full bg-gray-100 px-2.5 py-1">
                {g}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{labels.author[0]}</span>
            <span className="text-[11px] font-bold">{labels.author}</span>
            <span className="text-[10px] text-gray-400">{labels.group}</span>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image src="/play/social-wall/p9.webp" alt={labels.alt} fill priority sizes="300px" className="object-cover" />
          </div>
          <div className="relative shrink-0 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="relative">
                <Heart className="h-5 w-5 fill-rose-500 text-rose-500" aria-hidden="true" />
                {HEARTS.map((h, i) => (
                  <Heart
                    key={i}
                    aria-hidden="true"
                    className="sw-heart absolute left-0 top-0 fill-rose-500 text-rose-500"
                    style={{ width: h.size, height: h.size, animationDelay: h.delay, ['--x' as string]: h.x }}
                  />
                ))}
              </span>
              <span dir="ltr" className="text-[11px] font-bold tabular-nums">
                {labels.likes}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px]">{labels.caption}</p>
          </div>
          <div className="grid h-12 shrink-0 grid-cols-4 items-center border-t border-gray-100 text-gray-500" aria-hidden="true">
            <Home className="mx-auto h-5 w-5 text-rose-500" />
            <QrCode className="mx-auto h-5 w-5" />
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500 text-white">
              <Plus className="h-5 w-5" />
            </span>
            <User className="mx-auto h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
