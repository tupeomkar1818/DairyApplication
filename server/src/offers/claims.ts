import type { Env } from '@/http';
import type { OfferClaimRow } from '@/offers/mapping';

/**
 * The codes customers have typed (`offer_claims`), read with their records.
 *
 * Claims are the server's to write — only `POST /offers/claim` adds one, after checking the code against the
 * offers — so a customer's record carries them for the screens to read, and a saved record never changes them.
 */

export type OfferClaim = { offerId: string; code: string; claimedAt: string };

function claimFromRow(row: OfferClaimRow): OfferClaim {
  return { offerId: row.offer_id, code: row.code, claimedAt: row.claimed_at };
}

/** Each of these customers' claims, oldest first. */
export async function claimsByCustomer(env: Env, customerIds: readonly string[]): Promise<Map<string, OfferClaim[]>> {
  const byCustomer = new Map<string, OfferClaim[]>();
  if (!customerIds.length) return byCustomer;

  const rows = await env.DB.prepare(
    `select * from offer_claims where customer_id in (${customerIds.map(() => '?').join(', ')}) order by claimed_at`,
  )
    .bind(...customerIds)
    .all<OfferClaimRow>();

  for (const row of rows.results) {
    const list = byCustomer.get(row.customer_id) ?? [];
    list.push(claimFromRow(row));
    byCustomer.set(row.customer_id, list);
  }
  return byCustomer;
}
