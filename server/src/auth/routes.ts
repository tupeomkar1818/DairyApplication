import { normalizeMobile } from '@/auth/crypto';
import { resetPin, setPin, signInWithPin } from '@/auth/pin';
import { logout, requestOtp, requireRole, requireUser, verifyOtp } from '@/auth/service';
import { ApiError, json, readJson, type Router } from '@/http';

/**
 * Sign-in, in the shape the apps already speak (`mobile/src/domain/auth/dtos.ts`).
 *
 * The dairy signs in with a number and a PIN (`auth/pin.ts`): no SMS, so a customer can start on the day they
 * are added. The code-by-SMS routes are still here for when the dairy has an SMS sender — they work the moment
 * `SMS_PROVIDER` is set to one, and until then no code leaves the Worker, so nobody can sign in through them.
 */

export function mountAuth(router: Router): Router {
  return router
    // Mobile number and password: the PIN, or their own number the first time (then they set a PIN).
    .post('/auth/login', async ({ env, request }) => {
      const body = await readJson<{ mobileNumber?: string; secret?: string; pin?: string; password?: string }>(request);
      const mobile = normalizeMobile(body.mobileNumber);
      if (!mobile) throw ApiError.badRequest('MOBILE_INVALID', 'Please enter a valid 10-digit mobile number.');
      const secret = String(body.secret ?? body.pin ?? body.password ?? '');
      if (!secret) throw ApiError.badRequest('PASSWORD_REQUIRED', 'Enter your PIN.');
      return json(await signInWithPin(env, mobile, secret));
    })

    // Setting the first PIN, or changing one (which needs the old).
    .post('/auth/pin', async (context) => {
      const principal = await requireUser(context, { allowWithoutPin: true });
      const { pin, currentPin } = await readJson<{ pin?: string; currentPin?: string }>(context.request);
      await setPin(context.env, principal.userId, String(pin ?? ''), currentPin);
      return json({ set: true });
    })

    // Somebody has forgotten their PIN: the dairy forgets it for them, and they start again with their number.
    .post('/auth/pin/reset', async (context) => {
      await requireRole(context, 'super_admin');
      const { mobileNumber } = await readJson<{ mobileNumber?: string }>(context.request);
      const mobile = normalizeMobile(mobileNumber);
      if (!mobile) throw ApiError.badRequest('MOBILE_INVALID', 'Please enter a valid 10-digit mobile number.');
      await resetPin(context.env, mobile);
      return json({ reset: true });
    })

    .post('/auth/otp/request', async ({ env, request }) => {
      const body = await readJson<{ mobileNumber?: string }>(request);
      const mobile = normalizeMobile(body.mobileNumber);
      if (!mobile) throw ApiError.badRequest('MOBILE_INVALID', 'Please enter a valid 10-digit mobile number.');
      return json(await requestOtp(env, mobile));
    })

    .post('/auth/otp/verify', async ({ env, request }) => {
      const body = await readJson<{ mobileNumber?: string; otp?: string }>(request);
      const mobile = normalizeMobile(body.mobileNumber);
      if (!mobile) throw ApiError.badRequest('MOBILE_INVALID', 'Please enter a valid 10-digit mobile number.');
      if (!/^\d{6}$/.test(String(body.otp ?? '').trim())) throw ApiError.badRequest('OTP_INVALID', 'Enter the 6-digit code.');
      const session = await verifyOtp(env, mobile, String(body.otp).trim());
      // However somebody signs in, they need a PIN: it is what they will sign in with next time.
      const user = await env.DB.prepare('select pin_hash from users where id = ?')
        .bind(session.userId)
        .first<{ pin_hash: string | null }>();
      return json({ session, mustSetPin: !user?.pin_hash });
    })

    .get('/auth/me', async (context) => {
      const principal = await requireUser(context, { allowWithoutPin: true });
      return json({
        session: {
          sessionId: principal.sessionId,
          userId: principal.userId,
          mobileNumber: principal.mobileNumber,
          role: principal.role,
          createdAt: principal.createdAt,
        },
        linkedRecordId: principal.linkedRecordId,
      });
    })

    .post('/auth/logout', async (context) => {
      const principal = await requireUser(context, { allowWithoutPin: true });
      await logout(context.env, principal);
      return new Response(null, { status: 204 });
    });
}
