import type { Offer } from '@/src/domain/offers/entities';

/**
 * The dairy's offers, wherever they are kept — on this phone, or on the dairy's server.
 *
 * All three apps read offers; only the admin app writes them. `claimCode` is the one write a customer makes: it
 * hands over the code they typed, which is why a coded offer never has to travel in a list anybody else can read.
 */
export interface IOfferService {
  /** GET /offers — every offer the signed-in person may see. */
  list(): Promise<Offer[]>;

  /** POST /offers. Admin only. The answer carries the offer's id, which may not be the one that was sent. */
  create(offer: Offer): Promise<Offer>;

  /**
   * PATCH /offers/:id. Admin only. An offer that has started takes only new wording, a new poster, a new last day
   * and being ended — the rest is kept, so the bills that counted it stay as they were.
   */
  update(id: string, offer: Offer): Promise<Offer>;

  /** DELETE /offers/:id. Only an offer that never started; a started one is ended instead. */
  delete(id: string): Promise<void>;

  /**
   * POST /offers/claim — the customer typed a code.
   *
   * Only where the dairy's server keeps the offers. On a phone keeping its own records the code is checked against
   * the offers already there and written on the customer's record instead (both in `applyOfferCode`).
   *
   * @throws OfferCodeError when the code is empty, unknown, for an ended offer, or already applied.
   */
  claimCode?(code: string): Promise<Offer>;
}
