import { randomToken, sameHash, sha256Hex } from '@/auth/crypto';
import { newId, nowIso } from '@/db';
import { ApiError, type Env } from '@/http';
import { NOT_STAFF, STANDALONE_ROLES } from '@/auth/roles';
import type { Role, Session } from '@/auth/service';

/**
 * Signing in with a PIN.
 *
 * The first time somebody signs in, the password is their own mobile number; they set a four-digit PIN on the spot
 * and that is the password from then on. No SMS is involved, which is the point: a customer can start on the day
 * the dairy adds them.
 *
 * What that costs, and what is done about it: for the short while between the dairy adding somebody and their first
 * sign-in, anybody who knows that mobile number could sign in as them. So the number stops working the moment a PIN
 * is set, wrong tries lock the account for a while, and nothing but setting the PIN can be done until it is set.
 * Resetting a PIN (which opens that window again) is the dairy's to do, and is written into the log.
 */

/** Wrong tries before the account is closed to further tries. */
export const MAX_PIN_ATTEMPTS = 5;
/** How long it stays closed. Long enough that guessing 10,000 PINs would take years, short enough to wait out. */
export const PIN_LOCK_MS = 15 * 60_000;
/** How long a phone stays signed in without signing in again. */
const SESSION_DAYS = 180;

export type UserRow = {
  id: string;
  mobile: string;
  role: Role;
  display_name: string;
  status: string;
  created_at: string;
  pin_hash: string | null;
  pin_set_at: string | null;
  pin_attempts: number;
  pin_locked_until: string | null;
};

function pepper(env: Env): string {
  if (!env.OTP_PEPPER) throw new ApiError(500, 'SERVER_MISCONFIGURED', 'Sign-in is not set up on this server.');
  return env.OTP_PEPPER;
}

/** Four digits. Anything goes — a dairy's customers should not be argued with about their own PIN. */
export function isPin(value: unknown): boolean {
  return /^\d{4}$/.test(String(value ?? '').trim());
}

export async function hashPin(env: Env, pin: string): Promise<string> {
  // The user's id is not in the hash: a reset has to be able to re-use the same PIN.
  return sha256Hex(`pin:${pin}`, pepper(env));
}

/** True while the account is closed to further tries. */
export function lockedUntil(user: Pick<UserRow, 'pin_locked_until'>, now: Date): Date | null {
  if (!user.pin_locked_until) return null;
  const until = new Date(user.pin_locked_until);
  return until.getTime() > now.getTime() ? until : null;
}

function minutesFrom(now: Date, until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}

/** A wrong password: counted, and after enough of them the account is closed for a while. */
async function countWrongTry(env: Env, user: UserRow, now: Date): Promise<never> {
  const attempts = (user.pin_attempts ?? 0) + 1;
  const locked = attempts >= MAX_PIN_ATTEMPTS;
  await env.DB.prepare('update users set pin_attempts = ?, pin_locked_until = ?, updated_at = ? where id = ?')
    .bind(locked ? 0 : attempts, locked ? new Date(now.getTime() + PIN_LOCK_MS).toISOString() : null, nowIso(), user.id)
    .run();

  if (locked) {
    throw ApiError.tooManyRequests('PIN_LOCKED', `Too many wrong tries. Try again in ${Math.round(PIN_LOCK_MS / 60_000)} minutes.`);
  }
  const left = MAX_PIN_ATTEMPTS - attempts;
  throw ApiError.badRequest(
    user.pin_hash ? 'PIN_INVALID' : 'PASSWORD_INVALID',
    user.pin_hash
      ? `That PIN is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : `That is not your mobile number. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
  );
}

/** The dairy's record for this number: the admin's own login, a customer, or a delivery boy. */
/**
 * The login that belongs to this record — the one its `user_id` names, never merely one that shares the number.
 *
 * A mobile number can come back round: somebody leaves the dairy, and months later the number is somebody
 * else's. Reading the login off the number alone would hand the new person the old one's login, PIN included, so
 * it is read off the record instead. A login left sitting on the number belongs to nobody now — it is cleared
 * out of the way, which it has to be anyway, since a login is unique by number and the new one could not
 * otherwise be made.
 */
export async function loginFor(env: Env, mobile: string, userId: string | null): Promise<UserRow | null> {
  if (userId) {
    const theirs = await env.DB.prepare(
      `select id, mobile, role, display_name, status, created_at, pin_hash, pin_set_at, pin_attempts, pin_locked_until
         from users where id = ?`,
    )
      .bind(userId)
      .first<UserRow>();
    if (theirs) return theirs;
  }
  await env.DB.prepare(`delete from users where mobile = ? and ${NOT_STAFF}`).bind(mobile).run();
  return null;
}

