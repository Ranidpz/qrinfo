import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { uploadStoredObject, deleteStoredObjectByUrl } from '@/lib/media-storage';
import { R2_STORAGE_PROVIDER, isR2Configured } from '@/lib/r2-storage';
import { adjustStorageUsed, checkStorageQuota } from '@/lib/storage-guard';
import { MAX_UPLOAD_BYTES, cleanText, isValidPostId } from '@/lib/socialwall/rules';
import { processPostImage } from '@/lib/socialwall/images';
import {
  SocialWallError,
  assertCanPost,
  audit,
  bumpRev,
  createPost,
  deletePostDoc,
  getAuthedMember,
  getControl,
  getPost,
  isValidCodeId,
  listMine,
  loadSocialWall,
  toFeedView,
} from '@/lib/socialwall/store';
import { UPLOAD_LIMIT, errorResponse, guardPublic, readJson, sessionHeader } from '@/lib/socialwall/server';

async function removeFiles(urls: string[]) {
  await Promise.all(
    urls.map((url) =>
      deleteStoredObjectByUrl(url).catch((error) => console.error('[socialwall] file delete failed:', error))
    )
  );
}

// Member: publish a photo. multipart: codeId, postId (UUID made on the phone BEFORE the first
// try — a retry after a lost response returns the same post instead of a second one), caption, file.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'post', UPLOAD_LIMIT);
  if (blocked) return blocked;
  let uploaded: string[] = [];
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new SocialWallError('BAD_FORM', 400);
    }
    const codeId = form.get('codeId');
    const postId = form.get('postId');
    const file = form.get('file');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    if (!isValidPostId(postId)) throw new SocialWallError('INVALID_POST_ID', 400);
    if (!(file instanceof File) || file.size === 0) throw new SocialWallError('NO_FILE', 400);
    if (file.size > MAX_UPLOAD_BYTES) throw new SocialWallError('FILE_TOO_LARGE', 413);

    const wall = await loadSocialWall(codeId);
    const [{ memberId, member }, control] = await Promise.all([
      getAuthedMember(codeId, sessionHeader(request)),
      getControl(codeId),
    ]);
    if (!control.uploads) throw new SocialWallError('UPLOADS_CLOSED', 409);
    const caption = cleanText(form.get('caption'), wall.config.captionMax, { multiline: true });

    // A retry of a post that already landed (the response was lost): answer with it, before the
    // pace check would refuse the retry as "too fast" and before paying for a second upload.
    const already = await getPost(codeId, postId);
    if (already && already.status !== 'deleted') {
      if (already.memberId !== memberId) throw new SocialWallError('CONFLICT', 409);
      return NextResponse.json({
        success: true,
        post: toFeedView(postId, already, { memberId, liked: new Set(member.likedPosts) }),
        postsLeft: Math.max(0, wall.config.maxPostsPerMember - member.postCount),
      });
    }
    if (already) throw new SocialWallError('CONFLICT', 409); // a deleted post's id is not reused

    // Cheap checks first (the transaction re-checks), so a refused post never costs an upload.
    assertCanPost(member, wall.config, Date.now());

    const image = await processPostImage(Buffer.from(await file.arrayBuffer()));
    const bytes = image.full.length + image.card.length;
    const quota = await checkStorageQuota(wall.ownerId, bytes);
    if (!quota.ok) throw new SocialWallError('STORAGE_FULL', 507);

    const folder = `${wall.ownerId}/${codeId}/socialwall/${postId}`;
    const suffix = crypto.randomBytes(6).toString('hex');
    const provider = isR2Configured() ? R2_STORAGE_PROVIDER : undefined;
    const cacheControl = 'public, max-age=31536000, immutable';
    const [full, card] = await Promise.all([
      uploadStoredObject({ key: `${folder}/full_${suffix}.webp`, body: image.full, contentType: 'image/webp', mediaType: 'image', provider, cacheControl }),
      uploadStoredObject({ key: `${folder}/card_${suffix}.webp`, body: image.card, contentType: 'image/webp', mediaType: 'image', provider, cacheControl }),
    ]);
    uploaded = [full.url, card.url];

    const { result, post } = await createPost({
      codeId,
      postId,
      memberId,
      config: wall.config,
      caption,
      fullUrl: full.url,
      cardUrl: card.url,
      storageUrls: uploaded,
      bytes,
      width: image.width,
      height: image.height,
    });

    if (result === 'existing') {
      await removeFiles(uploaded); // the earlier try already stored this post's files
    } else {
      await adjustStorageUsed(wall.ownerId, bytes);
      await bumpRev(codeId);
    }
    uploaded = [];
    return NextResponse.json({
      success: true,
      post: toFeedView(postId, post, { memberId, liked: new Set(member.likedPosts) }),
      postsLeft: Math.max(0, wall.config.maxPostsPerMember - member.postCount - (result === 'created' ? 1 : 0)),
    });
  } catch (error) {
    // Files stored but no post created (limit hit in the transaction, write failed): clean up now.
    if (uploaded.length) await removeFiles(uploaded);
    return errorResponse(error, 'post');
  }
}

// Member: my own posts (including ones still waiting for approval).
export async function GET(request: NextRequest) {
  const blocked = guardPublic(request, 'mine');
  if (blocked) return blocked;
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    await loadSocialWall(codeId);
    const { memberId, member } = await getAuthedMember(codeId, sessionHeader(request));
    const me = { memberId, liked: new Set(member.likedPosts) };
    const items = await listMine(codeId, memberId);
    return NextResponse.json({
      posts: items.filter(({ post }) => post.status === 'visible' || post.status === 'pending').map(({ id, post }) => toFeedView(id, post, me)),
    });
  } catch (error) {
    return errorResponse(error, 'mine');
  }
}

// Member: delete my own post (files and storage are freed at once).
export async function DELETE(request: NextRequest) {
  const blocked = guardPublic(request, 'delete');
  if (blocked) return blocked;
  try {
    const body = await readJson(request);
    const { codeId, postId } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    if (!isValidPostId(postId)) throw new SocialWallError('INVALID_POST_ID', 400);
    const wall = await loadSocialWall(codeId);
    const { memberId } = await getAuthedMember(codeId, sessionHeader(request));
    const existing = await getPost(codeId, postId);
    if (!existing) return NextResponse.json({ success: true }); // already gone: idempotent
    if (existing.memberId !== memberId) throw new SocialWallError('FORBIDDEN', 403);
    const removed = await deletePostDoc(codeId, postId, `member:${memberId}`);
    if (removed) {
      await removeFiles(removed.storageUrls || []);
      await adjustStorageUsed(wall.ownerId, -(removed.bytes || 0));
      await audit(codeId, { action: 'post:delete-own', actor: `member:${memberId}`, postId });
      await bumpRev(codeId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'delete');
  }
}
