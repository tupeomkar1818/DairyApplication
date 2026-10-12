import { maskMobile, randomOtp, sameHash, sha256Hex } from '@/auth/crypto';
import { sendOtpSms } from '@/auth/sms';
import { newId } from '@/db';
import { ApiError, type Env } from '@/http';

/**
 * The codes a profile change needs — one to the number somebody signs in with before their details change, and one
 * to each number when they move to a new one.
 *
 * Signing in has its own (`auth/service.ts`): there the number has to be one the dairy knows, and a session comes
 * out of it. Here the person is already signed in, and the new number is deliberately one nobody uses yet. Both
 * keep the same rules — a minute to answer, a minute between codes, five tries — and the same table, told apart by
 * what the code is for.
 */

export type Purpose = 'profile_save' | 'profile_old' | 'profile_new';

/** The same minute the apps count down. */
const EXPIRY_MS = 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

function pepper(env: Env): string {
  if (!env.OTP_PEPPER) throw new ApiError(500, 'SERVER_MISCONFIGURED', 'Sign-in is not set up on this server.');
  return env.OTP_PEPPER;
}

export type OtpSent = { maskedMobileNumber: string; resendAvailableAt: string; otpExpiryAt: string; demoOtp?: string };

/**
 * Sends a code to this number for this purpose.
 *
 * @throws ApiError OTP_RESEND_COOLDOWN when one was just sent.
 */
export async function sendProfileOtp(env: Env, mobile: string, purpose: Purpose): Promise<OtpSent> {
  const now = Date.now();
  const latest = await env.DB.prepare(
    'select resend_at from otp_challenges where mobile = ? and purpose = ? order by created_at desc limit 1',
  )
    .bind(mobile, purpose)
    .first<{ resend_at: string }>();
  if (latest && new Date(latest.resend_at).getTime() > now) {
    throw ApiError.tooManyRequests('OTP_RESEND_COOLDOWN', 'A code was just sent. Please wait before asking for another.', {
      resendAvailableAt: latest.resend_at,
    });
  }

  const code = randomOtp();
  const createdAt = new Date(now).toISOString();
  const otpExpiryAt = new Date(now + EXPIRY_MS).toISOString();
  const resendAvailableAt = new Date(now + RESEND_COOLDOWN_MS).toISOString();
  await env.DB.prepare(
    `insert into otp_challenges (id, mobile, code_hash, purpose, attempts, created_at, expires_at, resend_at)
     values (?, ?, ?, ?, 0, ?, ?, ?)`,
  )
    .bind(newId('otp'), mobile, await sha256Hex(code, pepper(env)), purpose, createdAt, otpExpiryAt, resendAvailableAt)
    .run();

  await sendOtpSms(env, mobile, code);

  return {
    maskedMobileNumber: `+91 ${maskMobile(mobile)}`,
    resendAvailableAt,
    otpExpiryAt,
    // Only while no SMS actually goes out, so the apps can still be used and tested.
    ...(env.OTP_DEV_ECHO === 'true' ? { demoOtp: code } : {}),
  };
}

/**
 * Checks a code and uses it up.
 *
 * @throws ApiError OTP_EXPIRED, OTP_INVALID, OTP_TOO_MANY_ATTEMPTS
 */
export async function verifyProfileOtp(env: Env, mobile: string, purpose: Purpose, code: string): Promise<void> {
  const challenge = await env.DB.prepare(
    `select id, code_hash, attempts, expires_at, consumed_at from otp_challenges
      where mobile = ? and purpose = ? order by created_at desc limit 1`,
  )
    .bind(mobile, purpose)
    .first<{ id: string; code_hash: string; attempts: number; expires_at: string; consumed_at: string | null }>();

  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw ApiError.badRequest('OTP_EXPIRED', 'That code has expired. Ask for a new one.');
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest('OTP_TOO_MANY_ATTEMPTS', 'Too many wrong tries. Ask for a new code.');
  }

  const given = await sha256Hex(String(code ?? '').trim(), pepper(env));
  if (!sameHash(given, challenge.code_hash)) {
    await env.DB.prepare('update otp_challenges set attempts = attempts + 1 where id = ?').bind(challenge.id).run();
    const left = MAX_ATTEMPTS - (challenge.attempts + 1);
    throw ApiError.badRequest('OTP_INVALID', left > 0 ? `That code is not right. ${left} tries left.` : 'That code is not right.');
  }

  await env.DB.prepare('update otp_challenges set consumed_at = ? where id = ?').bind(new Date().toISOString(), challenge.id).run();
}
