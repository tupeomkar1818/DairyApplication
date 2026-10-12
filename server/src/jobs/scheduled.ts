import type { Env } from '@/http';
import { sendMonthlyBills } from '@/jobs/bills';
import { announceOffersStartingToday } from '@/jobs/offers';
import { sendOrderReminders } from '@/jobs/reminders';

/**
 * The jobs the dairy's day runs on, on Cloudflare's clock (see `triggers.crons` in `wrangler.jsonc`).
 *
 * - **6 pm, the dairy's time** (`30 12 * * *` UTC): the evening reminders.
 * - **Midnight, the dairy's time** (`30 18 * * *` UTC): the offers that start today.
 * - **6 am, the dairy's time** (`30 0 * * *` UTC): the monthly bills whose billing day is today.
 *
 * All three are safe to run twice: a customer already told about tomorrow, about an offer, or about a month's
 * bill, is left alone.
 */

export const REMINDERS_CRON = '30 12 * * *';
export const OFFERS_CRON = '30 18 * * *';
export const BILLS_CRON = '30 0 * * *';

export async function runScheduled(cron: string, env: Env, now: Date = new Date()): Promise<Record<string, number>> {
  if (cron === OFFERS_CRON) {
    const offers = await announceOffersStartingToday(env, now);
    console.log(`[cron] ${cron}: told ${offers} customer(s) about an offer starting today`);
    return { offers };
  }

  if (cron === BILLS_CRON) {
    const bills = await sendMonthlyBills(env, now);
    console.log(`[cron] ${cron}: sent ${bills} bill(s)`);
    return { bills };
  }

  // The evening is the dairy's busiest moment, so an unknown cron runs it rather than doing nothing.
  const reminders = await sendOrderReminders(env, now);
  console.log(`[cron] ${cron}: reminded ${reminders} customer(s) about tomorrow`);
  return { reminders };
}
