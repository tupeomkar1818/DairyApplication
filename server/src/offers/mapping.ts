import { detailsOf, parseJson } from '@/db';

/**
 * Offers as the apps know them (`mobile/src/domain/offers/entities.ts`) ↔ the `offers` rows.
 *
 * The dates, the code and the kind have columns, because the server answers "what is running today" and "whose
 * code is this" from them. What each kind carries — the packs and their offer prices, a combo's contents, the
 * discount rule — travels in `payload_json` exactly as the app wrote it.
 */

export type Offer = Record<string, unknown> & {
  id: string;
  kind: string;
  title: { en: string; mr?: string };
  startYmd: string;
  createdAt: string;
  updatedAt: string;
};

export type OfferRow = {
  id: string;
  kind: string;
  title_en: string;
  title_mr: string | null;
  description_en: string | null;
  description_mr: string | null;
  image_key: string | null;
  start_ymd: string;
  end_ymd: string | null;
  ended_at: string | null;
  code: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export type OfferClaimRow = {
  offer_id: string;
  customer_id: string;
  code: string;
  claimed_at: string;
};

const COLUMN_KEYS = ['id', 'kind', 'title', 'description', 'imageUri', 'startYmd', 'endYmd', 'endedAt', 'code', 'createdAt', 'updatedAt'] as const;

export function offerFromRow(row: OfferRow): Offer {
  const payload = parseJson<Record<string, unknown>>(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    kind: row.kind,
    title: { en: row.title_en, ...(row.title_mr ? { mr: row.title_mr } : {}) },
    ...(row.description_en ? { description: { en: row.description_en, ...(row.description_mr ? { mr: row.description_mr } : {}) } } : {}),
    ...(row.image_key ? { imageUri: row.image_key } : {}),
    startYmd: row.start_ymd,
    ...(row.end_ymd ? { endYmd: row.end_ymd } : {}),
    ...(row.ended_at ? { endedAt: row.ended_at } : {}),
    ...(row.code ? { code: row.code } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function offerToRow(offer: Offer): Omit<OfferRow, 'created_at' | 'updated_at'> {
  const title = (offer.title ?? { en: '' }) as { en?: string; mr?: string };
  const description = (offer.description ?? null) as { en?: string; mr?: string } | null;
  return {
    id: offer.id,
    kind: String(offer.kind),
    title_en: String(title.en ?? '').trim(),
    title_mr: title.mr?.trim() || null,
    description_en: description?.en?.trim() || null,
    description_mr: description?.mr?.trim() || null,
    image_key: (offer.imageUri as string | undefined) ?? null,
    start_ymd: String(offer.startYmd ?? '').slice(0, 10),
    end_ymd: (offer.endYmd as string | undefined)?.slice(0, 10) || null,
    ended_at: (offer.endedAt as string | undefined) ?? null,
    // Codes are compared without case or spaces, so they are stored the way they are compared.
    code: String(offer.code ?? '').replace(/\s+/g, '').toUpperCase() || null,
    payload_json: JSON.stringify(detailsOf(offer, COLUMN_KEYS)),
  };
}

/** Scheduled before its first day, live until its last, ended after — or at once once the dairy ends it. */
export function offerStatus(row: Pick<OfferRow, 'start_ymd' | 'end_ymd' | 'ended_at'>, todayYmd: string): 'scheduled' | 'live' | 'ended' {
  if (row.ended_at) return 'ended';
  if (todayYmd < row.start_ymd) return 'scheduled';
  if (row.end_ymd && todayYmd > row.end_ymd) return 'ended';
  return 'live';
}

/**
 * The offer as the website shows it (`mobile/src/domain/offers/websiteFeed.ts`): the wording, the dates and the
 * kind's own numbers. Offers with a code are never published — the code is for the customers who were given it.
 */
export function websiteOffer(offer: Offer): Record<string, unknown> {
  const out: Record<string, unknown> = { id: offer.id, kind: offer.kind, title: offer.title, startYmd: offer.startYmd };
  if ((offer.description as { en?: string } | undefined)?.en) out.description = offer.description;
  if (offer.endYmd) out.endYmd = offer.endYmd;
  if (offer.kind === 'price') {
    out.priceItems = ((offer.priceItems as Record<string, unknown>[]) ?? []).map((i) => ({
      productName: i.productName,
      packLabel: i.packLabel,
      listPrice: i.listPrice,
      offerPrice: i.offerPrice,
    }));
    if (offer.includeRegular) out.includeRegular = true;
  }
  if (offer.kind === 'combo') {
    const items = (offer.comboItems as Record<string, unknown>[]) ?? [];
    const listTotal = items.reduce((sum, i) => sum + (Number(i.listPrice) || 0) * Math.max(1, Number(i.quantity) || 1), 0);
    out.combo = {
      items: items.map((i) => ({ productName: i.productName, packLabel: i.packLabel, quantity: i.quantity })),
      price: Math.round(Number(offer.comboPrice) || 0),
      listTotal: Math.round(listTotal),
    };
  }
  if ((offer.kind === 'bill' || offer.kind === 'subscription') && offer.discount) out.discount = offer.discount;
  if (offer.kind === 'subscription') {
    const products = (offer.rewardProducts as { productName?: string }[]) ?? [];
    if (products.length) out.rewardProducts = products.map((p) => p.productName);
    if (offer.minPacksPerDay) out.minPacksPerDay = offer.minPacksPerDay;
  }
  return out;
}
