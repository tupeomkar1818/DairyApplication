import { normalizeMobile } from '@/auth/crypto';
import { logout, requestOtp, requireUser, verifyOtp } from '@/auth/service';
import { ApiError, json, readJson, type Router } from '@/http';

/** Sign-in, in the shape the apps already speak (`mobile/src/domain/auth/dtos.ts`). */

export function mountAuth(router: Router): Router {
  return router
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
      return json({ session: await verifyOtp(env, mobile, String(body.otp).trim()) });
    })

    .get('/auth/me', async (context) => {
      const principal = await requireUser(context);
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
      const principal = await requireUser(context);
      await logout(context.env, principal);
      return new Response(null, { status: 204 });
    });
}
