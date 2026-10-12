/**
 * Date maths for the shared date picker. Kept free of React Native imports so it can be unit tested.
 *
 * Every value is a local calendar day: DD/MM/YYYY is what the forms store, YYYY-MM-DD is what the calendar speaks.
 */

export const PICKER_MIN_YEAR = 1950;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** DD/MM/YYYY or YYYY-MM-DD → the local day, or null for anything that is not a real calendar date (31/02/2026). */
export function parsePickerDate(value: string | null | undefined): Date | null {
  const v = String(value ?? '').trim();
  let dd: number;
  let mm: number;
  let yyyy: number;
  const dmy = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const ymd = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dmy) {
    dd = Number(dmy[1]);
    mm = Number(dmy[2]);
    yyyy = Number(dmy[3]);
  } else if (ymd) {
    yyyy = Number(ymd[1]);
    mm = Number(ymd[2]);
    dd = Number(ymd[3]);
  } else {
    return null;
  }
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

export function toDdMmYyyy(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The newest year the picker lists: this year plus `yearsAhead` (0 for a date of birth). */
export function pickerMaxYear(yearsAhead: number, now: Date = new Date()): number {
  return now.getFullYear() + Math.max(0, Math.floor(yearsAhead));
}

/**
 * First day of the month the picker opens on: the value's month, else the fallback's, else this month — always a
 * valid date inside [minYear, maxYear], so the calendar never receives an invalid `current`.
 */
export function pickerStartMonth(
  value: string | null | undefined,
  fallback: Date | null | undefined,
  minYear: number,
  maxYear: number,
  now: Date = new Date(),
): Date {
  const valid = (d: Date | null | undefined): d is Date => !!d && !Number.isNaN(d.getTime());
  const picked = parsePickerDate(value);
  const base = valid(picked) ? picked : valid(fallback) ? fallback : now;
  const year = Math.min(maxYear, Math.max(minYear, base.getFullYear()));
  return new Date(year, year === base.getFullYear() ? base.getMonth() : 0, 1);
}

/** Years for the year list, newest first. */
export function pickerYears(minYear: number, maxYear: number): number[] {
  const out: number[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) out.push(y);
  return out;
}
