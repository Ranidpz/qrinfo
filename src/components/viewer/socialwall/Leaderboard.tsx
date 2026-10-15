'use client';

// "Production team" cheer posts the feed slips between real posts, one after another in the order
// the organizer set (config.cheers, editable in the settings modal): a verified-looking account, a
// square slowly-moving gradient and one big punchy line. Lines may carry live values ({hot},
// {photos}… — CHEER_PLACEHOLDERS); those values are highlighted, and a line whose value doesn't
// exist yet (no likes yet, one department only) is skipped until it does.
// Module scope on purpose (stable identity → no remount, the entrance plays once).

import { BadgeCheck, Megaphone } from 'lucide-react';
import type { SocialWallGroup } from '@/types/socialwall';
import type { SocialWallStrings } from './i18n';

export interface GroupStat {
  id: string;
  posts: number;
  likes: number;
}

export interface EventTotals {
  posts: number;
  likes: number;
}

export type CheerSegment = { text: string; hl: boolean };

const GRADIENTS = [
  'linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f59e0b 100%)',
  'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #ec4899 100%)',
  'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #be185d 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #10b981 55%, #84cc16 100%)',
  'linear-gradient(135deg, #db2777 0%, #9333ea 55%, #2563eb 100%)',
];

/** Live values for the placeholders; a missing key = that line can't be shown yet. */
export function cheerValues(
  stats: GroupStat[],
  totals: EventTotals | null,
  groups: Map<string, SocialWallGroup>,
  locale: 'he' | 'en'
): Record<string, string> {
  const fmt = (n: number) => n.toLocaleString(locale);
  const v: Record<string, string> = {};
  if (totals && totals.posts > 0) v['{photos}'] = fmt(totals.posts);
  if (totals && totals.likes > 0) v['{likes}'] = fmt(totals.likes);
  const rows = stats.filter((s) => groups.has(s.id));
  const label = (id: string) => groups.get(id)!.label;
  const byLikes = rows.filter((r) => r.likes > 0).sort((a, b) => b.likes - a.likes || b.posts - a.posts);
  const byPosts = rows.filter((r) => r.posts > 0).sort((a, b) => b.posts - a.posts || b.likes - a.likes);
  if (byLikes[0]) {
    v['{hot}'] = label(byLikes[0].id);
    v['{hotLikes}'] = fmt(byLikes[0].likes);
  }
  if (byLikes[1]) {
    v['{second}'] = label(byLikes[1].id);
    v['{gap}'] = fmt(byLikes[0].likes - byLikes[1].likes);
  }
  if (byPosts[0]) {
    v['{active}'] = label(byPosts[0].id);
    v['{activePhotos}'] = fmt(byPosts[0].posts);
  }
  return v;
}

/** The line as segments (values highlighted), or null when a placeholder has no value yet. */
export function resolveCheer(text: string, values: Record<string, string>): CheerSegment[] | null {
  const parts = text.split(/(\{[a-zA-Z]+\})/g).filter(Boolean);
  const out: CheerSegment[] = [];
  for (const part of parts) {
    if (/^\{[a-zA-Z]+\}$/.test(part)) {
      const value = values[part];
      if (value === undefined) return null;
      out.push({ text: value, hl: true });
    } else {
      out.push({ text: part, hl: false });
    }
  }
  return out;
}

// A leading emoji goes big on its own line above the text
const LEADING_EMOJI = /^\s*((?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:️|‍(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*)\s*/u;

function fontFor(length: number) {
  if (length <= 16) return 'clamp(46px, 14.5vw, 74px)';
  if (length <= 30) return 'clamp(38px, 11.8vw, 60px)';
  if (length <= 46) return 'clamp(32px, 9.8vw, 50px)';
  return 'clamp(27px, 8.2vw, 42px)';
}

export function CheerPost({
  slot, segments, author, t,
}: {
  slot: number;
  segments: CheerSegment[];
  author: string;
  t: SocialWallStrings;
}) {
  const segs = segments.map((s) => ({ ...s }));
  let emoji = '';
  if (segs[0] && !segs[0].hl) {
    const m = segs[0].text.match(LEADING_EMOJI);
    if (m) {
      emoji = m[1];
      segs[0].text = segs[0].text.slice(m[0].length);
    }
  }
  const length = Array.from(segs.map((s) => s.text).join('')).length;
  const gradient = GRADIENTS[slot % GRADIENTS.length];

  return (
    <article className="bg-white sw-enter" aria-label={author}>
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow" style={{ background: gradient }}>
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-bold text-[15px] text-gray-900">
            {author}
            <BadgeCheck className="w-4 h-4 text-white fill-[#3b82f6]" aria-label="verified" />
          </div>
          <div className="text-[12.5px] text-gray-500">{t.justNow}</div>
        </div>
      </header>
      <div className="relative w-full aspect-square overflow-hidden text-white sw-gradient" style={{ backgroundImage: gradient }}>
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.28),transparent_55%)]" aria-hidden />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-7">
          {emoji && <span className="text-[68px] leading-none drop-shadow-lg sw-pop-in">{emoji}</span>}
          <p
            className="mt-4 font-black leading-[1.08] tracking-tight drop-shadow-[0_4px_18px_rgba(0,0,0,.25)] break-words max-w-full"
            style={{ fontSize: fontFor(length) }}
          >
            {segs.map((s, i) =>
              s.hl ? (
                <span key={i} className="text-[#fde047]">{s.text}</span>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
