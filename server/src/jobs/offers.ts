import { loadEveryCustomer } from '@/customers/read';
import type { Env } from '@/http';
import { indiaYmd } from '@/jobs/reminders';
import { remindable } from '@/jobs/schedule';
import { formatDay, inEveryLanguage, WORDS, type Lang } from '@/jobs/words';
import { offerFromRow, type OfferRow } from '@/offers/mapping';
import type { Notification } from '@/notifications/mapping';
import { raiseNotifications } from '@/notifications/raise';
import { sendPush } from '@/push/send';

/**
 * An offer that starts today: every customer it is for is told about it once, on the morning it starts.
 *
 * An offer without a code is for everybody; one with a code is for the customers who have typed it. An offer the
 * dairy starts on the day itself is caught by the same job the next time it runs.
 */

export function offerKey(offerId: string, customerId: string): string {
  return `offer:${offerId}:${customerId}`;
}

export async function announceOffersStartingToday(env: Env, now: Date = new Date()): Promise<number> {
  const today = indiaYmd(now);
  const starting = await env.DB.prepare(
    'select * from offers where start_ymd = ? and ended_at is null and (end_ymd is null or end_ymd >= ?)',
  )
    .bind(today, today)
    .all<OfferRow>();
  if (!starting.results.length) return 0;

  const [customers, claims] = await Promise.all([
    loadEveryCustomer(env),
    env.DB.prepare('select offer_id, customer_id from offer_claims').all<{ offer_id: string; customer_id: string }>(),
  ]);
  const claimed = new Set(claims.results.map((row) => `${row.offer_id}:${row.customer_id}`));

  // Anybody already told about one of these offers is left alone, whenever they were told.
  const told = await env.DB.prepare(
    `select subject_key from notifications where audience = 'Customer' and type = 'Offer' and subject_key in (${starting.results
      .flatMap(() => customers.map(() => '?'))
      .join(', ')})`,
  )
    .bind(...starting.results.flatMap((offer) => customers.map((customer) => offerKey(offer.id, customer.id))))
    .all<{ subject_key: string | null }>();
  const already = new Set(told.results.map((row) => row.subject_key ?? ''));

  const rows: Notification[] = [];
  for (const row of starting.results) {
    const offer = offerFromRow(row);
    const title = (offer.title ?? {}) as { en?: string; mr?: string };
    for (const customer of customers) {
      if (!remindable(customer)) continue;
      if (offer.code && !claimed.has(`${offer.id}:${customer.id}`)) continue;
      const subjectKey = offerKey(offer.id, customer.id);
      if (already.has(subjectKey)) continue;

      const words = inEveryLanguage((lang: Lang) => {
        const t = WORDS[lang];
        const name = (lang === 'mr' ? String(title.mr ?? '').trim() : '') || String(title.en ?? '').trim();
        const validity = offer.endYmd ? t.offerValidTill(formatDay(String(offer.endYmd), lang)) : t.offerUntilEnded;
        return { title: t.offerTitle, body: t.offerBody(name, validity) };
      });

      rows.push({
        id: '',
        audience: 'Customer',
        customerId: customer.id,
        type: 'Offer',
        ...words,
        link: '/(customer)/offers',
        subjectKey,
        createdAt: '',
        updatedAt: '',
      });
    }
  }
  if (!rows.length) return 0;

  const saved = await raiseNotifications(env, rows, now);
  await sendPush(env, saved);
  return rows.length;
}
