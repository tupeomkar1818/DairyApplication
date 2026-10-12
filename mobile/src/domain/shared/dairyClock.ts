/**
 * India Standard Time, for the one thing fixed to the dairy's clock: the 6 pm IST order reminder.
 *
 * Everything else follows the phone's own clock and time zone. These helpers turn "6 pm IST on a day" into a single
 * instant, which each phone then shows in its local time. IST has no daylight saving, so a fixed offset is exact.
 */

import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

export const DAIRY_TIME_ZONE = 'Asia/Kolkata';

/** UTC+5:30. */
export const DAIRY_UTC_OFFSET_MINUTES = 330;

const OFFSET_MS = DAIRY_UTC_OFFSET_MINUTES * 60_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The wall-clock reading in IST at this instant. */
export function dairyClockParts(now: Date = new Date()): { ymd: string; hour: number; minute: number } {
  const ist = new Date(now.getTime() + OFFSET_MS);
  return {
    ymd: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}

/** Today's date in IST (YYYY-MM-DD). */
export function dairyTodayYmd(now: Date = new Date()): string {
  return dairyClockParts(now).ymd;
}

/**
 * The instant it is `hour:minute` IST on `ymd`. `dayOffset` moves the calendar day first (-1 for "the evening
 * before"), rolling over months and years.
 */
export function dairyInstant(ymd: string, hour: number, minute = 0, dayOffset = 0): Date {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d + dayOffset, hour, minute, 0, 0) - OFFSET_MS);
}

/** "6 pm" / "9 pm" / "11:30 am" for an IST hour ("संध्याकाळी 6" in Marathi). */
export function dairyTimeLabel(hour: number, minute = 0, lang?: Lang): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return strings('common', lang).dates.time(`${h12}${minute ? `:${pad(minute)}` : ''}`, hour);
}
