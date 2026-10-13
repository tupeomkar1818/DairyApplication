import { maskMobile, randomOtp, randomToken, sameHash, sha256Hex } from '@/auth/crypto';
import { refuseIfClosed } from '@/auth/pin';
import { sendOtpSms } from '@/auth/sms';
import { newId, nowIso } from '@/db';
import { ApiError, type Env, type RequestContext } from '@/http';

/**
 * Signing in: a code to the customer's own mobile number, then a session the phone keeps.
 *
 * Who may sign in is decided by the dairy's own records, never by whoever is asking: a number is accepted only if
 * it belongs to the admin, a customer, or a delivery boy the admin added. The first time such a number signs in,
 * its login is created and tied to that record.
 */

/** The same 60 seconds the apps count down (`mobile/src/domain/shared/otpPolicy.ts`). */
export const OTP_EXPIRY_MS = 60_000;
export const OTP_RESEND_COOLDOWN_MS = 60_000;
/** Wrong guesses allowed before the code is burned. */
export const OTP_MAX_ATTEMPTS = 5;
/** Codes one number may ask for in an hour, so nobody can run up the dairy's SMS bill. */
export const OTP_MAX_PER_HOUR = 6;
/** How long a phone stays signed in without signing in again. */
export const SESSION_DAYS = 180;

export type Role = 'admin' | 'customer' | 'delivery_boy';

export type Principal = {
  sessionId: string;
  userId: string;
  mobileNumber: string;
  role: Role;
  /** The customer or delivery boy record this login belongs to. */
  linkedRecordId?: string;
  createdAt: string;
  /** True until they have chosen a PIN: they signed in with their own mobile number (see `auth/pin.ts`). */
  mustSetPin: boolean;
};

type UserRow = {
  id: string;
  mobile: string;
  role: Role;
  display_name: string;
  status: string;
  created_at: string;
};

function pepper(env: Env): string {
  // A missing pepper would silently weaken every stored code, so it is a startup-level mistake, not a warning.
  if (!env.OTP_PEPPER) throw new ApiError(500, 'SERVER_MISCONFIGURED', 'Sign-in is not set up on this server.');
  return env.OTP_PEPPER;
}

/** The dairy's record for this number: the admin's own login, a customer, or a delivery boy. */
async function findLogin(env: Env, mobile: string): Promise<{ user: UserRow | null; linked: { role: Role; id: string; name: string; status: string; appAccess: boolean } | null }> {
  const user = await env.DB.prepare('select id, mobile, role, display_name, status, created_at from users where mobile = ?')
    .bind(mobile)
    .first<UserRow>();

  const customer = await env.DB.prepare('select id, name, status, app_access_enabled from customers where mobile = ?')
    .bind(mobile)
    .first<{ id: string; name: string; status: string; app_access_enabled: number }>();
  if (customer) {
    return { user, linked: { role: 'customer', id: customer.id, name: customer.name, status: customer.status, appAccess: customer.app_access_enabled !== 0 } };
  }

  const boy = await env.DB.prepare('select id, full_name, status, app_access_enabled from delivery_boys where mobile = ?')
    .bind(mobile)
    .first<{ id: string; full_name: string; status: string; app_access_enabled: number }>();
  if (boy) {
    return { user, linked: { role: 'delivery_boy', id: boy.id, name: boy.full_name, status: boy.status, appAccess: boy.app_access_enabled !== 0 } };
  }

  return { user, linked: null };
}

async function linkedRecordId(env: Env, user: UserRow): Promise<string | undefined> {
  if (user.role === 'customer') {
    const row = await env.DB.prepare('select id from customers where mobile = ?').bind(user.mobile).first<{ id: string }>();
    return row?.id;
  }
  if (user.role === 'delivery_boy') {
    const row = await env.DB.prepare('select id from delivery_boys where mobile = ?').bind(user.mobile).first<{ id: string }>();
    return row?.id;
  }
  return undefined;
}

export type OtpRequestResult = { maskedMobileNumber: string; resendAvailableAt: string; otpExpiryAt: string; demoOtp?: string };

