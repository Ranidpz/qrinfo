import { NextRequest, NextResponse } from 'next/server';
import { SOCIALWALL_LIMITS, accessUsesAllowlist } from '@/types/socialwall';
import { resolveGroup, validateName } from '@/lib/socialwall/rules';
import {
  SocialWallError,
  getAllowlistEntry,
  getAuthedMember,
  getControl,
  isValidCodeId,
  loadSocialWall,
} from '@/lib/socialwall/store';
import { errorResponse, guardPublic, readJson, sessionHeader } from '@/lib/socialwall/server';

// Member: who am I (checks a stored session is still good) + the live control state.
export async function GET(request: NextRequest) {
  const blocked = guardPublic(request, 'me');
  if (blocked) return blocked;
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const [{ memberId, member }, control] = await Promise.all([
      getAuthedMember(codeId, sessionHeader(request)),
      getControl(codeId),
    ]);
    return NextResponse.json({
      memberId,
      name: member.name,
      groupId: member.groupId,
      postCount: member.postCount,
      postsLeft: Math.max(0, wall.config.maxPostsPerMember - member.postCount),
      needsProfile: !member.name || (wall.config.groups.length > 0 && !member.groupId),
      control: { screen: control.screen, uploads: control.uploads },
    });
  } catch (error) {
    return errorResponse(error, 'me');
  }
}

// Member: set my name / group (first-time profile, or a fix). A name that came from the HR list
// stays — the list is the source of truth for who someone is.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'me');
  if (blocked) return blocked;
  try {
    const body = await readJson(request);
    const { codeId } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const { ref, member } = await getAuthedMember(codeId, sessionHeader(request));

    const listEntry =
      accessUsesAllowlist(wall.config.access) && member.phone ? await getAllowlistEntry(codeId, member.phone) : null;

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined && !listEntry?.name) {
      const name = validateName(body.name, SOCIALWALL_LIMITS.nameMin, SOCIALWALL_LIMITS.nameMax);
      if (!name) throw new SocialWallError('INVALID_NAME', 400);
      patch.name = name;
    }
    if (body.groupId !== undefined && !listEntry?.groupId) {
      const group = resolveGroup(body.groupId, wall.config.groups);
      if (group === undefined) throw new SocialWallError('INVALID_GROUP', 400);
      patch.groupId = group;
    }
    if (Object.keys(patch).length) await ref.update({ ...patch, lastSeenAt: Date.now() });
    const name = (patch.name as string | undefined) ?? member.name;
    const groupId = patch.groupId !== undefined ? (patch.groupId as string | null) : member.groupId;
    return NextResponse.json({
      success: true,
      name,
      groupId,
      needsProfile: !name || (wall.config.groups.length > 0 && !groupId),
    });
  } catch (error) {
    return errorResponse(error, 'me-update');
  }
}
