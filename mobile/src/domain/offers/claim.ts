import type { Offer, OfferClaim } from '@/src/domain/offers/entities';
import { claimOfferCode } from '@/src/domain/offers/offers';
import type { IOfferService } from '@/src/domain/offers/service.interface';
import { services } from '@/src/infrastructure/service-registry';

/**
 * Applying a code the customer typed, wherever the offers are kept.
 *
 * With the dairy's server the code goes there and the server writes the claim: it alone knows the codes, so a coded
 * offer never travels to a phone that has not unlocked it. On a phone keeping its own records the code is checked
 * against the offers already there and the claim is written on the customer's own record.
 *
 * @throws OfferCodeError when the code is empty, unknown, for an ended offer, or already applied.
 */
export async function applyOfferCode(args: {
  customer: { offerClaims?: OfferClaim[] };
  offers: readonly Offer[];
  code: string;
  todayYmd: string;
  /** Saves the claim on the customer's record; only used where there is no server to send the code to. */
  saveCustomer: (data: { offerClaims: OfferClaim[] }) => Promise<void>;
}): Promise<Offer> {
  const offerService = services.offers as IOfferService;
  if (offerService.claimCode) return offerService.claimCode(args.code);

  const { offerClaims, offer } = claimOfferCode(args.customer, args.offers, args.code, args.todayYmd);
  await args.saveCustomer({ offerClaims });
  return offer;
}
