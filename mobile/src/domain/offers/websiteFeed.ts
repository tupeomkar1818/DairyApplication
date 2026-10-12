import type { Offer, OfferDiscountRule, OfferKind, OfferText } from '@/src/domain/offers/entities';
import { comboListTotal, normalizeOfferCode, offerStatus } from '@/src/domain/offers/offers';

/**
 * The offers file the website reads (`offers.json` next to the site's pages).
 *
 * The app keeps its data on the phone until it has a server, so the admin exports this file and uploads it with the
 * website. The website shows an offer only between its first and last day, so an offer disappears by itself when it
 * ends; an offer ended early or deleted leaves the website when the file is exported and uploaded again. Offers with
 * a code are never published — the code is for the customers the dairy gave it to.
 *
 * Keep `WEBSITE_OFFERS_VERSION` in step with `website/src/lib/offers.ts`.
 */

export const WEBSITE_OFFERS_VERSION = 1;
export const WEBSITE_OFFERS_FILE_NAME = 'offers.json';

export type WebsiteOffer = {
  id: string;
  kind: OfferKind;
  title: OfferText;
  description?: OfferText;
  /** First day shown (YYYY-MM-DD, India time). */
  startYmd: string;
  /** Last day shown; shown until the next export when omitted. */
  endYmd?: string;
  priceItems?: { productName: string; packLabel: string; listPrice: number; offerPrice: number }[];
  combo?: { items: { productName: string; packLabel: string; quantity: number }[]; price: number; listTotal: number };
  discount?: OfferDiscountRule;
  /** `subscription`: only these products (all when omitted). */
  rewardProducts?: string[];
  minPacksPerDay?: number;
  /** `price`: also lowers regular subscription deliveries. */
  includeRegular?: boolean;
};

export type WebsiteOffersFeed = {
  version: typeof WEBSITE_OFFERS_VERSION;
  /** When the admin exported it (ISO). */
  generatedAt: string;
  offers: WebsiteOffer[];
};

/** Live and upcoming offers without a code, oldest start first. */
export function buildWebsiteOffersFeed(
  offers: readonly Offer[],
  todayYmd: string,
  nowIso: string = new Date().toISOString(),
): WebsiteOffersFeed {
  const published = offers
    .filter((o) => !normalizeOfferCode(o.code) && offerStatus(o, todayYmd) !== 'ended')
    .sort((a, b) => a.startYmd.localeCompare(b.startYmd))
    .map((o): WebsiteOffer => {
      const out: WebsiteOffer = {
        id: o.id,
        kind: o.kind,
        title: o.title,
        startYmd: o.startYmd,
      };
      if (o.description?.en?.trim()) out.description = o.description;
      if (o.endYmd) out.endYmd = o.endYmd;
      if (o.kind === 'price') {
        out.priceItems = (o.priceItems ?? []).map((i) => ({
          productName: i.productName,
          packLabel: i.packLabel,
          listPrice: i.listPrice,
          offerPrice: i.offerPrice,
        }));
        if (o.includeRegular) out.includeRegular = true;
      }
      if (o.kind === 'combo') {
        out.combo = {
          items: (o.comboItems ?? []).map((i) => ({ productName: i.productName, packLabel: i.packLabel, quantity: i.quantity })),
          price: Math.round(Number(o.comboPrice) || 0),
          listTotal: comboListTotal(o),
        };
      }
      if ((o.kind === 'bill' || o.kind === 'subscription') && o.discount) out.discount = o.discount;
      if (o.kind === 'subscription') {
        if (o.rewardProducts?.length) out.rewardProducts = o.rewardProducts.map((p) => p.productName);
        if (o.minPacksPerDay) out.minPacksPerDay = o.minPacksPerDay;
      }
      return out;
    });
  return { version: WEBSITE_OFFERS_VERSION, generatedAt: nowIso, offers: published };
}
