/** Small helpers every area uses: ids, timestamps, and moving the app's own fields in and out of `details_json`. */

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The dairy's own day, whatever time zone the server thinks it is in.
 *
 * Everything dated — an offer, a round, a counter sale — is dated by the day it happened in Kothrud, not in UTC.
 * A sale at eight in the evening is still that evening, not tomorrow morning.
 */
export function todayInIndia(): string {
  return new Date(Date.now() + 5.5 * 60 * 60_000).toISOString().slice(0, 10);
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function boolToDb(value: boolean | undefined, fallback = false): number {
  return (value ?? fallback) ? 1 : 0;
}

export function dbToBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== 'string' || !text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Everything in `record` that has no column of its own, ready for `details_json`. `undefined` is dropped (the app
 * leaves a field out when it has no value), so a round trip gives back the same record.
 */
export function detailsOf(record: Record<string, unknown>, columnKeys: readonly string[]): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (columnKeys.includes(key) || value === undefined) continue;
    rest[key] = value;
  }
  return rest;
}

/** A patch's value when it was sent, the stored one when it was left out. */
export function pick<T>(patched: T | undefined, current: T): T {
  return patched === undefined ? current : patched;
}
