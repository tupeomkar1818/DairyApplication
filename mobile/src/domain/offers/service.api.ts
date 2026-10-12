import type { Offer } from '@/src/domain/offers/entities';
import { OfferCodeError, type OfferCodeProblem } from '@/src/domain/offers/offers';
import type { IOfferService } from '@/src/domain/offers/service.interface';
import { DomainError } from '@/src/domain/shared/errors';
import { api } from '@/src/infrastructure/api/client';

/**
 * Offers from the dairy's server, so an offer the admin starts or ends reaches every phone.
 *
 * The server holds to the rules bills depend on: an offer that has started cannot be re-priced or deleted, a code
 * belongs to one offer, and an offer's first day is never moved into the past.
 */

/** The server's wording for what is wrong with a typed code, as the customer screen's own problem. */
const CODE_PROBLEMS: Record<string, OfferCodeProblem> = {
  OFFER_CODE_EMPTY: 'empty',
  OFFER_CODE_UNKNOWN: 'unknown',
  OFFER_CODE_ENDED: 'ended',
  OFFER_CODE_ALREADY_APPLIED: 'alreadyApplied',
};

export class OfferServiceApi implements IOfferService {
  async list(): Promise<Offer[]> {
    const answer = await api.get<{ items: Offer[] }>('/offers');
    return answer.items ?? [];
  }

  async create(offer: Offer): Promise<Offer> {
    return api.post<Offer>('/offers', offer);
  }

  async update(id: string, offer: Offer): Promise<Offer> {
    return api.patch<Offer>(`/offers/${encodeURIComponent(id)}`, offer);
  }

  async delete(id: string): Promise<void> {
    await api.delete<void>(`/offers/${encodeURIComponent(id)}`);
  }

  /** The server looks the code up, so the apps never carry a coded offer the customer has not unlocked. */
  async claimCode(code: string): Promise<Offer> {
    try {
      const answer = await api.post<{ offer: Offer }>('/offers/claim', { code });
      return answer.offer;
    } catch (error) {
      const problem = error instanceof DomainError ? CODE_PROBLEMS[error.code] : undefined;
      if (problem) throw new OfferCodeError(problem);
      throw error;
    }
  }
}
