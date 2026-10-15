'use client';

// "Department race" card the feed slips between posts: hottest department (likes) up top, then
// the top departments with bars, and the most active one (photos). Tapping a row filters the
// feed to that department. Module scope (stable identity → the bars animate once, not per render).

import { Flame, Camera, Heart, Trophy } from 'lucide-react';
import type { SocialWallGroup } from '@/types/socialwall';
import type { SocialWallStrings } from './i18n';

export interface GroupStat {
  id: string;
  posts: number;
  likes: number;
}

export function Leaderboard({
  stats, groups, t, locale, onPick,
}: {
  stats: GroupStat[];
  groups: Map<string, SocialWallGroup>;
  t: SocialWallStrings;
  locale: 'he' | 'en';
  onPick: (groupId: string) => void;
}) {
  const rows = stats
    .filter((s) => groups.has(s.id) && (s.posts > 0 || s.likes > 0))
    .sort((a, b) => b.likes - a.likes || b.posts - a.posts);
  if (!rows.length) return null;
  const top = rows[0];
  const max = Math.max(1, top.likes);
  const active = [...rows].sort((a, b) => b.posts - a.posts)[0];
  const label = (id: string) => groups.get(id)?.label || '';
  const fmt = (n: number) => n.toLocaleString(locale);

  return (
    <section
      className="mx-3 my-1 rounded-3xl p-5 text-white shadow-lg sw-enter overflow-hidden relative"
      style={{ background: 'linear-gradient(140deg, var(--sw-primary), var(--sw-secondary))' }}
      aria-label={t.deptRace}
    >
      <Trophy className="absolute -top-3 -end-3 w-28 h-28 text-white/10" aria-hidden />
      <div className="text-xs font-bold uppercase tracking-wide text-white/75">{t.deptRace}</div>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/90">
        <Flame className="w-4 h-4 text-amber-300" />
        {t.hottestDept}
      </div>
      <button type="button" onClick={() => onPick(top.id)} className="mt-1 flex items-end gap-3 text-start">
        <span className="text-3xl font-black leading-none">{label(top.id)}</span>
        <span className="flex items-center gap-1 text-lg font-bold text-white/90 tabular-nums">
          <Heart className="w-4 h-4 fill-white" />
          {fmt(top.likes)}
        </span>
      </button>

      <div className="mt-4 space-y-2">
        {rows.slice(0, 5).map((r, i) => (
          <button key={r.id} type="button" onClick={() => onPick(r.id)} className="w-full text-start">
            <div className="flex items-center justify-between text-[13px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-5 text-white/60 tabular-nums">{i + 1}</span>
                {label(r.id)}
              </span>
              <span className="flex items-center gap-1 tabular-nums text-white/85">
                <Heart className="w-3 h-3 fill-white/85" />
                {fmt(r.likes)}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white sw-bar"
                style={{ width: `${Math.max(4, (r.likes / max) * 100)}%`, animationDelay: `${i * 90}ms` }}
              />
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-[13px] font-semibold">
          <Camera className="w-4 h-4" />
          {t.mostActiveDept}: {label(active.id)} · {active.posts === 1 ? t.onePhoto : `${fmt(active.posts)} ${t.photosShort}`}
        </div>
      )}
    </section>
  );
}
