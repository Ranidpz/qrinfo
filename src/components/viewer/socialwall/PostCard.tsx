'use client';

import { memo, useRef, useState } from 'react';
import { Heart, MoreHorizontal, Clock3, RotateCw, Trash2, X } from 'lucide-react';
import type { SocialWallGroup, SocialWallPostView } from '@/types/socialwall';
import type { SocialWallStrings } from './i18n';
import { Avatar, ConfettiBurst, timeAgo } from './ui';

export interface LocalUpload {
  id: string; // = the postId sent to the server
  previewUrl: string;
  caption: string;
  width: number;
  height: number;
  progress: number;
  state: 'uploading' | 'failed';
  error?: string;
  createdAt: number;
}

const DOUBLE_TAP_MS = 280;

function ratioOf(width: number, height: number) {
  if (!width || !height) return '4 / 5';
  // Instagram keeps very tall photos at 4:5 and very wide ones at 1.91:1
  const r = Math.min(1.91, Math.max(0.8, width / height));
  return `${r}`;
}

interface Props {
  post: SocialWallPostView;
  group?: SocialWallGroup;
  t: SocialWallStrings;
  locale: 'he' | 'en';
  onLike: (post: SocialWallPostView, on: boolean) => void;
  onOpen: (post: SocialWallPostView) => void;
  onDelete?: (post: SocialWallPostView) => void;
  index: number;
  /** One-time "double-tap to like" hint on the first post */
  hint?: boolean;
  onHintDone?: () => void;
}

function PostCardImpl({ post, group, t, locale, onLike, onOpen, onDelete, index, hint, onHintDone }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(0);
  const [menu, setMenu] = useState(false);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const like = (on: boolean) => {
    if (on) setPop((n) => n + 1);
    if (on && hint) onHintDone?.();
    onLike(post, on);
  };

  const onImageTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      setBurst((n) => n + 1);
      if (hint) onHintDone?.();
      if (!post.likedByMe) like(true);
      return;
    }
    lastTap.current = now;
    singleTapTimer.current = setTimeout(() => onOpen(post), DOUBLE_TAP_MS + 20);
  };

  return (
    <article className="bg-white sw-enter" style={{ animationDelay: `${Math.min(index, 4) * 60}ms` }}>
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={post.authorName} color={group?.color} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] text-gray-900 truncate">{post.authorName}</div>
          <div className="text-[12.5px] text-gray-500 truncate">
            {group ? `${group.label} · ` : ''}
            {timeAgo(post.createdAt, locale, t.justNow)}
          </div>
        </div>
        {post.mine && onDelete && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="w-10 h-10 -me-2 flex items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
              aria-label={t.deletePost}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {menu && (
              <div className="absolute end-0 top-11 z-10 w-44 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden sw-scale-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onDelete(post);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-600 font-semibold text-[15px] active:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.deletePost}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div
        className="relative w-full bg-gray-100 overflow-hidden select-none"
        style={{ aspectRatio: ratioOf(post.width, post.height) }}
        onClick={onImageTap}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.cardUrl}
          alt={post.caption || post.authorName}
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          className="sw-img absolute inset-0 w-full h-full object-cover"
          style={{ opacity: loaded ? 1 : 0 }}
        />
        {!loaded && <div className="absolute inset-0 sw-skeleton" />}
        {burst > 0 && (
          <div key={burst} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="w-28 h-28 text-white fill-white drop-shadow-[0_4px_24px_rgba(0,0,0,.35)] sw-heart" />
            <ConfettiBurst count={30} spread={150} />
          </div>
        )}
        {hint && !burst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none sw-fade">
            <div className="flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-4 py-2.5 text-white text-sm font-bold shadow-xl">
              <Heart className="w-5 h-5 fill-[#ef4444] text-[#ef4444] sw-hint-heart" />
              {t.doubleTapHint}
            </div>
          </div>
        )}
        {post.status === 'pending' && (
          <div className="absolute top-3 start-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-white text-xs font-semibold">
            <Clock3 className="w-3.5 h-3.5" />
            {t.waitingApproval}
          </div>
        )}
      </div>

      <div className="px-4 pt-2.5 pb-4">
        <div className="flex items-center gap-1 -ms-2">
          <button
            type="button"
            onClick={() => like(!post.likedByMe)}
            disabled={post.status === 'pending'}
            className="relative w-11 h-11 flex items-center justify-center rounded-full active:bg-gray-100 disabled:opacity-40"
            aria-label={t.like}
            aria-pressed={!!post.likedByMe}
          >
            <Heart
              key={pop}
              className={`w-7 h-7 transition-colors ${post.likedByMe ? 'text-[#ef4444] fill-[#ef4444]' : 'text-gray-900'} ${pop ? 'sw-pop' : ''}`}
            />
            {pop > 0 && post.likedByMe && <ConfettiBurst key={`b${pop}`} count={16} spread={70} />}
          </button>
          <span className="text-[15px] font-bold text-gray-900 tabular-nums">{post.likeCount.toLocaleString(locale)}</span>
        </div>
        {post.caption && (
          <p className="mt-1 text-[15px] leading-snug text-gray-900 whitespace-pre-line break-words">
            <span className="font-bold">{post.authorName}</span> {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}

export const PostCard = memo(PostCardImpl);

/** The phone's own upload while it travels (or after it failed), shown at the top of the feed. */
export function UploadCard({
  upload, name, color, t, onRetry, onDiscard,
}: {
  upload: LocalUpload; name: string; color?: string; t: SocialWallStrings; onRetry: () => void; onDiscard: () => void;
}) {
  const failed = upload.state === 'failed';
  return (
    <article className="bg-white sw-enter">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={name} color={color} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] text-gray-900 truncate">{name}</div>
          <div className={`text-[12.5px] ${failed ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {failed ? upload.error || t.uploadFailed : t.publishing}
          </div>
        </div>
      </header>
      <div className="relative w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: ratioOf(upload.width, upload.height) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={upload.previewUrl} alt="" className={`absolute inset-0 w-full h-full object-cover ${failed ? 'opacity-50 grayscale' : 'opacity-80'}`} />
        {!failed && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
            <div
              className="h-full sw-progress-stripes transition-[width] duration-300"
              style={{ width: `${Math.max(6, upload.progress * 100)}%`, background: 'linear-gradient(90deg, var(--sw-primary), var(--sw-secondary))' }}
            />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <button type="button" onClick={onRetry} className="flex items-center gap-2 rounded-full bg-white px-5 h-11 font-bold text-gray-900 shadow-lg active:scale-95 transition-transform">
              <RotateCw className="w-4 h-4" />
              {t.retry}
            </button>
            <button type="button" onClick={onDiscard} aria-label={t.discard} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg active:scale-95 transition-transform">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      {upload.caption && (
        <p className="px-4 py-3 text-[15px] text-gray-900 whitespace-pre-line break-words">
          <span className="font-bold">{name}</span> {upload.caption}
        </p>
      )}
    </article>
  );
}
