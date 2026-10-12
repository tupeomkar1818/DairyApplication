import { shiftYmd } from '@/src/components/admin/dashboardMetrics';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

/**
 * How far ahead a delivery partner sees orders: today and tomorrow (so tomorrow's load can be planned), never later —
 * days further out can still change, and the customer's evening cut-off is what fixes tomorrow.
 * Only days that have come can be marked delivered or not delivered.
 */

/** The last day a delivery partner can open: tomorrow. */
export function lastVisibleDeliveryDay(todayYmd: string): string {
  return shiftYmd(todayYmd, 1);
}

export function isVisibleDeliveryDay(ymd: string, todayYmd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd <= lastVisibleDeliveryDay(todayYmd);
}

/** A day can be marked once it has arrived; tomorrow is for planning only. */
export function canMarkDeliveryDay(ymd: string, todayYmd: string): boolean {
  return ymd <= todayYmd;
}

/** The evening cut-off for tomorrow's changes in the app language: "9 pm" / "रात्री 9". */
export { orderCutoffLabel } from '@/src/domain/customers/daySchedule';

/** "Sep 2026" for a yyyy-mm month, in the app language. Returns the input when it is not a month. */
export function deliveryMonthLabel(yyyyMm: string, lang?: Lang): string {
  const m = String(yyyyMm ?? '').match(/^(\d{4})-(\d{2})$/);
  const name = m ? strings('common', lang).dates.monthsShort[Number(m[2]) - 1] : undefined;
  return m && name ? `${name} ${m[1]}` : yyyyMm;
}

/** A linked day (e.g. from a notification) if it is within reach, otherwise today. */
export function deliveryDayOrToday(ymd: string | undefined, todayYmd: string): string {
  return ymd && isVisibleDeliveryDay(ymd, todayYmd) ? ymd : todayYmd;
}
