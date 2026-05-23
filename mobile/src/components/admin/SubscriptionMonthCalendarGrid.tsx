import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { daysInMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
}: Props) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(37,99,235,0.12)';
  const emptyBg = isDark ? 'transparent' : 'transparent';
  const isDelivery = mode === 'delivery' && !!deliveryToneSurfaces;

  return (
    <View style={styles.wrap}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.weekCell}>
            <Text variant="labelSmall" style={[textSub, styles.weekLabel]} numberOfLines={1}>
              {w}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (!cell.ymd) {
            return <View key={`e-${idx}`} style={[styles.dayCell, styles.dayCellEmpty, { borderColor: border, backgroundColor: emptyBg }]} />;
          }
          const label = Number(cell.ymd.slice(8, 10));
          const tone = cell.deliveryTone;
          const toneSurface =
            isDelivery && tone && deliveryToneSurfaces
              ? deliveryToneSurfaces[tone][isDark ? 'dark' : 'light']
              : null;

          return (
            <Pressable
              key={cell.ymd}
              onPress={() => onPressDay(cell.ymd!)}
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
                      borderColor: cell.isToday ? '#2563EB' : border,
                      borderWidth: cell.isToday ? 2 : 1,
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
            Base online catalog applies every day. Blue: profile line on that date · Green: saved day order and/or calendar add-on (tap a date to view or edit)
          </Text>
        )}
      </View>
    </View>
  );
}

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
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    maxHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayCellEmpty: { borderWidth: 0, maxHeight: 52, marginBottom: 6 },
  dayNum: { fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { marginTop: 4 },
});
