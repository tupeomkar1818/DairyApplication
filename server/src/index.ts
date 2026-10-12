import { ApiError, json, Router, type Env } from '@/http';
import { mountAnnouncements } from '@/announcements/routes';
import { mountAuth } from '@/auth/routes';
import { mountBilling } from '@/billing/routes';
import { mountChat } from '@/chat/routes';
import { mountCustomers } from '@/customers/routes';
import { mountDeliveryBoys } from '@/deliveryBoys/routes';
import { mountMedia } from '@/media/routes';
import { mountNotifications } from '@/notifications/routes';
import { mountOffers } from '@/offers/routes';
import { mountPush } from '@/push/routes';
import { runScheduled } from '@/jobs/scheduled';
import { mountProducts } from '@/products/routes';
import { mountProfile } from '@/profile/routes';
import { mountSettings } from '@/settings/routes';
import { API_VERSION } from '@/version';

/**
 * The dairy's API. Areas are added one at a time (see README): this is the groundwork — the router, the health
 * check, and a version the apps can read to know what they are talking to.
 */

const router = new Router()
  .get('/', () => json({ name: 'Amrale Dairy API', version: API_VERSION }))
  .get('/health', async ({ env }) => {
    // A health check that proves the database answers, not just that the Worker is running.
    const started = Date.now();
    try {
      const row = await env.DB.prepare('select count(*) as tables from sqlite_master where type = ?').bind('table').first<{ tables: number }>();
      return json({ ok: true, database: 'up', tables: row?.tables ?? 0, ms: Date.now() - started });
    } catch (error) {
      console.error('health', error);
      throw new ApiError(503, 'DATABASE_DOWN', 'The database did not answer.');
    }
  });

mountAuth(router);
mountProducts(router);
mountCustomers(router);
mountBilling(router);
mountDeliveryBoys(router);
mountOffers(router);
mountAnnouncements(router);
mountChat(router);
mountNotifications(router);
mountPush(router);
mountMedia(router);
mountSettings(router);
mountProfile(router);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  },

  // The dairy’s day: the 6 pm reminders and the offers starting today (see `jobs/scheduled.ts`).
  scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(
      runScheduled(event.cron, env, new Date(event.scheduledTime)).catch((error) => {
        // A job that fails must not take the Worker with it; the next run picks the day up again.
        console.error('cron', event.cron, error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
