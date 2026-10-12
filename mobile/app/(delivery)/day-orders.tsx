import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { daysInMonth, shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { buildTodayEntries, filterTodayEntries, todayYmd } from '@/src/components/admin/dashboardMetrics';
import { deliveryMonthLabel, lastVisibleDeliveryDay } from '@/src/components/delivery/deliveryWindow';
import { useDeliveryLayout } from '@/src/components/delivery/layout';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { useMyCustomers } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { formatDay, formatMoney } from '@/src/utils/format';

type DayState = 'done' | 'open' | 'unmarked' | 'planned';

const DAY_STATE_TONE: Record<DayState, DetailPillTone> = {
  done: 'green',
  open: 'blue',
  unmarked: 'amber',
  planned: 'gray',
};

type DaySummary = {
  ymd: string;
  stops: number;
  delivered: number;
  missed: number;
  amount: number;
  state: DayState;
};

/**
 * Order history: the delivery partner's stops day by day for a month, up to tomorrow. Each day opens its run sheet,
 * where stops are marked — this screen only shows how each day went.
 */
export default function DeliveryOrderHistoryScreen() {
  const t = useStrings('delivery');
  const common = useStrings('common');
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const layout = useDeliveryLayout({ minCardWidth: 320 });
  const { boy, customers, isLoading } = useMyCustomers();

  const today = useMemo(() => todayYmd(), []);
  const lastDay = useMemo(() => lastVisibleDeliveryDay(today), [today]);
  const [month, setMonth] = useState<string>(today.slice(0, 7));
  const joinedMonth = String(boy?.joiningDate ?? '').slice(0, 7);

  const days = useMemo<DaySummary[]>(() => {
    const out: DaySummary[] = [];
    for (let d = daysInMonth(month); d >= 1; d -= 1) {
      const ymd = `${month}-${String(d).padStart(2, '0')}`;
      if (ymd > lastDay) continue;
      const entries = buildTodayEntries(customers, ymd);
      if (!entries.length) continue;
      const delivered = filterTodayEntries(entries, 'delivered').length;
      const missed = filterTodayEntries(entries, 'missed').length;
      const pending = entries.length - delivered - missed;
      out.push({
        ymd,
        stops: entries.length,
        delivered,
        missed,
        amount: entries.reduce((sum, e) => sum + e.amount, 0),
        state: ymd > today ? 'planned' : pending === 0 ? 'done' : ymd === today ? 'open' : 'unmarked',
      });
    }
    return out;
  }, [customers, lastDay, month, today]);

  // Totals count days that have come; tomorrow is still only a plan.
  const totals = useMemo(
    () =>
      days
        .filter((d) => d.ymd <= today)
        .reduce(
          (acc, d) => ({
            stops: acc.stops + d.stops,
            delivered: acc.delivered + d.delivered,
            missed: acc.missed + d.missed,
            amount: acc.amount + d.amount,
          }),
          { stops: 0, delivered: 0, missed: 0, amount: 0 },
        ),
    [days, today],
  );

  const variant = layout.isWide ? 'list' : 'form';
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(delivery)'));

  function dayTitle(ymd: string): string {
    if (ymd === today) return common.dates.today;
    if (ymd === lastDay) return common.dates.tomorrow;
    return formatDay(ymd, { weekday: true });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant={variant} style={styles.appBarRow}>
          <Pressable
            onPress={goBack}
            hitSlop={6}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {t.dayOrders.title}
          </Text>
        </ResponsiveContainer>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }} showsVerticalScrollIndicator={false}>
        <ResponsiveContainer variant={variant} style={styles.body}>
          <PeriodStepper
            label={deliveryMonthLabel(month)}
            hint={month === today.slice(0, 7) ? common.dates.thisMonth : undefined}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            prevDisabled={!!joinedMonth && month <= joinedMonth}
            nextDisabled={month >= lastDay.slice(0, 7)}
            prevLabel={t.previousMonth}
            nextLabel={t.nextMonth}
          />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          ) : !boy ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="account-question-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.notLinked.title}</Text>
              <Text style={styles.emptyText}>{t.notLinked.text}</Text>
            </View>
          ) : (
            <>
              <View style={styles.summary}>
                <SummaryTile label={t.dayOrders.stops} value={String(totals.stops)} />
                <SummaryTile label={t.dayOrders.delivered} value={String(totals.delivered)} tone="#16623a" />
                <SummaryTile
                  label={t.dayOrders.notDelivered}
                  value={String(totals.missed)}
                  tone={totals.missed ? '#9f1d1d' : undefined}
                />
                <SummaryTile label={t.dayOrders.orderValue} value={formatMoney(totals.amount)} />
              </View>

              {days.length === 0 ? (
                <View style={styles.centered}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={amraleColors.textSubtle} />
                  <Text style={styles.emptyTitle}>{t.dayOrders.emptyTitle(deliveryMonthLabel(month))}</Text>
                  <Text style={styles.emptyText}>{t.dayOrders.emptyText}</Text>
                </View>
              ) : (
                <View style={[styles.list, layout.columns > 1 && styles.grid]}>
                  {days.map((d) => {
                    const look = { label: t.dayOrders.states[d.state], tone: DAY_STATE_TONE[d.state] };
                    const detail =
                      d.state === 'planned'
                        ? t.units.stops(d.stops)
                        : [
                            t.units.stops(d.stops),
                            d.delivered ? t.dayOrders.deliveredCount(d.delivered) : null,
                            d.missed ? t.dayOrders.notDeliveredCount(d.missed) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ');
                    return (
                      <Pressable
                        key={d.ymd}
                        onPress={() => router.push({ pathname: '/(delivery)/run', params: { date: d.ymd } })}
                        style={({ pressed }) => [
                          styles.dayRow,
                          layout.columns > 1 && { width: layout.cardWidth },
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t.dayOrders.dayA11y(dayTitle(d.ymd), detail, look.label)}
                      >
                        <View style={styles.dayText}>
                          <View style={styles.dayTop}>
                            <Text style={styles.dayTitle} numberOfLines={1}>
                              {dayTitle(d.ymd)}
                            </Text>
                            <DetailStatusPill tone={look.tone} label={look.label} />
                          </View>
                          <Text style={styles.dayDetail} numberOfLines={2}>
                            {detail}
                          </Text>
                        </View>
                        <Text style={styles.dayAmount}>{formatMoney(d.amount)}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, tone ? { color: tone } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  appBar: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  appBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: amraleSpacing.md },
  appBarTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    gap: 2,
    padding: 12,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  tileLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  tileValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },

  list: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  dayText: { flex: 1, minWidth: 0, gap: 3 },
  dayTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  dayDetail: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  dayAmount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },

  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, textAlign: 'center' },
  emptyText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.88 },
});
