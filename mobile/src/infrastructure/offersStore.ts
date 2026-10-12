import type { Offer } from '@/src/domain/offers/entities';
import { OFFER_KINDS } from '@/src/domain/offers/entities';
import { OFFERS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

/**
 * The dairy's offers, one list shared by the admin, customer and delivery apps. Writes are serialized
 * read-modify-write (like announcements), so two saves at the same moment never drop each other.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is Offer =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as Offer).id === 'string' &&
        OFFER_KINDS.includes((r as Offer).kind) &&
        YMD.test(String((r as Offer).startYmd ?? '')),
    )
    .map((r) => ({
      ...r,
      title: { en: String(r.title?.en ?? ''), mr: r.title?.mr ? String(r.title.mr) : undefined },
      endYmd: r.endYmd && YMD.test(r.endYmd) ? r.endYmd : undefined,
    }));
}

export async function loadOffers(): Promise<Offer[]> {
  return sanitize(await readJson<unknown>(OFFERS_STORE_KEY));
}

let queue: Promise<unknown> = Promise.resolve();

function update(updater: (current: Offer[]) => Offer[]): Promise<Offer[]> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadOffers());
      await writeJson(OFFERS_STORE_KEY, next);
      return next;
    });
  queue = run;
  return run;
}

/** Adds an offer, or replaces the one with the same id. */
export async function saveOffer(offer: Offer): Promise<Offer> {
  await update((current) => [offer, ...current.filter((o) => o.id !== offer.id)]);
  return offer;
}

/** Removes an offer. Only for offers that never started — see `canDeleteOffer`. */
export async function deleteOffer(id: string): Promise<void> {
  await update((current) => current.filter((o) => o.id !== id));
}
