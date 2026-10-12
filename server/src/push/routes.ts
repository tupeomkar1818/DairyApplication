import { requireUser } from '@/auth/service';
import { nowIso } from '@/db';
import { ApiError, json, readJson, type Router } from '@/http';

/**
 * Where to reach somebody's phone.
 *
 * The app registers the token Expo gave it, with the language the phone is set to, and forgets it when the person
 * signs out. A token belongs to the login, so a shared phone never keeps the last person's notifications.
 */

export function mountPush(router: Router): Router {
  return router
    .post('/push/tokens', async (context) => {
      const principal = await requireUser(context);
      const { token, platform, language } = await readJson<{ token?: string; platform?: string; language?: string }>(context.request);
      const value = String(token ?? '').trim();
      if (!value) throw ApiError.badRequest('PUSH_TOKEN_REQUIRED', 'No push token was sent.');

      const now = nowIso();
      await context.env.DB.prepare(
        `insert into push_tokens (token, user_id, platform, language, created_at, updated_at) values (?, ?, ?, ?, ?, ?)
         on conflict(token) do update set
           user_id = excluded.user_id, platform = excluded.platform, language = excluded.language,
           updated_at = excluded.updated_at`,
      )
        .bind(value, principal.userId, String(platform ?? 'unknown'), language === 'mr' ? 'mr' : 'en', now, now)
        .run();

      return json({ registered: true });
    })

    // Signing out, or the app being told to stop: the phone is forgotten.
    .delete('/push/tokens/*', async (context) => {
      const principal = await requireUser(context);
      const token = decodeURIComponent(new URL(context.request.url).pathname.replace('/push/tokens/', ''));
      if (!token) throw ApiError.badRequest('PUSH_TOKEN_REQUIRED', 'No push token was sent.');
      await context.env.DB.prepare('delete from push_tokens where token = ? and user_id = ?').bind(token, principal.userId).run();
      return new Response(null, { status: 204 });
    });
}