/**
 * Sends a code to a number the dairy knows.
 *
 * @throws ApiError MOBILE_NOT_REGISTERED, USER_INACTIVE, OTP_RESEND_COOLDOWN, OTP_TOO_MANY_REQUESTS
 */
export async function requestOtp(env: Env, mobile: string): Promise<OtpRequestResult> {
  const { user, linked } = await findLogin(env, mobile);
  if (!user && !linked) {
    throw ApiError.badRequest('MOBILE_NOT_REGISTERED', 'This number is not registered with the dairy. Please contact us.');
  }
  refuseIfClosed(user, linked);

  const now = Date.now();
  const latest = await env.DB.prepare('select resend_at, created_at from otp_challenges where mobile = ? order by created_at desc limit 1')
    .bind(mobile)
    .first<{ resend_at: string; created_at: string }>();
  if (latest && new Date(latest.resend_at).getTime() > now) {
    throw ApiError.tooManyRequests('OTP_RESEND_COOLDOWN', 'A code was just sent. Please wait before asking for another.', {
      resendAvailableAt: latest.resend_at,
    });
  }
  const hourAgo = new Date(now - 60 * 60_000).toISOString();
  const maxPerHour = Number(env.OTP_MAX_PER_HOUR ?? OTP_MAX_PER_HOUR) || OTP_MAX_PER_HOUR;
  const recent = await env.DB.prepare('select count(*) as sent from otp_challenges where mobile = ? and created_at > ?')
    .bind(mobile, hourAgo)
    .first<{ sent: number }>();
  if ((recent?.sent ?? 0) >= maxPerHour) {
    throw ApiError.tooManyRequests('OTP_TOO_MANY_REQUESTS', 'Too many codes were asked for. Please try again later.');
  }

  const code = randomOtp();
  const createdAt = new Date(now).toISOString();
  const otpExpiryAt = new Date(now + OTP_EXPIRY_MS).toISOString();
  const resendAvailableAt = new Date(now + OTP_RESEND_COOLDOWN_MS).toISOString();
  await env.DB.prepare(
    `insert into otp_challenges (id, mobile, code_hash, purpose, attempts, created_at, expires_at, resend_at)
     values (?, ?, ?, 'login', 0, ?, ?, ?)`,
  )
    .bind(newId('otp'), mobile, await sha256Hex(code, pepper(env)), createdAt, otpExpiryAt, resendAvailableAt)
    .run();

  await sendOtpSms(env, mobile, code);

  return {
    maskedMobileNumber: maskMobile(mobile),
    resendAvailableAt,
    otpExpiryAt,
    // Only while no SMS actually goes out, so the apps can still be used and tested.
    ...(env.OTP_DEV_ECHO === 'true' ? { demoOtp: code } : {}),
  };
}

export type Session = { sessionId: string; userId: string; mobileNumber: string; role: Role; createdAt: string };

/**
 * Checks the code and starts a session.
 *
 * @throws ApiError OTP_EXPIRED, OTP_INVALID, OTP_TOO_MANY_ATTEMPTS, MOBILE_NOT_REGISTERED, USER_INACTIVE
 */
