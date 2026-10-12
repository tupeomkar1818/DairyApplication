import type { Offer, OfferKind, OfferPackRef } from '@/src/domain/offers/entities';
import { normalizeOfferCode } from '@/src/domain/offers/offers';
import type { ProductPack } from '@/src/domain/products/entities';
import { packPrice, productPacks } from '@/src/domain/products/packs';

/**
 * The offer form's working copy: text boxes hold what the admin typed (strings), so a half-typed price never turns
 * into 0. `offerFromDraft` turns it into an `Offer` for `validateOffer` and saving; bad numbers become NaN there and
 * `validateOffer` names the problem.
 */

/** One pack on a price offer or in a combo. */
export type OfferPackRow = OfferPackRef & {
  /** The pack's normal price (`packPrice`) — refreshed from the catalog while the offer has not started. */
  listPrice: number;
  /** `price`: what a pack costs during the offer, as typed. */
  offerPrice: string;
  /** `combo`: packs of this in one combo, as typed. */
  quantity: string;
};

export type OfferDraft = {
  kind: OfferKind;
  titleEn: string;
  titleMr: string;
  descriptionEn: string;
  descriptionMr: string;
  imageUri: string;
  startYmd: string;
  /** '' = runs until ended. */
  endYmd: string;
  code: string;
  priceRows: OfferPackRow[];
  includeRegular: boolean;
  comboRows: OfferPackRow[];
  comboPrice: string;
  discountType: 'percent' | 'flat';
  discountValue: string;
  maxDiscount: string;
  rewardProducts: { productId: string; productName: string }[];
  minPacksPerDay: string;
};

type CatalogProduct = { id: string; name: string } & Parameters<typeof productPacks>[0];

export function emptyOfferDraft(todayYmd: string, kind: OfferKind = 'price'): OfferDraft {
  return {
    kind,
    titleEn: '',
    titleMr: '',
    descriptionEn: '',
    descriptionMr: '',
    imageUri: '',
    startYmd: todayYmd,
    endYmd: '',
    code: '',
    priceRows: [],
    includeRegular: false,
    comboRows: [],
    comboPrice: '',
    discountType: 'percent',
    discountValue: '',
    maxDiscount: '',
    rewardProducts: [],
    minPacksPerDay: '',
  };
}

function numText(n: number | undefined | null): string {
  return n === undefined || n === null || !Number.isFinite(Number(n)) ? '' : String(n);
}

/** The form for an offer that is already saved. */
export function draftFromOffer(offer: Offer): OfferDraft {
  const ref = (i: OfferPackRef): OfferPackRef => ({
    productId: i.productId,
    packId: i.packId,
    productName: i.productName,
    packLabel: i.packLabel,
  });
  return {
    kind: offer.kind,
    titleEn: offer.title?.en ?? '',
    titleMr: offer.title?.mr ?? '',
    descriptionEn: offer.description?.en ?? '',
    descriptionMr: offer.description?.mr ?? '',
    imageUri: offer.imageUri ?? '',
    startYmd: offer.startYmd,
    endYmd: offer.endYmd ?? '',
    code: offer.code ?? '',
    priceRows: (offer.priceItems ?? []).map((i) => ({
      ...ref(i),
      listPrice: i.listPrice,
      offerPrice: numText(i.offerPrice),
      quantity: '1',
    })),
    includeRegular: !!offer.includeRegular,
    comboRows: (offer.comboItems ?? []).map((i) => ({
      ...ref(i),
      listPrice: i.listPrice,
      offerPrice: '',
      quantity: numText(i.quantity),
    })),
    comboPrice: numText(offer.comboPrice),
    discountType: offer.discount?.type ?? 'percent',
    discountValue: numText(offer.discount?.value),
    maxDiscount: offer.discount?.type === 'percent' ? numText(offer.discount.maxDiscount) : '',
    rewardProducts: (offer.rewardProducts ?? []).map((p) => ({ productId: p.productId, productName: p.productName })),
    minPacksPerDay: numText(offer.minPacksPerDay),
  };
}

