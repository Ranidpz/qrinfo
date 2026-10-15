'use client';

// Feed state for one member. Pages come newest-first with a cursor; live changes arrive as deltas
// ("everything that changed since serverTime") whenever the RTDB rev pulse ticks, every 20s while
// the tab is visible (like counts), and when the phone comes back to the tab. Likes are optimistic:
// a delta that lands while a like is in flight never flips the heart back.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialWallPostView } from '@/types/socialwall';
import { SwApiError, swApi } from './api';

const MIN_DELTA_GAP_MS = 2500;
const POLL_MS = 20_000;

const byNewest = (a: SocialWallPostView, b: SocialWallPostView) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1);

export function useFeed(params: {
  codeId: string;
  session: string | null;
  group: string | null;
  rev: number;
  onAuthError: (error: SwApiError) => void;
}) {
  const { codeId, session, group, rev, onAuthError } = params;
  const [posts, setPosts] = useState<SocialWallPostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serverTime = useRef<number | null>(null);
  const pendingLikes = useRef(new Map<string, boolean>());
  const deltaBusy = useRef(false);
  const lastDeltaAt = useRef(0);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0); // bumps on group change / reload so stale responses are dropped
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  const handleError = useCallback((e: unknown) => {
    if (e instanceof SwApiError && (e.status === 401 || e.status === 403)) {
      authRef.current(e);
      return;
    }
    setError(e instanceof SwApiError ? e.code : 'UNKNOWN');
  }, []);

  const keepLocalLike = (p: SocialWallPostView, prev?: SocialWallPostView): SocialWallPostView => {
    const desired = pendingLikes.current.get(p.id);
    if (desired === undefined || !prev) return p;
    return { ...p, likedByMe: desired, likeCount: prev.likeCount };
  };

  const loadFirst = useCallback(async () => {
    if (!session) return;
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const res = await swApi.feed(codeId, session, { group });
      if (gen !== generation.current) return;
      serverTime.current = res.serverTime;
      setPosts((res.posts as SocialWallPostView[]).slice().sort(byNewest));
      setNextCursor(res.nextCursor || null);
    } catch (e) {
      if (gen === generation.current) handleError(e);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [codeId, session, group, handleError]);

  const loadMore = useCallback(async () => {
    if (!session || !nextCursor || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const res = await swApi.feed(codeId, session, { group, cursor: nextCursor });
      if (gen !== generation.current) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...(res.posts as SocialWallPostView[]).filter((p) => !seen.has(p.id))].sort(byNewest);
      });
      setNextCursor(res.nextCursor || null);
    } catch (e) {
      handleError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [codeId, session, group, nextCursor, loadingMore, handleError]);

  const runDelta = useCallback(async () => {
    if (!session || serverTime.current === null || deltaBusy.current) return;
    deltaBusy.current = true;
    lastDeltaAt.current = Date.now();
    const gen = generation.current;
    try {
      const res = await swApi.feed(codeId, session, { since: serverTime.current });
      if (gen !== generation.current) return;
      if (res.truncated) {
        void loadFirst();
        return;
      }
      serverTime.current = res.serverTime;
      if (!res.posts.length) return;
      setPosts((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const item of res.posts) {
          if ('removed' in item && item.removed) {
            map.delete(item.id);
            continue;
          }
          const p = item as SocialWallPostView;
          const existing = map.get(p.id);
          if (existing) map.set(p.id, keepLocalLike(p, existing));
          else if (!group || p.groupId === group) map.set(p.id, p);
        }
        return [...map.values()].sort(byNewest);
      });
    } catch (e) {
      // A failed background refresh is silent unless the session is gone.
      if (e instanceof SwApiError && (e.status === 401 || e.status === 403)) authRef.current(e);
    } finally {
      deltaBusy.current = false;
    }
  }, [codeId, session, group, loadFirst]);

  /** Throttled: many pulses in a burst become one request. */
  const scheduleDelta = useCallback(() => {
    if (deltaTimer.current) return;
    const wait = Math.max(0, lastDeltaAt.current + MIN_DELTA_GAP_MS - Date.now());
    deltaTimer.current = setTimeout(() => {
      deltaTimer.current = null;
      void runDelta();
    }, wait);
  }, [runDelta]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  // RTDB pulse
  const firstRev = useRef(true);
  useEffect(() => {
    if (firstRev.current) {
      firstRev.current = false;
      return;
    }
    scheduleDelta();
  }, [rev, scheduleDelta]);

  // Background refresh (like counts) + catch-up when the phone returns to the tab
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') scheduleDelta();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
      if (deltaTimer.current) clearTimeout(deltaTimer.current);
      deltaTimer.current = null;
    };
  }, [scheduleDelta]);

  const toggleLike = useCallback(
    async (post: SocialWallPostView, on: boolean) => {
      if (!session) return;
      pendingLikes.current.set(post.id, on);
      const patch = (likedByMe: boolean, likeCount?: number) =>
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likedByMe, likeCount: likeCount ?? Math.max(0, p.likeCount + (likedByMe === !!p.likedByMe ? 0 : likedByMe ? 1 : -1)) }
              : p
          )
        );
      patch(on);
      try {
        const res = await swApi.like(codeId, session, post.id, on);
        if (pendingLikes.current.get(post.id) === on) {
          pendingLikes.current.delete(post.id);
          patch(on, res.likeCount);
        }
      } catch (e) {
        if (pendingLikes.current.get(post.id) === on) {
          pendingLikes.current.delete(post.id);
          patch(!on);
        }
        if (e instanceof SwApiError && (e.status === 401 || e.status === 403)) authRef.current(e);
      }
    },
    [codeId, session]
  );

  const addPost = useCallback((post: SocialWallPostView) => {
    setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)].sort(byNewest));
  }, []);

  const removePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { posts, loading, loadingMore, hasMore: !!nextCursor, error, loadMore, reload: loadFirst, toggleLike, addPost, removePost };
}
