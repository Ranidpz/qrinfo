import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, verifyOTPCode } from '@/lib/verification';
import { guardedSendOTP } from '@/lib/messaging/paidSend';
import { SOCIALWALL_LIMITS, accessNeedsOtp, accessUsesAllowlist } from '@/types/socialwall';
import { resolveGroup, validateName } from '@/lib/socialwall/rules';
import {
  SocialWallError,
  activatePhoneMember,
  bumpOtpAttempts,
  getAllowlistEntry,
  getPhoneMember,
  isValidCodeId,
  joinOpen,
  loadSocialWall,
  saveMemberOtp,
} from '@/lib/socialwall/store';
import { JOIN_LIMIT, errorResponse, guardPublic, readJson } from '@/lib/socialwall/server';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_OTP_ATTEMPTS = 5;
// A resend starts a fresh 5 tries for that code, so wrong codes are ALSO counted per phone across
// resends — otherwise resending every 45s would allow unlimited guessing.
const MAX_OTP_FAILS = 10;
const OTP_FAILS_WINDOW_MS = 60 * 60 * 1000;

// Public: join the event's social network. Four access modes (config.access):
//   open                → action 'open'   {name, groupId}
//   allowlist           → action 'phone'  {phone[, name, groupId]}   (phone must be on the HR list)
//   whatsapp            → action 'send' {phone} then 'verify' {phone, code, name, groupId}
//   allowlist_whatsapp  → same as whatsapp, and the phone must be on the list
// On the list, the HR name/group win over what was typed. The response's session
// ("memberId.token") goes in the x-sw-session header of every later call.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'join', JOIN_LIMIT);
  if (blocked) return blocked;
  try {
    const body = await readJson(request);
    const { codeId, action } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const { config } = wall;
    const locale = body.locale === 'en' ? 'en' : 'he';

    // Name/group as typed. Absent is fine where the list or a later profile step supplies them.
    const typedName = validateName(body.name, SOCIALWALL_LIMITS.nameMin, SOCIALWALL_LIMITS.nameMax);
    const typedGroup = resolveGroup(body.groupId, config.groups);

    const respond = (m: { memberId: string; token: string; name: string; groupId: string | null }) =>
      NextResponse.json({
        success: true,
        session: `${m.memberId}.${m.token}`,
        memberId: m.memberId,
        name: m.name,
        groupId: m.groupId,
        needsProfile: !m.name || (config.groups.length > 0 && !m.groupId),
      });

    if (action === 'open') {
      if (config.access !== 'open') throw new SocialWallError('WRONG_ACCESS', 409);
      if (!typedName) throw new SocialWallError('INVALID_NAME', 400);
      if (typedGroup === undefined) throw new SocialWallError('INVALID_GROUP', 400);
      return respond(await joinOpen(codeId, typedName, typedGroup, config.maxMembers));
    }

    // Every other action is phone-based
    if (config.access === 'open') throw new SocialWallError('WRONG_ACCESS', 409);
    if (typeof body.phone !== 'string' || !isValidIsraeliMobile(body.phone)) {
      throw new SocialWallError('INVALID_PHONE', 400);
    }
    const phone = normalizePhoneNumber(body.phone);
    const listEntry = accessUsesAllowlist(config.access) ? await getAllowlistEntry(codeId, phone) : null;
    if (accessUsesAllowlist(config.access) && !listEntry) throw new SocialWallError('NOT_ON_LIST', 403);

    const profile = async () => {
      const existing = (await getPhoneMember(codeId, phone)).member;
      const name = listEntry?.name || typedName || existing?.name || '';
      const groupId = listEntry?.groupId ?? (typedGroup !== undefined ? typedGroup : existing?.groupId ?? null);
      return { name, groupId };
    };

    if (action === 'phone') {
      if (accessNeedsOtp(config.access)) throw new SocialWallError('WRONG_ACCESS', 409);
      const { name, groupId } = await profile();
      return respond(await activatePhoneMember(codeId, phone, name, groupId, config.maxMembers));
    }

    if (!accessNeedsOtp(config.access)) throw new SocialWallError('WRONG_ACCESS', 409);

    if (action === 'send') {
      const perPhone = checkRateLimit(`socialwall-otp-phone:${phone}`, { maxRequests: 3, windowMs: 5 * 60 * 1000 });
      if (!perPhone.success) throw new SocialWallError('RATE_LIMITED', 429);
      const { member } = await getPhoneMember(codeId, phone);
      if (member?.status === 'blocked') throw new SocialWallError('BLOCKED', 403);
      if (member?.otpLastSentAt && Date.now() - member.otpLastSentAt < RESEND_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - member.otpLastSentAt)) / 1000);
        throw new SocialWallError('COOLDOWN', 429, { secondsLeft });
      }
      const otp = generateOTPCode(OTP_LENGTH);
      await saveMemberOtp(codeId, phone, hashOTPCode(otp), Date.now() + OTP_EXPIRY_MS, config.maxMembers);
      const sent = await guardedSendOTP({ codeId, kind: 'socialwall-otp' }, phone, otp, 'whatsapp', locale);
      if (!sent.result.success) throw new SocialWallError('SEND_FAILED', 502);
      return NextResponse.json({ success: true, codeLength: OTP_LENGTH, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 });
    }

    if (action === 'verify') {
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
      const { member } = await getPhoneMember(codeId, phone);
      if (!member?.otpHash || !member.otpExpiresAt) throw new SocialWallError('NO_CODE', 409);
      if (member.status === 'blocked') throw new SocialWallError('BLOCKED', 403);
      if (Date.now() > member.otpExpiresAt) throw new SocialWallError('EXPIRED', 410);
      const now = Date.now();
      const windowOpen = !!member.otpFailsSince && now - member.otpFailsSince < OTP_FAILS_WINDOW_MS;
      const fails = windowOpen ? member.otpFails : 0;
      if (member.otpAttempts >= MAX_OTP_ATTEMPTS || fails >= MAX_OTP_FAILS) throw new SocialWallError('TOO_MANY_ATTEMPTS', 429);
      if (code.length !== OTP_LENGTH || !verifyOTPCode(code, member.otpHash)) {
        await bumpOtpAttempts(codeId, phone, member.otpAttempts + 1, fails + 1, windowOpen ? member.otpFailsSince! : now);
        throw new SocialWallError('WRONG_CODE', 400, { attemptsLeft: MAX_OTP_ATTEMPTS - member.otpAttempts - 1 });
      }
      const { name, groupId } = await profile();
      return respond(await activatePhoneMember(codeId, phone, name, groupId, config.maxMembers));
    }

    throw new SocialWallError('BAD_ACTION', 400);
  } catch (error) {
    return errorResponse(error, 'join');
  }
}