export async function verifyOtp(env: Env, mobile: string, code: string): Promise<Session> {
  const challenge = await env.DB.prepare(
    'select id, code_hash, attempts, expires_at, consumed_at from otp_challenges where mobile = ? order by created_at desc limit 1',
  )
    .bind(mobile)
    .first<{ id: string; code_hash: string; attempts: number; expires_at: string; consumed_at: string | null }>();

  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw ApiError.badRequest('OTP_EXPIRED', 'That code has expired. Ask for a new one.');
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('OTP_TOO_MANY_ATTEMPTS', 'Too many wrong tries. Ask for a new code.');
  }

  const given = await sha256Hex(String(code ?? '').trim(), pepper(env));
  if (!sameHash(given, challenge.code_hash)) {
    await env.DB.prepare('update otp_challenges set attempts = attempts + 1 where id = ?').bind(challenge.id).run();
    const left = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    throw ApiError.badRequest('OTP_INVALID', left > 0 ? `That code is not right. ${left} tries left.` : 'That code is not right.');
  }

  const now = nowIso();
  const { user, linked } = await findLogin(env, mobile);
  if (!user && !linked) throw ApiError.badRequest('MOBILE_NOT_REGISTERED', 'This number is not registered with the dairy.');
  refuseIfClosed(user, linked);

  // First sign-in for a customer or delivery boy the admin added: their login is created now.
  let account: UserRow;
  if (user) {
    account = user;
  } else {
    account = {
      id: newId('user'),
      mobile,
      role: linked!.role,
      display_name: linked!.name,
      status: 'Active',
      created_at: now,
    };
    await env.DB.prepare(
      'insert into users (id, mobile, role, display_name, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(account.id, account.mobile, account.role, account.display_name, account.status, now, now)
      .run();
    const table = linked!.role === 'customer' ? 'customers' : 'delivery_boys';
    await env.DB.prepare(`update ${table} set user_id = ? where id = ?`).bind(account.id, linked!.id).run();
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60_000).toISOString();
  await env.DB.batch([
    env.DB.prepare('update otp_challenges set consumed_at = ? where id = ?').bind(now, challenge.id),
    env.DB.prepare(
      'insert into sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at) values (?, ?, ?, ?, ?, ?)',
    ).bind(newId('sess'), account.id, await sha256Hex(token, pepper(env)), now, expiresAt, now),
  ]);

  // The token itself is the session id the app keeps; the database holds only its hash.
  return { sessionId: token, userId: account.id, mobileNumber: account.mobile, role: account.role, createdAt: now };
}

/** Who is calling, from the `Authorization: Bearer <session>` header. Null when nobody is. */
export async function principalOf(context: Pick<RequestContext, 'request' | 'env'>): Promise<Principal | null> {
  const header = context.request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const row = await context.env.DB.prepare(
    `select s.id as session_id, s.expires_at, s.created_at, u.id as user_id, u.mobile, u.role, u.status, u.pin_hash
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = ?`,
  )
    .bind(await sha256Hex(token, pepper(context.env)))
    .first<{
      session_id: string;
      expires_at: string;
      created_at: string;
      user_id: string;
      mobile: string;
      role: Role;
      status: string;
      pin_hash: string | null;
    }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await context.env.DB.prepare('delete from sessions where id = ?').bind(row.session_id).run();
    return null;
  }
  if (row.status === 'Inactive') return null;

  return {
    sessionId: token,
    userId: row.user_id,
    mobileNumber: row.mobile,
    role: row.role,
    linkedRecordId: await linkedRecordId(context.env, { id: row.user_id, mobile: row.mobile, role: row.role, display_name: '', status: row.status, created_at: row.created_at }),
    createdAt: row.created_at,
    mustSetPin: !row.pin_hash,
  };
}

export async function logout(env: Env, principal: Principal): Promise<void> {
  await env.DB.prepare('delete from sessions where token_hash = ?').bind(await sha256Hex(principal.sessionId, pepper(env))).run();
}

/**
 * Sign-in required.
 *
 * Somebody who signed in with their own mobile number has not chosen a PIN yet, and until they do there is
 * nothing for them to do but choose one — their account is open to anybody who knows that number. So every
 * other route turns them away, and the app takes them straight to the PIN screen.
 */
export async function requireUser(
  context: Pick<RequestContext, 'request' | 'env'>,
  options: { allowWithoutPin?: boolean } = {},
): Promise<Principal> {
  const principal = await principalOf(context);
  if (!principal) throw ApiError.unauthorized();
  if (principal.mustSetPin && !options.allowWithoutPin) {
    throw new ApiError(403, 'PIN_NOT_SET', 'Choose a 4-digit PIN to finish signing in.');
  }
  return principal;
}

/** Sign-in required, and one of these roles. */
export async function requireRole(context: Pick<RequestContext, 'request' | 'env'>, ...roles: Role[]): Promise<Principal> {
  const principal = await requireUser(context);
  if (!roles.includes(principal.role)) throw ApiError.forbidden();
  return principal;
}