/** "Copy as new offer": everything but the dates, which start again today and run until ended. */
export function copyDraftFromOffer(offer: Offer, todayYmd: string): OfferDraft {
  return { ...draftFromOffer(offer), startYmd: todayYmd, endYmd: '' };
}

/** A new row for a catalog pack, at its normal price now. */
export function packRowFrom(product: { id: string; name: string }, pack: ProductPack): OfferPackRow {
  return {
    productId: product.id,
    packId: pack.id,
    productName: product.name,
    packLabel: pack.label,
    listPrice: packPrice(pack),
    offerPrice: '',
    quantity: '1',
  };
}

/** Rows priced at the catalog's normal price today (a pack no longer in the catalog keeps its saved price). */
export function refreshListPrices(rows: readonly OfferPackRow[], products: readonly CatalogProduct[]): OfferPackRow[] {
  return rows.map((row) => {
    const product = products.find((p) => p.id === row.productId);
    const pack = product ? productPacks(product).find((p) => p.id === row.packId) : undefined;
    return pack ? { ...row, listPrice: packPrice(pack) } : row;
  });
}

/** '' or rubbish → NaN, so a required number is reported by `validateOffer`. */
function requiredNumber(text: string): number {
  const s = String(text ?? '').replace(/,/g, '').trim();
  return s === '' ? Number.NaN : Number(s);
}

/** '' → undefined (left out); rubbish → NaN (reported). */
function optionalNumber(text: string): number | undefined {
  const s = String(text ?? '').replace(/,/g, '').trim();
  return s === '' ? undefined : Number(s);
}

/** Whole rupees, leaving NaN alone for the validator. */
function rupees(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : n;
}

/** The offer the form describes; only the chosen kind's fields are kept. */
export function offerFromDraft(draft: OfferDraft, meta: { id: string; createdAt: string; updatedAt: string; endedAt?: string }): Offer {
  const titleMr = draft.titleMr.trim();
  const descEn = draft.descriptionEn.trim();
  const descMr = draft.descriptionMr.trim();
  const code = normalizeOfferCode(draft.code);

  const offer: Offer = {
    id: meta.id,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    kind: draft.kind,
    title: titleMr ? { en: draft.titleEn.trim(), mr: titleMr } : { en: draft.titleEn.trim() },
    startYmd: draft.startYmd,
  };
  if (descEn || descMr) offer.description = descMr ? { en: descEn, mr: descMr } : { en: descEn };
  if (draft.imageUri) offer.imageUri = draft.imageUri;
  if (draft.endYmd) offer.endYmd = draft.endYmd;
  if (meta.endedAt) offer.endedAt = meta.endedAt;
  if (code) offer.code = code;

  const ref = (r: OfferPackRow): OfferPackRef => ({
    productId: r.productId,
    packId: r.packId,
    productName: r.productName,
    packLabel: r.packLabel,
  });

  if (draft.kind === 'price') {
    offer.priceItems = draft.priceRows.map((r) => ({
      ...ref(r),
      listPrice: r.listPrice,
      offerPrice: rupees(requiredNumber(r.offerPrice)),
    }));
    if (draft.includeRegular) offer.includeRegular = true;
  } else if (draft.kind === 'combo') {
    offer.comboItems = draft.comboRows.map((r) => ({ ...ref(r), listPrice: r.listPrice, quantity: requiredNumber(r.quantity) }));
    offer.comboPrice = rupees(requiredNumber(draft.comboPrice));
  } else {
    const value = requiredNumber(draft.discountValue);
    if (draft.discountType === 'percent') {
      const max = optionalNumber(draft.maxDiscount);
      offer.discount = max === undefined ? { type: 'percent', value } : { type: 'percent', value, maxDiscount: rupees(max) };
    } else {
      offer.discount = { type: 'flat', value: rupees(value) };
    }
    if (draft.kind === 'subscription') {
      if (draft.rewardProducts.length) offer.rewardProducts = draft.rewardProducts.map((p) => ({ ...p }));
      const min = optionalNumber(draft.minPacksPerDay);
      if (min !== undefined) offer.minPacksPerDay = min;
    }
  }
  return offer;
}
