import { useEffect, useMemo, useRef } from 'react';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { offersToAnnounce } from '@/src/components/customer/offers/offerCards';
import { notifyOfferAvailable } from '@/src/domain/notifications/events';
import { liveOffersFor } from '@/src/domain/offers/offers';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useNow } from '@/src/hooks/useNow';

/**
 * Tells the signed-in customer about each offer they can use, once: when an offer goes live (or the app opens while it
 * is live) they get one "New offer for you" notification that opens Offers. Offers unlocked by typing a code are not
 * announced — the customer already knows. Renders nothing; mounted once in the customer app.
 */
export function CustomerOfferNotifier() {
  const { customer } = useMyCustomer();
  const offers = useOffers();
  const now = useNow(60_000);
  const today = todayYmd(now);
  const customerId = customer?.id ?? '';

  const toAnnounce = useMemo(
    () => (customer ? offersToAnnounce(liveOffersFor(offers.all, customer, today)) : []),
    [customer, offers.all, today],
  );
  const signature = toAnnounce.map((o) => o.id).join(',');

  // Already asked this session; `notifyOfferAvailable` itself skips offers notified in an earlier one.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!customerId) return;
    for (const offer of toAnnounce) {
      const key = `${customerId}:${offer.id}`;
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      void notifyOfferAvailable({ customerId, offer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for the list of offers
  }, [customerId, signature]);

  return null;
}
