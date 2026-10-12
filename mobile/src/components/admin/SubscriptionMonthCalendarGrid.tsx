import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';

import { daysInMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { useStrings } from '@/src/i18n/useStrings';

/** Below this window width the weekday header switches to single letters. */
const NARROW_WEEKDAY_WIDTH = 400;

/** Delivery-tab calendar only: cell fill reflects delivery marking state. */
export type DeliveryDayTone = 'empty' | 'pending' | 'delivered' | 'missed';

export type DeliveryToneSurfaces = Record<
  DeliveryDayTone,
  { light: { backgroundColor: string; borderColor: string }; dark: { backgroundColor: string; borderColor: string } }
>;

export type CalendarCellModel = {
  ymd: string | null;
  isToday: boolean;
  hasProfilePlan: boolean;
  hasCalendarExtra: boolean;
  deliveryTone?: DeliveryDayTone;
};

type Props = {
  monthYyyyMm: string;
  cells: CalendarCellModel[];
  textMain: object;
  textSub: object;
  onPressDay: (ymd: string) => void;
  isDark: boolean;
  /** Subscription: profile/add-on dots + default legend. Delivery: tone fills + optional custom footer. */
  mode?: 'subscription' | 'delivery';
  deliveryToneSurfaces?: DeliveryToneSurfaces;
  legendFooter?: ReactNode;
  /** Highlights the last tapped day (subscription tab mockup). */
  selectedDayYmd?: string | null;
};

export function SubscriptionMonthCalendarGrid({
  monthYyyyMm: _monthYyyyMm,
  cells,
  textMain,
  textSub,
  onPressDay,
  isDark,
  mode = 'subscription',
  deliveryToneSurfaces,
  legendFooter,
  selectedDayYmd = null,
}: Props) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(37,99,235,0.12)';
  const emptyBg = isDark ? 'transparent' : 'transparent';
  const isDelivery = mode === 'delivery' && !!deliveryToneSurfaces;
  // On narrow phones a 1/7 column can't fit "Wed"; use single letters like the attendance calendar.
  const { width: windowWidth } = useWindowDimensions();
  const t = useStrings('subscriptionEditor');
  const dates = useStrings('common').dates;
  const narrowWeekdays = windowWidth < NARROW_WEEKDAY_WIDTH;
  const weekdayLabels = narrowWeekdays ? dates.weekdaysNarrow : dates.weekdaysShort;

  return (
    <View style={styles.wrap}>
      <View style={[styles.weekRow, styles.gridArea]}>
        {weekdayLabels.map((w, i) => (
          <View key={`wd-${i}`} style={styles.weekCell}>
            {/* Narrow letters need no truncation box (its overflow clip shaved the faux-bold "M"/"W"). */}
            <Text variant="labelSmall" style={[textSub, styles.weekLabel]} numberOfLines={narrowWeekdays ? undefined : 1}>
              {w}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.grid, styles.gridArea]}>
        {cells.map((cell, idx) => {
          if (!cell.ymd) {
            return <View key={`e-${idx}`} style={[styles.dayCell, styles.dayCellEmpty, { borderColor: border, backgroundColor: emptyBg }]} />;
          }
          const label = Number(cell.ymd.slice(8, 10));
          const tone = cell.deliveryTone;
          const isSelected = !isDelivery && selectedDayYmd === cell.ymd;
          const toneSurface =
            isDelivery && tone && deliveryToneSurfaces
              ? deliveryToneSurfaces[tone][isDark ? 'dark' : 'light']
              : null;

          return (
            <Pressable
              key={cell.ymd}
              onPress={() => requestAnimationFrame(() => onPressDay(cell.ymd!))}
              style={({ pressed }) => [
                styles.dayCell,
                toneSurface
                  ? {
                      borderColor: cell.isToday ? '#2563EB' : toneSurface.borderColor,
                      borderWidth: cell.isToday ? 2 : 1,
                      backgroundColor: toneSurface.backgroundColor,
                      opacity: pressed ? 0.85 : 1,
                    }
                  : {
                      borderColor: isSelected ? '#0055c7' : cell.isToday ? '#2563EB' : border,
                      borderWidth: isSelected || cell.isToday ? 2 : 1,
                      backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
                      opacity: pressed ? 0.85 : 1,
                    },
              ]}
            >
              <Text variant="labelLarge" style={[textMain, styles.dayNum]}>
                {label}
              </Text>
              {!isDelivery ? (
                <View style={styles.dots}>
                  <View style={[styles.dot, { backgroundColor: '#2563EB', opacity: cell.hasProfilePlan ? 1 : 0.2 }]} />
                  <View style={[styles.dot, { backgroundColor: '#22C55E', opacity: cell.hasCalendarExtra ? 1 : 0.2 }]} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        {legendFooter != null ? (
          legendFooter
        ) : (
          <Text variant="bodySmall" style={textSub}>
            {t.calendar.defaultLegend}
          </Text>
        )}
      </View>
    </View>
  );
}

export const MemoizedSubscriptionMonthCalendarGrid = memo(SubscriptionMonthCalendarGrid);

/** Build cell array including leading/trailing blanks for a 6×7 grid. */
export function buildCalendarCells(
  monthYyyyMm: string,
  todayYmd: string,
  hasProfile: (ymd: string) => boolean,
  hasExtra: (ymd: string) => boolean,
  getDeliveryTone?: (ymd: string) => DeliveryDayTone,
): CalendarCellModel[] {
  const m = monthYyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const firstDow = new Date(y, mo - 1, 1).getDay();
  const dim = daysInMonth(monthYyyyMm);
  const cells: CalendarCellModel[] = [];
  for (let i = 0; i < firstDow; i += 1) {
    cells.push({ ymd: null, isToday: false, hasProfilePlan: false, hasCalendarExtra: false });
  }
  for (let d = 1; d <= dim; d += 1) {
    const ymd = `${monthYyyyMm}-${String(d).padStart(2, '0')}`;
    cells.push({
      ymd,
      isToday: ymd === todayYmd,
      hasProfilePlan: hasProfile(ymd),
      hasCalendarExtra: hasExtra(ymd),
      ...(getDeliveryTone ? { deliveryTone: getDeliveryTone(ymd) } : {}),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, isToday: false, hasProfilePlan: false, hasCalendarExtra: false });
  }
  while (cells.length < 42) {
    cells.push({ ymd: null, isToday: false, hasProfilePlan: false, hasCalendarExtra: false });
  }
  return cells;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { width: `${100 / 7}%`, alignItems: 'center' },
  weekLabel: { fontWeight: '800', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  /**
   * Caps the week header + day grid on tablets/desktops (centered) so cells stay ~80px wide instead of stretching to
   * ~190px on a 1440px screen; phones (< 560px of card width) are unaffected.
   */
  // width 100% matters: with only maxWidth + alignSelf:center the weekday row shrank to its labels and bunched up.
  gridArea: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    maxHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCellEmpty: { borderWidth: 0, maxHeight: 64, marginBottom: 6 },
  dayNum: { fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { marginTop: 4 },
});
