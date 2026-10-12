import type { Offer } from '@/src/domain/offers/entities';
import { comboListTotal, comboSavings } from '@/src/domain/offers/offers';
import { getLanguage, type Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import { formatMoney } from '@/src/utils/format';

/**
 * How an offer reads in the admin screens: one short line for the list card ("Shrikhand 500 g ₹180 → ₹160") and the
 * label/value rows of the detail screen. Pure, so the list, the form's locked view and the detail agree.
 */

export type OfferDetailRow = { label: string; value: string };

function discountText(offer: Offer, lang: Lang): string {
  const o = strings('offers', lang);
  const d = offer.discount;
  if (!d) return '';
  if (d.type === 'percent') return o.percentOff(d.value);
  return offer.kind === 'subscription' ? o.amountOffPerPack(formatMoney(d.value)) : o.amountOff(formatMoney(d.value));
}

/** One line saying what the offer gives. */
export function offerSummary(offer: Offer, lang: Lang = getLanguage()): string {
  const o = strings('offers', lang);
  const t = strings('offerAdmin', lang).summary;
  switch (offer.kind) {
    case 'price': {
      const items = offer.priceItems ?? [];
      const first = items[0];
      if (!first) return '';
      const line = t.pricePack(first.productName, first.packLabel, formatMoney(first.listPrice), formatMoney(first.offerPrice));
      return items.length > 1 ? `${line} ${t.morePacks(items.length - 1)}` : line;
    }
    case 'combo':
      return t.combo(formatMoney(offer.comboPrice), formatMoney(comboListTotal(offer)));
    case 'bill':
    case 'subscription': {
      const d = offer.discount;
      if (!d) return '';
      const parts = [discountText(offer, lang)];
      if (d.type === 'percent' && d.maxDiscount != null) parts.push(o.upTo(formatMoney(d.maxDiscount)));
      return parts.join(', ');
    }
    default:
      return '';
  }
}

/** What the offer is, row by row, for the detail screen and the form's locked view. */
export function offerDetailRows(offer: Offer, lang: Lang = getLanguage()): OfferDetailRow[] {
  const o = strings('offers', lang);
  const t = strings('offerAdmin', lang).rows;
  const rows: OfferDetailRow[] = [];
  switch (offer.kind) {
    case 'price':
      for (const i of offer.priceItems ?? []) {
        rows.push({ label: t.pack(i.productName, i.packLabel), value: t.priceChange(formatMoney(i.listPrice), formatMoney(i.offerPrice)) });
      }
      rows.push({ label: t.regularDeliveries, value: offer.includeRegular ? t.regularYes : t.regularNo });
      break;
    case 'combo':
      for (const i of offer.comboItems ?? []) {
        rows.push({ label: t.pack(i.productName, i.packLabel), value: t.comboQuantity(i.quantity) });
      }
      rows.push({ label: t.normalTotal, value: formatMoney(comboListTotal(offer)) });
      rows.push({ label: t.comboPrice, value: formatMoney(offer.comboPrice) });
      rows.push({ label: t.customerSaves, value: formatMoney(comboSavings(offer)) });
      break;
    case 'bill':
    case 'subscription': {
      const d = offer.discount;
      rows.push({ label: offer.kind === 'bill' ? t.discount : t.reward, value: discountText(offer, lang) || '—' });
      if (d?.type === 'percent' && d.maxDiscount != null) {
        rows.push({ label: offer.kind === 'bill' ? t.maxPerBill : t.maxPerMonth, value: formatMoney(d.maxDiscount) });
      }
      if (offer.kind === 'subscription') {
        const names = (offer.rewardProducts ?? []).map((p) => p.productName);
        rows.push({ label: t.products, value: names.length ? names.join(', ') : o.allProducts });
        if (offer.minPacksPerDay) rows.push({ label: t.minPacks, value: String(offer.minPacksPerDay) });
      }
      break;
    }
    default:
      break;
  }
  return rows;
}
