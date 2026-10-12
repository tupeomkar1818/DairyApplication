/**
 * How dates and money read across the admin, delivery and customer apps — one wording everywhere, so "16 Sep" in
 * a notification is "16 Sep" on the bill and on the run sheet.
 *
 * Dates are day-first (Indian usage) and read on the local calendar: `new Date('yyyy-mm-dd')` would be UTC midnight
 * and show the previous day west of UTC. Month and weekday names are spelled here rather than by the device locale,
 * which varies ("Sep" / "Sept") between phones and browsers — and they follow the app language (English or Marathi),
 * not the phone's. Each function takes an optional `lang`; it defaults to the language chosen in the app.
 */

import { getLanguage, type Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

function localDate(ymd: string): Date | null {
  const m = String(ymd ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "16 Sep", "Wed, 16 Sep", or "16 Sep 2026" with `year`. Returns the input when it is not a yyyy-mm-dd day. */
export function formatDay(ymd: string, options?: { weekday?: boolean; year?: boolean; lang?: Lang }): string {
  const d = localDate(ymd);
  if (!d) return ymd;
  const names = strings('common', options?.lang).dates;
  const day = `${String(d.getDate()).padStart(2, '0')} ${names.monthsShort[d.getMonth()]}`;
  const withYear = options?.year ? `${day} ${d.getFullYear()}` : day;
  return options?.weekday ? `${names.weekdaysShort[d.getDay()]}, ${withYear}` : withYear;
}

/** "September 2026". */
export function formatMonth(yyyyMm: string, lang?: Lang): string {
  const d = localDate(`${String(yyyyMm ?? '').slice(0, 7)}-01`);
  return d ? `${strings('common', lang).dates.monthsLong[d.getMonth()]} ${d.getFullYear()}` : yyyyMm;
}

/** "16 Sep, 7:05 pm" for a timestamp. */
export function formatDateTime(iso: string, lang?: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${strings('common', lang).dates.monthsShort[d.getMonth()]}, ${formatTime(iso, lang)}`;
}

/** "7:05 pm" for a timestamp. */
export function formatTime(iso: string, lang?: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return strings('common', lang).dates.time(`${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`, h);
}

/** "Today", "Yesterday", or "Mon, 14 Sep" (with the year when it is not this year). */
export function formatRelativeDay(ymd: string, now: Date = new Date(), lang: Lang = getLanguage()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymdOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const words = strings('common', lang).dates;
  if (ymd === ymdOf(now)) return words.today;
  if (ymd === ymdOf(yesterday)) return words.yesterday;
  return formatDay(ymd, { weekday: true, year: ymd.slice(0, 4) !== String(now.getFullYear()), lang });
}

/** "₹1,586" — whole rupees with Indian digit grouping (1,23,456). */
export function formatMoney(amount: number | undefined | null): string {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest ? `${rest},${last3}` : last3}`;
}