/** The dairy's record for this number: the admin's own login, a customer, or a delivery boy. */
async function findLogin(env: Env, mobile: string): Promise<{ user: UserRow | null; linked: { role: Role; id: string; name: string; status: string; appAccess: boolean } | null }> {
  const customer = await env.DB.prepare('select id, name, status, app_access_enabled, user_id from customers where mobile = ?')
    .bind(mobile)
    .first<{ id: string; name: string; status: string; app_access_enabled: number; user_id: string | null }>();
  if (customer) {
    return {
      user: await loginFor(env, mobile, customer.user_id),
      linked: { role: 'customer', id: customer.id, name: customer.name, status: customer.status, appAccess: customer.app_access_enabled !== 0 },
    };
  }

  const boy = await env.DB.prepare('select id, full_name, status, app_access_enabled, user_id from delivery_boys where mobile = ?')
    .bind(mobile)
    .first<{ id: string; full_name: string; status: string; app_access_enabled: number; user_id: string | null }>();
  if (boy) {
    return {
      user: await loginFor(env, mobile, boy.user_id),
      linked: { role: 'delivery_boy', id: boy.id, name: boy.full_name, status: boy.status, appAccess: boy.app_access_enabled !== 0 },
    };
  }

  const desk = await env.DB.prepare('select id, full_name, status, app_access_enabled, user_id from desk_users where mobile = ?')
    .bind(mobile)
    .first<{ id: string; full_name: string; status: string; app_access_enabled: number; user_id: string | null }>();
  if (desk) {
    return {
      user: await loginFor(env, mobile, desk.user_id),
      linked: { role: 'desk', id: desk.id, name: desk.full_name, status: desk.status, appAccess: desk.app_access_enabled !== 0 },
    };
  }

  // Nobody the dairy keeps a record for under this number. Only the owner's own login and a manager's stand
  // on their own; anything else here is a login whose record has gone.
  const user = await env.DB.prepare(
    `select id, mobile, role, display_name, status, created_at, pin_hash, pin_set_at, pin_attempts, pin_locked_until
       from users where mobile = ?`,
  )
    .bind(mobile)
    .first<UserRow>();
  return { user: user && STANDALONE_ROLES.includes(user.role) ? user : null, linked: null };
}

/**
 * Turns away somebody the dairy has switched off.
 *
 * The admin app's switches move together — turning a customer Inactive turns their app access off as well — and
 * either one means the same thing here: the number is still the dairy’s, but it is not to be signed in with.
 * Their record and their bills are untouched, so switching them back on lets them in again with the PIN they
 * already chose.
 *
 * @throws ApiError USER_INACTIVE, APP_ACCESS_DISABLED
 */
export function refuseIfClosed(
  user: { status: string } | null,
  linked: { status: string; appAccess: boolean } | null,
): void {
  const inactive = user?.status === 'Inactive' || linked?.status === 'Inactive';
  if (inactive) throw new ApiError(403, 'USER_INACTIVE', 'This account is inactive. Please contact the dairy.');
  if (linked && !linked.appAccess) {
    throw new ApiError(403, 'APP_ACCESS_DISABLED', 'App access is switched off for this account. Please contact the dairy.');
  }
}

export type LoginResult = { session: Session; mustSetPin: boolean };

/**
 * Signs somebody in with their number and their password — their PIN, or their own mobile number the first time.
 *
 * @throws ApiError MOBILE_NOT_REGISTERED, USER_INACTIVE, PIN_INVALID, PASSWORD_INVALID, PIN_LOCKED
 */
export async function signInWithPin(env: Env, mobile: string, secret: string, now: Date = new Date()): Promise<LoginResult> {
  const { user, linked } = await findLogin(env, mobile);
  // Nobody the dairy keeps under this number — including a login left behind by a record that has since been
  // removed or renumbered, which is no more a way in than a number the dairy never had.
  if (!linked && !(user && STANDALONE_ROLES.includes(user.role))) {
    throw ApiError.badRequest('MOBILE_NOT_REGISTERED', 'This number is not registered with the dairy. Please contact us.');
  }
  refuseIfClosed(user, linked);

  const at = nowIso();
  // First sign-in for a customer or delivery boy the dairy added: their login is made now, with no PIN yet.
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
      created_at: at,
      pin_hash: null,
      pin_set_at: null,
      pin_attempts: 0,
      pin_locked_until: null,
    };
    await env.DB.prepare('insert into users (id, mobile, role, display_name, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)')
      .bind(account.id, account.mobile, account.role, account.display_name, account.status, at, at)
      .run();
    const table = linked!.role === 'customer' ? 'customers' : 'delivery_boys';
    await env.DB.prepare(`update ${table} set user_id = ? where id = ?`).bind(account.id, linked!.id).run();
  }

  const locked = lockedUntil(account, now);
  if (locked) {
    throw ApiError.tooManyRequests('PIN_LOCKED', `Too many wrong tries. Try again in ${minutesFrom(now, locked)} minutes.`);
  }

  const given = String(secret ?? '').replace(/\s+/g, '');
  if (account.pin_hash) {
    if (!isPin(given) || !sameHash(await hashPin(env, given), account.pin_hash)) await countWrongTry(env, account, now);
  } else {
    // No PIN yet: the password is their own number, and only until they set one.
    if (given !== mobile) await countWrongTry(env, account, now);
  }

  const token = randomToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000).toISOString();
  await env.DB.batch([
    env.DB.prepare('update users set pin_attempts = 0, pin_locked_until = null, updated_at = ? where id = ?').bind(at, account.id),
    env.DB.prepare('insert into sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at) values (?, ?, ?, ?, ?, ?)').bind(
      newId('sess'),
      account.id,
      await sha256Hex(token, pepper(env)),
      at,
      expiresAt,
      at,
    ),
  ]);

  return {
    session: { sessionId: token, userId: account.id, mobileNumber: account.mobile, role: account.role, createdAt: at },
    mustSetPin: !account.pin_hash,
  };
}

