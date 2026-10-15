import { NextRequest, NextResponse } from 'next/server';
import { decodeCursor, encodeCursor, FEED_PAGE } from '@/lib/socialwall/rules';
import {
  getAuthedMember,
  isValidCodeId,
  listChangedSince,
  listFeed,
  loadSocialWall,
  toFeedView,
} from '@/lib/socialwall/store';
import { errorResponse, guardPublic, sessionHeader } from '@/lib/socialwall/server';

// Overlap for the delta window: serverless instances' clocks agree to well under this, and the
// phone de-duplicates by post id, so overlapping a little is free and missing a post is not.
const DELTA_OVERLAP_MS = 3000;

// Member: the feed. Members only — the event is closed, so nothing here is public.
//   ?codeId&group=&cursor=   a page, newest first (cursor from the previous page's nextCursor)
//   ?codeId&since=<ms>       what changed since the last response's serverTime (new posts, new
//                            like counts, and {id, removed} for posts that were hidden or deleted)
export async function GET(request: NextRequest) {
  const blocked = guardPublic(request, 'feed');
  if (blocked) return blocked;
  try {
    const params = request.nextUrl.searchParams;
    const codeId = params.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const { memberId, member } = await getAuthedMember(codeId, sessionHeader(request));
    const me = { memberId, liked: new Set(member.likedPosts) };
    const serverTime = Date.now() - DELTA_OVERLAP_MS;

    const sinceRaw = params.get('since');
    if (sinceRaw !== null) {
      const since = Number(sinceRaw);
      if (!Number.isSafeInteger(since) || since < 0) return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
      const { items, truncated } = await listChangedSince(codeId, since);
      const posts = items.map(({ id, post }) => {
        const mine = post.memberId === memberId;
        if (post.status === 'visible' || (mine && post.status === 'pending')) return toFeedView(id, post, me);
        return { id, removed: true };
      });
      return NextResponse.json({ posts, serverTime, truncated });
    }

    const group = params.get('group');
    const groupId = group && wall.config.groups.some((g) => g.id === group) ? group : null;
    const cursor = decodeCursor(params.get('cursor'));
    const items = await listFeed(codeId, { groupId, cursor });
    const last = items[items.length - 1];
    return NextResponse.json({
      posts: items.map(({ id, post }) => toFeedView(id, post, me)),
      nextCursor: items.length === FEED_PAGE && last ? encodeCursor(last.post.createdAt, last.id) : null,
      serverTime,
    });
  } catch (error) {
    return errorResponse(error, 'feed');
  }
}
