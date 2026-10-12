import type { Offer, OfferKind } from '@/src/domain/offers/entities';
import { comboListTotal, normalizeOfferCode, offerStatus } from '@/src/domain/offers/offers';

/**
 * The admin's side of offers: checking a new or edited offer, and what may still change once it has started.
 *
 * Bills are worked out from offers, so an offer that has started keeps its kind, dates' start, code and prices: only
 * its wording, poster and end date can change, and it can be ended. An offer that never started can be deleted.
 */

export type OfferProblem =
  | 'titleRequired'
  | 'titleTooLong'
  | 'startInvalid'
  | 'startInPast'
  | 'endInvalid'
  | 'endBeforeStart'
  | 'endInPast'
  | 'codeInvalid'
  | 'codeTaken'
  | 'priceItemsRequired'
  | 'offerPriceInvalid'
  | 'duplicatePack'
  | 'comboItemsRequired'
  | 'comboPriceInvalid'
  | 'discountInvalid'
  | 'percentTooHigh'
  | 'maxDiscountInvalid'
  | 'minPacksInvalid';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Z0-9]{3,20}$/;

export function newOfferId(): string {
  return `offer_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** True once the offer has started: its prices, code and start can no longer change. */
export function offerPricingLocked(saved: Pick<Offer, 'startYmd' | 'endedAt'> | null | undefined, todayYmd: string): boolean {
  return !!saved && (!!saved.endedAt || todayYmd >= saved.startYmd);
}

/** Only an offer that never started can be deleted; a started one is ended instead. */
export function canDeleteOffer(offer: Pick<Offer, 'startYmd' | 'endedAt' | 'endYmd'>, todayYmd: string): boolean {
  return offerStatus(offer, todayYmd) === 'scheduled';
}

/** Ends the offer now: it leaves the app and the website at once; bills still count today's deliveries. */
export function endOfferNow(offer: Offer, todayYmd: string, nowIso: string = new Date().toISOString()): Offer {
  const endYmd = offer.endYmd && offer.endYmd < todayYmd ? offer.endYmd : todayYmd;
  return { ...offer, endYmd, endedAt: nowIso, updatedAt: nowIso };
}

/**
 * The offer to save when the admin edits `saved`: a started offer keeps everything bills depend on and takes only
 * the new wording, poster and end date.
 */
export function mergeOfferEdit(saved: Offer, draft: Offer, todayYmd: string, nowIso: string = new Date().toISOString()): Offer {
  if (!offerPricingLocked(saved, todayYmd)) return { ...draft, id: saved.id, createdAt: saved.createdAt, updatedAt: nowIso };
  return {
    ...saved,
    title: draft.title,
    description: draft.description,
    imageUri: draft.imageUri,
    endYmd: draft.endYmd,
    updatedAt: nowIso,
  };
}

/**
 * What is wrong with an offer before saving it, in the order the form shows fields. `saved` is the stored offer
 * when editing; `others` are the rest of the offers (for the code check).
 */
export function validateOffer(
  offer: Offer,
  todayYmd: string,
  options: { saved?: Offer | null; others?: readonly Offer[] } = {},
): OfferProblem[] {
  const problems: OfferProblem[] = [];
  const locked = offerPricingLocked(options.saved, todayYmd);

  const title = String(offer.title?.en ?? '').trim();
  if (!title) problems.push('titleRequired');
  else if (title.length > 60 || String(offer.title?.mr ?? '').trim().length > 60) problems.push('titleTooLong');

  if (!YMD.test(offer.startYmd)) problems.push('startInvalid');
  // A new start in the past would change bills already worked out.
  else if (!locked && offer.startYmd < todayYmd) problems.push('startInPast');

  if (offer.endYmd !== undefined && offer.endYmd !== '') {
    if (!YMD.test(offer.endYmd)) problems.push('endInvalid');
    else if (YMD.test(offer.startYmd) && offer.endYmd < offer.startYmd) problems.push('endBeforeStart');
    else if (offer.endYmd < todayYmd && offer.endYmd !== options.saved?.endYmd) problems.push('endInPast');
  }

  if (!locked) {
    const code = normalizeOfferCode(offer.code);
    if (code && !CODE.test(code)) problems.push('codeInvalid');
    else if (
      code &&
      (options.others ?? []).some(
        (o) => o.id !== offer.id && normalizeOfferCode(o.code) === code && offerStatus(o, todayYmd) !== 'ended',
      )
    ) {
      problems.push('codeTaken');
    }
    problems.push(...kindProblems(offer.kind, offer));
  }
  return problems;
}

function kindProblems(kind: OfferKind, offer: Offer): OfferProblem[] {
  const problems: OfferProblem[] = [];
  if (kind === 'price') {
    const items = offer.priceItems ?? [];
    if (items.length === 0) problems.push('priceItemsRequired');
    if (items.some((i) => !(Number(i.offerPrice) >= 0) || !(Number(i.offerPrice) < Number(i.listPrice)))) {
      problems.push('offerPriceInvalid');
    }
    if (new Set(items.map((i) => i.packId)).size !== items.length) problems.push('duplicatePack');
  } else if (kind === 'combo') {
    const items = offer.comboItems ?? [];
    const packs = items.reduce((sum, i) => sum + Math.max(0, Math.floor(Number(i.quantity) || 0)), 0);
    if (items.length === 0 || packs < 2 || items.some((i) => !(Math.floor(Number(i.quantity)) >= 1))) {
      problems.push('comboItemsRequired');
    }
    if (new Set(items.map((i) => i.packId)).size !== items.length) problems.push('duplicatePack');
    const price = Number(offer.comboPrice);
    if (!(price > 0) || (items.length > 0 && !(price < comboListTotal(offer)))) problems.push('comboPriceInvalid');
  } else {
    const d = offer.discount;
    if (!d || !(Number(d.value) > 0)) problems.push('discountInvalid');
    else if (d.type === 'percent' && d.value > 100) problems.push('percentTooHigh');
    if (d?.type === 'percent' && d.maxDiscount !== undefined && !(Number(d.maxDiscount) >= 0)) problems.push('maxDiscountInvalid');
    if (kind === 'subscription' && offer.minPacksPerDay !== undefined && !(Number.isInteger(offer.minPacksPerDay) && offer.minPacksPerDay >= 0)) {
      problems.push('minPacksInvalid');
    }
  }
  return problems;
}
