/**
 * The dairy's live offers, read in the visitor's browser from the dairy's server.
 *
 * The server answers with the offers running today that need no code (`server/src/offers/routes.ts`), so an offer
 * the dairy starts or ends appears and disappears here on its own — nothing to upload. The shape is the one the
 * app defines in `mobile/src/domain/offers/websiteFeed.ts` (and `OfferText` / `OfferDiscountRule` in
 * `mobile/src/domain/offers/entities.ts`). Keep these types and `OFFERS_VERSION` in step with it: an answer with
 * another version is ignored and the Offers section stays hidden.
 */

import type { Dictionary, Lang } from '../i18n/ui';

/** Version of the offers file this website understands. */
export const OFFERS_VERSION = 1;

/**
 * Where the offers come from: the dairy's server. `PUBLIC_OFFERS_URL` at build time points the site somewhere else
 * — another server, or `/offers.json` to go back to a file uploaded with the site (see the README).
 */
export const OFFERS_URL: string =
  import.meta.env.PUBLIC_OFFERS_URL || 'https://amrale-dairy-api.amrale-dairy-website.workers.dev/public/offers.json';

export type OfferKind = 'price' | 'combo' | 'bill' | 'subscription';

/** Wording written once per language; Marathi falls back to English when left empty. */
export type OfferText = { en: string; mr?: string };

export type OfferDiscountRule =
  | { type: 'percent'; value: number; /** Largest discount on one month's bill. */ maxDiscount?: number }
  | { type: 'flat'; value: number };

export type WebsiteOffer = {
  id: string;
  kind: OfferKind;
  title: OfferText;
  description?: OfferText;
  /** First day shown (YYYY-MM-DD, India time). */
  startYmd: string;
  /** Last day shown (inclusive); open-ended when omitted. */
  endYmd?: string;
  priceItems?: { productName: string; packLabel: string; listPrice: number; offerPrice: number }[];
  /** `price`: also lowers regular subscription deliveries. */
  includeRegular?: boolean;
  combo?: { items: { productName: string; packLabel: string; quantity: number }[]; price: number; listTotal: number };
  discount?: OfferDiscountRule;
  /** `subscription`: only these products (all when omitted). */
  rewardProducts?: string[];
  minPacksPerDay?: number;
};

export type WebsiteOffersFeed = {
  version: typeof OFFERS_VERSION;
  generatedAt: string;
  offers: WebsiteOffer[];
};

export type OfferStrings = Dictionary['offers'];

const KINDS: readonly OfferKind[] = ['price', 'combo', 'bill', 'subscription'];
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ---------------------------------------------------------------------------------------------------------------
// Reading the file
// ---------------------------------------------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function text(v: unknown): OfferText | undefined {
  if (!isObject(v)) return undefined;
  const en = str(v.en);
  if (!en) return undefined;
  const mr = str(v.mr);
  return mr ? { en, mr } : { en };
}

function discount(v: unknown): OfferDiscountRule | undefined {
  if (!isObject(v)) return undefined;
  const value = num(v.value);
  if (value === undefined || value <= 0) return undefined;
  if (v.type === 'flat') return { type: 'flat', value };
  if (v.type !== 'percent') return undefined;
  const max = num(v.maxDiscount);
  return max !== undefined && max >= 0 ? { type: 'percent', value, maxDiscount: max } : { type: 'percent', value };
}

