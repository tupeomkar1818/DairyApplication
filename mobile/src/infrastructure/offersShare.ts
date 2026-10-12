import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { WEBSITE_OFFERS_FILE_NAME, type WebsiteOffersFeed } from '@/src/domain/offers/websiteFeed';
import { strings } from '@/src/i18n/strings';

/**
 * Hands the website offers file (`offers.json`) to the system share sheet from a phone, so the admin can send it to
 * whoever uploads the website (WhatsApp, email, Files, Drive …). `offersShare.web.ts` downloads it instead.
 */
export async function shareWebsiteOffersFile(feed: WebsiteOffersFeed): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(strings('offerAdmin').website.notAvailable);
  }
  const file = new File(Paths.cache, WEBSITE_OFFERS_FILE_NAME);
  if (file.exists) file.delete();
  file.create();
  file.write(`${JSON.stringify(feed, null, 2)}\n`);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: strings('offerAdmin').website.title,
  });
}
