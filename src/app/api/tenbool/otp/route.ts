import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode, verifyOTPCode } from '@/lib/verification';
import { sendOTP } from '@/lib/inforu';
import {
  bumpOtpAttempts,
  getAuthedPlayer,
  markPhoneVerified,
  phoneAlreadyOnBoard,
  saveOtp,
} from '@/lib/tenbool/store';
import { errorResponse, guardPublic, isValidCodeId, loadPhoneModeCode, readJson } from '@/lib/tenbool/server';

const OTP_LENGTH = 4;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// Phone mode, winners only: prove the phone number before the hit goes on the board
// (owners can switch this off in the settings). Same WhatsApp template and rules as the other
// experiences: 4 digits, 5 minutes, 5 tries, 45s between sends.
export async function POST(request: NextRequest) {
  const blocked = guardPublic(request, 'otp', { maxRequests: 60, windowMs: 60 * 1000 });
  if (blocked) return blocked;
  try {
    const body = await readJson(request);
    const { codeId, playerId, token, action } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const { competition } = await loadPhoneModeCode(codeId);
    const { ref, player } = await getAuthedPlayer(codeId, playerId, token);
    if (!competition.verifyWinners) return NextResponse.json({ error: 'Not required', errorCode: 'NOT_REQUIRED' }, { status: 409 });
    if (!player.won) return NextResponse.json({ error: 'No hit yet', errorCode: 'NOT_WON' }, { status: 409 });
    if (player.claimed || player.verified) return NextResponse.json({ success: true, verified: true });

    if (action === 'send') {
      const phone = body.phone;
      if (typeof phone !== 'string' || !isValidIsraeliMobile(phone)) {
        return NextResponse.json({ error: 'Invalid phone', errorCode: 'INVALID_PHONE' }, { status: 400 });
      }
      const normalized = normalizePhoneNumber(phone);
      const perPhone = checkRateLimit(`tenbool-otp-phone:${normalized}`, { maxRequests: 3, windowMs: 5 * 60 * 1000 });
      if (!perPhone.success) return NextResponse.json({ error: 'Too many codes', errorCode: 'RATE_LIMITED' }, { status: 429 });
      if (player.otpLastSentAt && Date.now() - player.otpLastSentAt < RESEND_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - player.otpLastSentAt)) / 1000);
        return NextResponse.json({ error: 'Wait', errorCode: 'COOLDOWN', secondsLeft }, { status: 429 });
      }
      // One spot per phone - checked before spending a WhatsApp message
      if (await phoneAlreadyOnBoard(codeId, normalized, ref.id)) {
        return NextResponse.json({ error: 'Phone already on the board', errorCode: 'PHONE_TAKEN' }, { status: 409 });
      }
      const otp = generateOTPCode(OTP_LENGTH);
      await saveOtp(ref, normalized, hashOTPCode(otp), Date.now() + OTP_EXPIRY_MS);
      const sent = await sendOTP(normalized, otp, 'whatsapp', 'he');
      if (!sent.result.success) {
        return NextResponse.json({ error: 'Send failed', errorCode: 'SEND_FAILED' }, { status: 502 });
      }
      return NextResponse.json({ success: true, codeLength: OTP_LENGTH, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 });
    }

    if (action === 'verify') {
      const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
      if (!player.otpHash || !player.otpExpiresAt || !player.phone) {
        return NextResponse.json({ error: 'No code sent', errorCode: 'NO_CODE' }, { status: 409 });
      }
      if (Date.now() > player.otpExpiresAt) return NextResponse.json({ error: 'Expired', errorCode: 'EXPIRED' }, { status: 410 });
      if ((player.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        return NextResponse.json({ error: 'Too many tries', errorCode: 'TOO_MANY_ATTEMPTS' }, { status: 429 });
      }
      if (code.length !== OTP_LENGTH || !verifyOTPCode(code, player.otpHash)) {
        await bumpOtpAttempts(ref, (player.otpAttempts || 0) + 1);
        return NextResponse.json(
          { error: 'Wrong code', errorCode: 'WRONG_CODE', attemptsLeft: MAX_OTP_ATTEMPTS - (player.otpAttempts || 0) - 1 },
          { status: 400 }
        );
      }
      // Re-checked here: someone else may have claimed with this phone while the code was in flight
      if (await phoneAlreadyOnBoard(codeId, player.phone, ref.id)) {
        return NextResponse.json({ error: 'Phone already on the board', errorCode: 'PHONE_TAKEN' }, { status: 409 });
      }
      await markPhoneVerified(ref);
      return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return errorResponse(error, 'otp');
  }
}