/** One offer from the file, or null when it is not usable (unknown kind, no title, bad dates). */
function parseOffer(v: unknown): WebsiteOffer | null {
  if (!isObject(v)) return null;
  const id = str(v.id);
  const kind = v.kind as OfferKind;
  const title = text(v.title);
  const startYmd = str(v.startYmd);
  const endYmd = str(v.endYmd);
  if (!id || !KINDS.includes(kind) || !title || !YMD.test(startYmd)) return null;
  if (endYmd && (!YMD.test(endYmd) || endYmd < startYmd)) return null;

  const offer: WebsiteOffer = { id, kind, title, startYmd };
  const description = text(v.description);
  if (description) offer.description = description;
  if (endYmd) offer.endYmd = endYmd;

  if (kind === 'price' && Array.isArray(v.priceItems)) {
    offer.priceItems = v.priceItems.flatMap((i) => {
      if (!isObject(i)) return [];
      const listPrice = num(i.listPrice);
      const offerPrice = num(i.offerPrice);
      const productName = str(i.productName);
      if (!productName || listPrice === undefined || offerPrice === undefined || offerPrice < 0) return [];
      return [{ productName, packLabel: str(i.packLabel), listPrice, offerPrice }];
    });
    if (v.includeRegular === true) offer.includeRegular = true;
  }

  if (kind === 'combo' && isObject(v.combo)) {
    const price = num(v.combo.price);
    const items = Array.isArray(v.combo.items)
      ? v.combo.items.flatMap((i) => {
          if (!isObject(i)) return [];
          const productName = str(i.productName);
          const quantity = num(i.quantity);
          if (!productName) return [];
          return [{ productName, packLabel: str(i.packLabel), quantity: quantity && quantity > 0 ? quantity : 1 }];
        })
      : [];
    if (price !== undefined && price > 0) offer.combo = { items, price, listTotal: num(v.combo.listTotal) ?? 0 };
  }

  if (kind === 'bill' || kind === 'subscription') {
    const rule = discount(v.discount);
    if (rule) offer.discount = rule;
  }

  if (kind === 'subscription') {
    if (Array.isArray(v.rewardProducts)) {
      const names = v.rewardProducts.map(str).filter(Boolean);
      if (names.length) offer.rewardProducts = names;
    }
    const minPacks = num(v.minPacksPerDay);
    if (minPacks !== undefined && minPacks > 0) offer.minPacksPerDay = Math.floor(minPacks);
  }

  return offer;
}

/** The offers file, checked: null when it is not a version this site understands. Broken offers are left out. */
export function parseOffersFeed(data: unknown): WebsiteOffersFeed | null {
  if (!isObject(data) || data.version !== OFFERS_VERSION || !Array.isArray(data.offers)) return null;
  const offers = data.offers.map(parseOffer).filter((o): o is WebsiteOffer => o !== null);
  return { version: OFFERS_VERSION, generatedAt: str(data.generatedAt), offers };
}

// ---------------------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------------------

/** Today's date in India (YYYY-MM-DD), whatever the visitor's own time zone. India is UTC+5:30 all year. */
export function indiaTodayYmd(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** True from the offer's first day through its last day (every day from the first when it has no last day). */
export function isLiveOn(offer: Pick<WebsiteOffer, 'startYmd' | 'endYmd'>, todayYmd: string): boolean {
  return offer.startYmd <= todayYmd && (!offer.endYmd || todayYmd <= offer.endYmd);
}

/** The offers to show today, in the file's order. */
export function liveOffers(feed: WebsiteOffersFeed | null, todayYmd: string): WebsiteOffer[] {
  return feed ? feed.offers.filter((o) => isLiveOn(o, todayYmd)) : [];
}

/** "15 Oct" / "15 ऑक्टो"; the year is added when it is not this year. */
export function formatDay(ymd: string, strings: Pick<OfferStrings, 'months'>, todayYmd: string): string {
  const [y, m, d] = ymd.split('-');
  const day = `${Number(d)} ${strings.months[Number(m) - 1] ?? m}`;
  return y === todayYmd.slice(0, 4) ? day : `${day} ${y}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------------------------------------------

/** The text in `lang`, English when the Marathi was left empty. */
export function offerTitle(value: OfferText | undefined, lang: Lang): string {
  if (!value) return '';
  const own = lang === 'mr' ? str(value.mr) : '';
  return own || str(value.en);
}

/** A plain number with at most 2 decimals and no trailing zeros ("7.5"). */
function plainNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** ₹ with Indian grouping and English digits in both languages: ₹1,25,000 · ₹32.50. */
export function formatMoney(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const whole = Math.floor(rounded);
  const paise = Math.round((rounded - whole) * 100);
  const digits = String(whole);
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${amount < 0 ? '-' : ''}₹${grouped}${paise ? `.${String(paise).padStart(2, '0')}` : ''}`;
}

function fillIn(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? values[key] : m));
}

function packName(productName: string, packLabel: string): string {
  return packLabel ? `${productName} · ${packLabel}` : productName;
}

