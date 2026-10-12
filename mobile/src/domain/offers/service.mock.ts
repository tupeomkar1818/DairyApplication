import type { Offer } from '@/src/domain/offers/entities';
import type { IOfferService } from '@/src/domain/offers/service.interface';
import { deleteOffer, loadOffers, saveOffer } from '@/src/infrastructure/offersStore';

/**
 * Offers kept on this phone (`offersStore`), the way the app has always run. Adding and editing are the same write
 * here: the phone keeps the id the admin screen made.
 *
 * There is no `claimCode`: without a server, a typed code is checked against the offers the phone already has and
 * written on the customer's own record.
 */
export class OfferServiceMock implements IOfferService {
  async list(): Promise<Offer[]> {
    return loadOffers();
  }

  async create(offer: Offer): Promise<Offer> {
    return saveOffer(offer);
  }

  async update(id: string, offer: Offer): Promise<Offer> {
    return saveOffer({ ...offer, id });
  }

  async delete(id: string): Promise<void> {
    await deleteOffer(id);
  }
}