/**
 * Forgets the login of somebody the dairy has removed.
 *
 * A login is made on the first sign-in and outlives the customer or delivery boy record it was made for, so
 * without this a removed customer would keep signing in with the PIN they chose. Their sessions and push tokens
 * cascade away with it. The dairy's own admin login is never touched.
 */
/**
 * Keeps a login in step with the record it belongs to, as part of that record’s own write.
 *
 * Signing in reads the customer’s or delivery boy’s own row, so switching somebody off stops the next sign-in
 * by itself. A phone that is already signed in, though, does not sign in again for months — and `requireUser`
 * refuses an inactive login, so this is what reaches that phone, on its very next request.
 */
export function matchLoginToRecord(env: Env, mobile: string, open: boolean, at: string) {
  return env.DB
    .prepare(`update users set status = ?, updated_at = ? where mobile = ? and ${NOT_STAFF}`)
    .bind(open ? 'Active' : 'Inactive', at, mobile);
}

/**
 * Moves a login when the dairy corrects somebody's mobile number.
 *
 * Without this the old number would go on signing in (it is still a login, even though the dairy no longer has
 * that number anywhere), and worse, giving that number to somebody new later would hand them the old owner’s
 * PIN. Moving it instead keeps the person signed in and keeps the PIN they chose, which is what the dairy means
 * by correcting a number. A customer who changes their own number goes through `profile/routes.ts`, which
 * already does this as part of its own write.
 */
export async function moveLogin(env: Env, from: string, to: string): Promise<void> {
  if (from === to) return;
  await env.DB
    .prepare(`update users set mobile = ?, updated_at = ? where mobile = ? and ${NOT_STAFF}`)
    .bind(to, nowIso(), from)
    .run();
}

export async function forgetLogin(env: Env, mobile: string): Promise<void> {
  await env.DB.prepare(`delete from users where mobile = ? and ${NOT_STAFF}`).bind(mobile).run();
}

/**
 * Sets the PIN, or changes it. Changing one needs the old PIN; setting the first one does not — signing in with
 * the mobile number is what proved the phone.
 *
 * @throws ApiError PIN_INVALID, PIN_LOCKED
 */
export async function setPin(env: Env, userId: string, pin: string, currentPin: string | undefined, now: Date = new Date()): Promise<void> {
  if (!isPin(pin)) throw ApiError.badRequest('PIN_INVALID', 'Choose a 4-digit PIN.');

  const user = await env.DB.prepare(
    'select id, mobile, role, display_name, status, created_at, pin_hash, pin_set_at, pin_attempts, pin_locked_until from users where id = ?',
  )
    .bind(userId)
    .first<UserRow>();
  if (!user) throw ApiError.unauthorized();

  const locked = lockedUntil(user, now);
  if (locked) throw ApiError.tooManyRequests('PIN_LOCKED', `Too many wrong tries. Try again in ${minutesFrom(now, locked)} minutes.`);

  if (user.pin_hash) {
    if (!isPin(currentPin ?? '') || !sameHash(await hashPin(env, String(currentPin)), user.pin_hash)) {
      await countWrongTry(env, user, now);
    }
  }

  const at = nowIso();
  await env.DB.prepare(
    'update users set pin_hash = ?, pin_set_at = ?, pin_attempts = 0, pin_locked_until = null, updated_at = ? where id = ?',
  )
    .bind(await hashPin(env, pin), at, at, userId)
    .run();
  console.log(`[pin] set for ${user.role} ${user.mobile}`);
}

/**
 * The dairy forgets somebody's PIN for them: they sign in with their own number again and set a new one.
 *
 * This opens the first-sign-in window again, so it is the dairy's to do and it is written into the log.
 */
export async function resetPin(env: Env, mobile: string): Promise<void> {
  const user = await env.DB.prepare('select id, mobile, role from users where mobile = ?').bind(mobile).first<{ id: string; mobile: string; role: string }>();
  if (!user) throw ApiError.notFound('MOBILE_NOT_REGISTERED', 'Nobody signs in with that number.');
  await env.DB.prepare(
    'update users set pin_hash = null, pin_set_at = null, pin_attempts = 0, pin_locked_until = null, updated_at = ? where id = ?',
  )
    .bind(nowIso(), user.id)
    .run();
  console.log(`[pin] reset by the dairy for ${user.role} ${user.mobile}`);
}