export type OfferPriceLine = {
  /** "Shrikhand · 500 g" */
  name: string;
  /** Normal price, shown struck ("₹180"); absent when the offer price is not lower. */
  was?: string;
  /** "₹160" */
  now: string;
  /** "Save ₹20" */
  save?: string;
  /** "₹180 → ₹160" */
  change: string;
};

/** Everything an offer card says, in one language. Empty parts are left out. */
export type OfferDisplay = {
  id: string;
  kind: OfferKind;
  kindLabel: string;
  title: string;
  description?: string;
  priceLines: OfferPriceLine[];
  regularNote?: string;
  combo?: {
    heading: string;
    items: string[];
    /** "Worth ₹850", struck. */
    worth?: string;
    price: string;
    save?: string;
  };
  /** "10% off your monthly bill, up to ₹100" */
  discount?: string;
  /** "On Milk, Curd · On days you take 2 or more packs" */
  conditions: string[];
  /** "Valid till 15 Oct" or "Last day today"; absent for an offer without a last day. */
  validity?: string;
  /** Opening WhatsApp message naming the offer. */
  whatsappMessage: string;
};

export function describeOffer(offer: WebsiteOffer, lang: Lang, strings: OfferStrings, todayYmd: string): OfferDisplay {
  const title = offerTitle(offer.title, lang);
  const display: OfferDisplay = {
    id: offer.id,
    kind: offer.kind,
    kindLabel: strings.kinds[offer.kind],
    title,
    priceLines: [],
    conditions: [],
    whatsappMessage: fillIn(strings.whatsapp, { title }),
  };

  const description = offerTitle(offer.description, lang);
  if (description) display.description = description;

  if (offer.kind === 'price') {
    display.priceLines = (offer.priceItems ?? []).map((i) => {
      const now = formatMoney(i.offerPrice);
      const lower = i.listPrice > i.offerPrice;
      const line: OfferPriceLine = {
        name: packName(i.productName, i.packLabel),
        now,
        change: lower ? `${formatMoney(i.listPrice)} → ${now}` : now,
      };
      if (lower) {
        line.was = formatMoney(i.listPrice);
        line.save = fillIn(strings.save, { amount: formatMoney(i.listPrice - i.offerPrice) });
      }
      return line;
    });
    if (offer.includeRegular) display.regularNote = strings.regularToo;
  }

  if (offer.kind === 'combo' && offer.combo) {
    const { items, price, listTotal } = offer.combo;
    const lower = listTotal > price;
    display.combo = {
      heading: strings.inCombo,
      items: items.map((i) => `${packName(i.productName, i.packLabel)} × ${plainNumber(i.quantity)}`),
      price: formatMoney(price),
    };
    if (lower) {
      display.combo.worth = fillIn(strings.worth, { amount: formatMoney(listTotal) });
      display.combo.save = fillIn(strings.save, { amount: formatMoney(listTotal - price) });
    }
  }

  if ((offer.kind === 'bill' || offer.kind === 'subscription') && offer.discount) {
    const d = offer.discount;
    const perPack = offer.kind === 'subscription';
    let line =
      d.type === 'percent'
        ? fillIn(perPack ? strings.packPercent : strings.billPercent, { percent: plainNumber(d.value) })
        : fillIn(perPack ? strings.packFlat : strings.billFlat, { amount: formatMoney(d.value) });
    if (d.type === 'percent' && d.maxDiscount !== undefined && d.maxDiscount > 0) {
      line = fillIn(perPack ? strings.upToMonth : strings.upTo, { text: line, amount: formatMoney(d.maxDiscount) });
    }
    display.discount = line;
  }

  if (offer.kind === 'subscription') {
    if (offer.rewardProducts?.length) {
      display.conditions.push(fillIn(strings.onProducts, { products: offer.rewardProducts.join(strings.listJoin) }));
    }
    if (offer.minPacksPerDay && offer.minPacksPerDay > 1) {
      display.conditions.push(fillIn(strings.minPacks, { count: String(offer.minPacksPerDay) }));
    }
  }

  if (offer.endYmd) {
    display.validity =
      offer.endYmd === todayYmd ? strings.lastDay : fillIn(strings.validTill, { date: formatDay(offer.endYmd, strings, todayYmd) });
  }

  return display;
}
