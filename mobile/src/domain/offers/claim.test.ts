import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Offer, OfferClaim } from '@/src/domain/offers/entities';
import { OfferCodeError } from '@/src/domain/offers/offers';

/** Set per test: with `claimCode` the dairy's server is answering, without it the phone keeps its own offers. */
let offerService: { claimCode?: (code: string) => Promise<Offer> } = {};

vi.mock('@/src/infrastructure/service-registry', () => ({
  services: {
    get offers() {
      return offerService;
    },
  },
}));

const { applyOfferCode } = await import('@/src/domain/offers/claim');

const TS = '2026-10-01T00:00:00.000Z';

const coded: Offer = {
  id: 'offer_box',
  kind: 'combo',
  title: { en: 'Festival box' },
  startYmd: '2026-10-01',
  endYmd: '2026-10-31',
  code: 'DIWALI50',
  comboItems: [],
  comboPrice: 499,
  createdAt: TS,
  updatedAt: TS,
};

describe('applying a code on a phone that keeps its own offers', () => {
  let saved: { offerClaims: OfferClaim[] } | null;
  const saveCustomer = async (data: { offerClaims: OfferClaim[] }) => {
    saved = data;
  };

  beforeEach(() => {
    offerService = {};
    saved = null;
  });

  it('writes the claim on the customer’s record and gives back the offer', async () => {
    const offer = await applyOfferCode({
      customer: { offerClaims: [] },
      offers: [coded],
      code: ' diwali 50 ',
      todayYmd: '2026-10-12',
      saveCustomer,
    });

    expect(offer.id).toBe('offer_box');
    expect(saved?.offerClaims).toEqual([{ offerId: 'offer_box', code: 'DIWALI50', claimedAt: expect.any(String) }]);
  });

  it('says what is wrong with a code, and saves nothing', async () => {
    await expect(
      applyOfferCode({ customer: { offerClaims: [] }, offers: [coded], code: 'NOPE', todayYmd: '2026-10-12', saveCustomer }),
    ).rejects.toBeInstanceOf(OfferCodeError);
    expect(saved).toBeNull();
  });
});

describe('applying a code where the dairy’s server keeps the offers', () => {
  beforeEach(() => {
    offerService = {};
  });

  it('sends the code to the server, and leaves the record to it', async () => {
    const claimCode = vi.fn(async () => coded);
    offerService = { claimCode };
    const saveCustomer = vi.fn();

    const offer = await applyOfferCode({
      customer: { offerClaims: [] },
      // The app has not been given this offer: only the server knows the code.
      offers: [],
      code: 'DIWALI50',
      todayYmd: '2026-10-12',
      saveCustomer,
    });

    expect(offer.id).toBe('offer_box');
    expect(claimCode).toHaveBeenCalledWith('DIWALI50');
    expect(saveCustomer).not.toHaveBeenCalled();
  });
});
