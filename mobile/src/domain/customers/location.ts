/**
 * Where a customer lives, as the delivery boy needs it: a readable address, a pin when one is known, and Google Maps
 * directions from wherever the delivery boy is standing.
 *
 * Directions links leave the start point out on purpose: Google Maps then starts from the phone's current location,
 * with no location permission needed by this app.
 */

import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

export type CustomerGeoLocation = {
  latitude: number;
  longitude: number;
  /** Who dropped the pin: the admin from a pasted map link, or the delivery boy standing at the door. */
  source: 'admin' | 'delivery';
  updatedAt: string;
};

type AddressParts = {
  houseFlatNumber?: string;
  societyName?: string;
  streetArea?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  address?: string;
};

type LocatableCustomer = AddressParts & {
  geoLocation?: CustomerGeoLocation;
  mapLink?: string;
};

function clean(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * "B-204, Green View, Karve Road, Near Petrol Pump, Pune 411038" — each part once, in delivery order. The word around
 * the landmark follows the app language (`lang`, default: the chosen one).
 */
export function formatCustomerAddress(c: AddressParts, lang?: Lang): string {
  const parts: string[] = [];
  const push = (value: unknown, wrap: (text: string) => string = (text) => text) => {
    const text = clean(value);
    if (!text) return;
    const line = wrap(text);
    if (!parts.some((p) => p.toLowerCase().includes(text.toLowerCase()))) parts.push(line);
  };
  push(c.houseFlatNumber);
  push(c.societyName);
  push(c.streetArea);
  // The older single-line address often repeats the flat and society, so each comma part is checked on its own.
  for (const piece of clean(c.address).split(',')) push(piece);
  // A landmark that already says "near" (in either language) is kept as typed.
  const saysNear = /^near\b/i.test(clean(c.landmark)) || /जवळ/.test(clean(c.landmark));
  push(c.landmark, saysNear ? undefined : strings('customers', lang).location.near);
  // City and pincode are left out one by one when the address line already carries them ("…, Pune, 411038").
  const seen = (text: string) => parts.some((p) => p.toLowerCase().includes(text.toLowerCase()));
  push([clean(c.city), clean(c.pincode)].filter((t) => t && !seen(t)).join(' '));
  return parts.join(', ');
}

function validCoords(latitude: number, longitude: number): { latitude: number; longitude: number } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
}

/**
 * Reads coordinates out of what an admin pastes: "18.5035, 73.8138", or a Google Maps link in any of its long forms
 * (…/@18.50,73.81,17z, ?q=18.50,73.81, ?ll=…, …!3d18.50!4d73.81). Short share links (maps.app.goo.gl) carry no
 * coordinates and return null — they are kept as a link instead.
 */
export function parseMapLocation(input: string): { latitude: number; longitude: number } | null {
  const text = decodeURIComponent(String(input ?? '').trim());
  if (!text) return null;
  const pair = (a?: string, b?: string) => (a && b ? validCoords(Number(a), Number(b)) : null);
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';

  const plain = text.match(new RegExp(`^${num}\\s*,\\s*${num}$`));
  if (plain) return pair(plain[1], plain[2]);

  const pin = text.match(new RegExp(`!3d${num}!4d${num}`));
  if (pin) return pair(pin[1], pin[2]);

  const query = text.match(new RegExp(`[?&](?:q|query|ll|destination|daddr)=(?:loc:)?${num}\\s*,\\s*${num}`));
  if (query) return pair(query[1], query[2]);

  const at = text.match(new RegExp(`@${num},${num}`));
  if (at) return pair(at[1], at[2]);

  return null;
}

/** An http(s) link worth keeping even when it has no readable coordinates (a short share link). */
export function isMapLink(input: string): boolean {
  return /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(input ?? '').trim());
}

/** What Google Maps should head for: the pin when there is one, otherwise the written address. */
export function mapDestination(c: LocatableCustomer): string | null {
  if (c.geoLocation) return `${c.geoLocation.latitude},${c.geoLocation.longitude}`;
  const fromLink = c.mapLink ? parseMapLocation(c.mapLink) : null;
  if (fromLink) return `${fromLink.latitude},${fromLink.longitude}`;
  // Google Maps searches the written address, so it always gets the English wording.
  const address = formatCustomerAddress(c, 'en');
  return address || null;
}

/** Google Maps directions from the current location to one customer. */
export function directionsUrl(c: LocatableCustomer): string | null {
  const destination = mapDestination(c);
  if (!destination) {
    // A short share link is still better than nothing: it opens the place, with its own Directions button.
    return c.mapLink && isMapLink(c.mapLink) ? c.mapLink : null;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** Google Maps allows a destination plus up to nine stops on the way in one link. */
export const MAX_ROUTE_STOPS = 10;

/**
 * One route from the current location through several customers, in the order given — the last one is the
 * destination. Customers without any address are skipped; only the first ten are routed.
 */
export function routeUrl(customers: readonly LocatableCustomer[]): { url: string; stops: number } | null {
  const destinations = customers.map(mapDestination).filter((d): d is string => !!d).slice(0, MAX_ROUTE_STOPS);
  if (!destinations.length) return null;
  const destination = destinations[destinations.length - 1]!;
  const waypoints = destinations.slice(0, -1);
  const params = [
    'api=1',
    `destination=${encodeURIComponent(destination)}`,
    waypoints.length ? `waypoints=${encodeURIComponent(waypoints.join('|'))}` : null,
    'travelmode=driving',
  ].filter(Boolean);
  return { url: `https://www.google.com/maps/dir/?${params.join('&')}`, stops: destinations.length };
}
