import { WEBSITE_OFFERS_FILE_NAME, type WebsiteOffersFeed } from '@/src/domain/offers/websiteFeed';

/** Web: the website offers file downloads as `offers.json`. */
export async function shareWebsiteOffersFile(feed: WebsiteOffersFeed): Promise<void> {
  const blob = new Blob([`${JSON.stringify(feed, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = WEBSITE_OFFERS_FILE_NAME;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
