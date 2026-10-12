import { requireUser, type Principal } from '@/auth/service';
import { nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { assertPictureIsAnAddress } from '@/media/routes';
import { sendProfileOtp, verifyProfileOtp } from '@/profile/otp';

/**
 * Everybody's own profile: their name, where they live, their photo — and the number they sign in with.
 *
 * Changing a detail asks for a code on the number they already use, because a profile is what the dairy's screens
 * and the delivery round read off. Changing the number itself asks twice: once on the old number, to prove the
 * person asking is the one who has it, and once on the new one, to prove the number is theirs. Between the two the
 * dairy remembers only that the old number answered (`profile_mobile_changes`).
 *
 * A customer's name and address are also on the customer record the dairy keeps, and a delivery boy's on theirs:
 * both are written here too, so the dairy's screens show what the person changed.
 */

type UserRow = { id: string; mobile: string; role: string; display_name: string; status: string; avatar_key: string | null };

const text = (value: unknown): string => String(value ?? '').trim();
const mobileOf = (value: unknown): string => text(value).replace(/\D/g, '').slice(-10);

function formatMobile(mobile: string): string {
  return mobile.length === 10 ? `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}` : mobile;
}

async function userRow(env: Env, userId: string): Promise<UserRow> {
  const row = await env.DB.prepare('select id, mobile, role, display_name, status, avatar_key from users where id = ?')
    .bind(userId)
    .first<UserRow>();
  if (!row) throw ApiError.unauthorized();
  return row;
}

/** The customer or delivery boy record this login belongs to, when it has one. */
async function linkedRecord(env: Env, principal: Principal): Promise<Record<string, unknown> | null> {
  if (!principal.linkedRecordId) return null;
  const table = principal.role === 'customer' ? 'customers' : principal.role === 'delivery_boy' ? 'delivery_boys' : null;
  if (!table) return null;
  return env.DB.prepare(`select * from ${table} where id = ?`).bind(principal.linkedRecordId).first<Record<string, unknown>>();
}

/** The profile as the apps know it (`mobile/src/domain/profile/entities.ts`). */
async function buildProfile(env: Env, principal: Principal): Promise<Record<string, unknown>> {
  const user = await userRow(env, principal.userId);
  const record = await linkedRecord(env, principal);
  const details = record ? JSON.parse(String(record.details_json ?? '{}')) : {};
  const mobile = String(record?.mobile ?? user.mobile);

  const base = {
    userId: user.id,
    role: user.role,
    displayName: String(record?.name ?? record?.full_name ?? user.display_name ?? ''),
    mobileNumberRaw: mobile,
    mobileNumberFormatted: formatMobile(mobile),
    avatarUri: user.avatar_key ?? (record?.photo_key as string | undefined) ?? undefined,
    accountStatus: String(record?.status ?? user.status ?? 'Active'),
  };

  if (principal.role === 'customer') {
    return {
      ...base,
      address: record?.full_address ?? undefined,
      societyName: record?.society_name ?? undefined,
      houseFlatNumber: record?.flat_no ?? undefined,
      alternateMobile: record?.alternate_mobile ?? undefined,
    };
  }
  if (principal.role === 'delivery_boy') {
    return {
      ...base,
      address: details.address ?? undefined,
      alternateMobile: record?.alternate_mobile ?? undefined,
      emergencyContactName: details.emergencyContactName ?? undefined,
      emergencyContactNumber: details.emergencyContactNumber ?? undefined,
    };
  }
  return base;
}

/** A blank value leaves what is stored alone; the apps send a field only when it is on the screen. */
function kept(incoming: unknown, existing: unknown): string | null {
  const value = text(incoming);
  if (incoming === undefined) return (existing as string | null) ?? null;
  return value || ((existing as string | null) ?? null);
}

/** Nobody may take a number another person signs in with. */
async function assertMobileFree(env: Env, mobile: string, userId: string): Promise<void> {
  const clash = await env.DB.prepare(
    `select (select count(*) from users where mobile = ?1 and id != ?2)
          + (select count(*) from customers where mobile = ?1 and (user_id is null or user_id != ?2))
          + (select count(*) from delivery_boys where mobile = ?1 and (user_id is null or user_id != ?2)) as used`,
  )
    .bind(mobile, userId)
    .first<{ used: number }>();
  if ((clash?.used ?? 0) > 0) {
    throw ApiError.badRequest('PROFILE_MOBILE_ALREADY_REGISTERED', 'That number is already registered with the dairy.');
  }
}

type ChangeRow = { user_id: string; old_mobile: string; old_verified_at: string | null; pending_new_mobile: string | null };

async function changeInProgress(env: Env, userId: string): Promise<ChangeRow | null> {
  return env.DB.prepare('select * from profile_mobile_changes where user_id = ?').bind(userId).first<ChangeRow>();
}

export function mountProfile(router: Router): Router {
  return router
    .get('/me/profile', async (context) => {
      const principal = await requireUser(context);
      return json({ profile: await buildProfile(context.env, principal) });
    })

    // A code on the number they already use, before their details change.
    .post('/me/profile/otp', async (context) => {
      const principal = await requireUser(context);
      return json(await sendProfileOtp(context.env, principal.mobileNumber, 'profile_save'));
    })

    .patch('/me/profile', async (context) => {
      const principal = await requireUser(context);
      const body = await readJson<Record<string, unknown>>(context.request);
      const displayName = text(body.displayName);
      if (displayName.length < 2) throw ApiError.badRequest('PROFILE_NAME_REQUIRED', 'Enter your name.');

      await verifyProfileOtp(context.env, principal.mobileNumber, 'profile_save', String(body.otp ?? ''));

      const now = nowIso();
      const statements = [
        context.env.DB.prepare('update users set display_name = ?, updated_at = ? where id = ?').bind(displayName, now, principal.userId),
      ];

      const record = await linkedRecord(context.env, principal);
      if (principal.role === 'customer' && record) {
        statements.push(
          context.env.DB.prepare(
            `update customers set name = ?, full_address = ?, society_name = ?, flat_no = ?, alternate_mobile = ?, updated_at = ?
              where id = ?`,
          ).bind(
            displayName,
            kept(body.address, record.full_address) ?? '',
            kept(body.societyName, record.society_name) ?? '',
            kept(body.houseFlatNumber, record.flat_no) ?? '',
            body.alternateMobile === undefined ? record.alternate_mobile : mobileOf(body.alternateMobile) || null,
            now,
            record.id,
          ),
        );
      }

      if (principal.role === 'delivery_boy' && record) {
        // The delivery team's address and emergency contact ride in `details_json` (see `deliveryBoys/mapping.ts`).
        const details = JSON.parse(String(record.details_json ?? '{}')) as Record<string, unknown>;
        const next = {
          ...details,
          address: kept(body.address, details.address) ?? undefined,
          emergencyContactName: kept(body.emergencyContactName, details.emergencyContactName) ?? undefined,
          emergencyContactNumber:
            body.emergencyContactNumber === undefined
              ? details.emergencyContactNumber
              : mobileOf(body.emergencyContactNumber) || undefined,
        };
        statements.push(
          context.env.DB.prepare(
            'update delivery_boys set full_name = ?, alternate_mobile = ?, details_json = ?, updated_at = ? where id = ?',
          ).bind(
            displayName,
            body.alternateMobile === undefined ? record.alternate_mobile : mobileOf(body.alternateMobile) || null,
            JSON.stringify(next),
            now,
            record.id,
          ),
        );
      }

      await context.env.DB.batch(statements);
      return json({ profile: await buildProfile(context.env, principal) });
    })

    .put('/me/profile/avatar', async (context) => {
      const principal = await requireUser(context);
      const { avatarUri } = await readJson<{ avatarUri?: string }>(context.request);
      const uri = text(avatarUri);
      if (!uri) throw ApiError.badRequest('PROFILE_INVALID_AVATAR', 'Pick a photo first.');
      // A photograph belongs in R2, not in a row every screen reads.
      assertPictureIsAnAddress(uri, 'avatarUri');

      const now = nowIso();
      const statements = [
        context.env.DB.prepare('update users set avatar_key = ?, updated_at = ? where id = ?').bind(uri, now, principal.userId),
      ];
      // A delivery boy's photo is on their record too: it is what the dairy's team screens show.
      if (principal.role === 'delivery_boy' && principal.linkedRecordId) {
        statements.push(
          context.env.DB.prepare('update delivery_boys set photo_key = ?, updated_at = ? where id = ?').bind(
            uri,
            now,
            principal.linkedRecordId,
          ),
        );
      }
      await context.env.DB.batch(statements);
      return json({ profile: await buildProfile(context.env, principal) });
    })

    // Changing the number they sign in with: the old one first.
    .post('/me/profile/mobile/old/otp', async (context) => {
      const principal = await requireUser(context);
      const now = nowIso();
      await context.env.DB.prepare(
        `insert into profile_mobile_changes (user_id, old_mobile, old_verified_at, pending_new_mobile, created_at, updated_at)
         values (?, ?, null, null, ?, ?)
         on conflict(user_id) do update set old_mobile = excluded.old_mobile, old_verified_at = null,
           pending_new_mobile = null, updated_at = excluded.updated_at`,
      )
        .bind(principal.userId, principal.mobileNumber, now, now)
        .run();
      return json(await sendProfileOtp(context.env, principal.mobileNumber, 'profile_old'));
    })

    .post('/me/profile/mobile/old/verify', async (context) => {
      const principal = await requireUser(context);
      const { otp } = await readJson<{ otp?: string }>(context.request);
      const change = await changeInProgress(context.env, principal.userId);
      if (!change) throw ApiError.badRequest('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Please start again.');

      await verifyProfileOtp(context.env, principal.mobileNumber, 'profile_old', String(otp ?? ''));
      await context.env.DB.prepare('update profile_mobile_changes set old_verified_at = ?1, updated_at = ?1 where user_id = ?2')
        .bind(nowIso(), principal.userId)
        .run();
      return json({ verified: true });
    })

    .post('/me/profile/mobile/new/otp', async (context) => {
      const principal = await requireUser(context);
      const { newMobileNumber } = await readJson<{ newMobileNumber?: string }>(context.request);
      const next = mobileOf(newMobileNumber);
      if (next.length !== 10) throw ApiError.badRequest('PROFILE_MOBILE_INVALID', 'Enter a valid 10-digit mobile number.');

      const change = await changeInProgress(context.env, principal.userId);
      if (!change?.old_verified_at) {
        throw ApiError.badRequest('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Answer the code on your current number first.');
      }
      if (next === principal.mobileNumber) {
        throw ApiError.badRequest('PROFILE_MOBILE_SAME_AS_CURRENT', 'That is the number you already use.');
      }
      await assertMobileFree(context.env, next, principal.userId);

      await context.env.DB.prepare('update profile_mobile_changes set pending_new_mobile = ?1, updated_at = ?2 where user_id = ?3')
        .bind(next, nowIso(), principal.userId)
        .run();
      return json(await sendProfileOtp(context.env, next, 'profile_new'));
    })

    .post('/me/profile/mobile/new/verify', async (context) => {
      const principal = await requireUser(context);
      const { newMobileNumber, otp } = await readJson<{ newMobileNumber?: string; otp?: string }>(context.request);
      const next = mobileOf(newMobileNumber);

      const change = await changeInProgress(context.env, principal.userId);
      if (!change?.old_verified_at) {
        throw ApiError.badRequest('PROFILE_OLD_MOBILE_NOT_VERIFIED', 'Answer the code on your current number first.');
      }
      if (!next || next !== change.pending_new_mobile) {
        throw ApiError.badRequest('OTP_EXPIRED', 'Ask for a code on the new number again.');
      }
      // Checked again here: somebody else may have been given that number since the code went out.
      await assertMobileFree(context.env, next, principal.userId);
      await verifyProfileOtp(context.env, next, 'profile_new', String(otp ?? ''));

      const now = nowIso();
      const statements = [
        context.env.DB.prepare('update users set mobile = ?, updated_at = ? where id = ?').bind(next, now, principal.userId),
        context.env.DB.prepare('delete from profile_mobile_changes where user_id = ?').bind(principal.userId),
      ];
      // The record the dairy keeps moves with it, so the two never disagree about how to reach this person.
      if (principal.role === 'customer' && principal.linkedRecordId) {
        statements.push(
          context.env.DB.prepare('update customers set mobile = ?, updated_at = ? where id = ?').bind(next, now, principal.linkedRecordId),
        );
      }
      if (principal.role === 'delivery_boy' && principal.linkedRecordId) {
        statements.push(
          context.env.DB.prepare('update delivery_boys set mobile = ?, updated_at = ? where id = ?').bind(
            next,
            now,
            principal.linkedRecordId,
          ),
        );
      }
      await context.env.DB.batch(statements);

      // The session belongs to the login, not to the number, so it stays signed in.
      return json({ profile: await buildProfile(context.env, { ...principal, mobileNumber: next }) });
    });
}
