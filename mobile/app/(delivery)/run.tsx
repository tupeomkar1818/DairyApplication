import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  buildTodayEntries,
  filterTodayEntries,
  shiftYmd,
  todayYmd,
  type TodayEntry,
} from '@/src/components/admin/dashboardMetrics';
import { DELIVERY_ASIDE_WIDTH, useDeliveryLayout } from '@/src/components/delivery/layout';
import {
  canMarkDeliveryDay,
  deliveryDayOrToday,
  lastVisibleDeliveryDay,
  orderCutoffLabel,
} from '@/src/components/delivery/deliveryWindow';
import { buildLoadSheet } from '@/src/components/delivery/loadSheet';
import { directionsUrl, formatCustomerAddress, MAX_ROUTE_STOPS, routeUrl } from '@/src/domain/customers/location';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useMyCustomers } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { customerCutoffFor } from '@/src/domain/customers/daySchedule';
import { useNow } from '@/src/hooks/useNow';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

type StopFilter = 'all' | 'pending' | 'done' | 'missed';

const FILTERS: StopFilter[] = ['all', 'pending', 'done', 'missed'];

const STATUS_TONE: Record<TodayEntry['status'], DetailPillTone> = {
  Delivered: 'green',
  'Not delivered': 'red',
  Pending: 'amber',
};

function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? ymd
    : formatDay(ymd, { weekday: true });
}

export default function DeliveryRunScreen() {
  const t = useStrings('delivery');
  const common = useStrings('common');
  const params = useLocalSearchParams<{ date?: string }>();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  // From laptop width the load sheet moves into a side column and the stops sit in a grid beside it.
  const layout = useDeliveryLayout({ aside: true, minCardWidth: 380 });
  const { boy, customers, isLoading, isError, refetch } = useMyCustomers();

  const today = useMemo(() => todayYmd(), []);
  // Ticks while open: at 9 pm customers' changes for tomorrow close and the list is final.
  const now = useNow();
  const tomorrow = useMemo(() => lastVisibleDeliveryDay(today), [today]);
  // Orders are visible up to tomorrow; a link to a day further ahead opens today instead.
  const [ymd, setYmd] = useState<string>(() => deliveryDayOrToday(params.date, today));
  const isToday = ymd === today;
  const isTomorrow = ymd === tomorrow;
  const canMark = canMarkDeliveryDay(ymd, today);
  const cutoffLabel = orderCutoffLabel();

  const [filter, setFilter] = useState<StopFilter>('all');

  const entries = useMemo(() => buildTodayEntries(customers, ymd), [customers, ymd]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const openMaps = (url: string | null) => {
    if (!url) {
      setLocationNote(t.noMapLocation);
      return;
    }
    setLocationNote(null);
    void Linking.openURL(url).catch(() => setLocationNote(t.mapsFailed));
  };

  const loadSheet = useMemo(() => buildLoadSheet(entries), [entries]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      pending: entries.filter((e) => e.status === 'Pending').length,
      done: filterTodayEntries(entries, 'delivered').length,
      missed: filterTodayEntries(entries, 'missed').length,
    }),
    [entries],
  );

  const stops = useMemo(() => {
    switch (filter) {
      case 'pending':
        return entries.filter((e) => e.status === 'Pending');
      case 'done':
        return entries.filter((e) => e.status === 'Delivered');
      case 'missed':
        return entries.filter((e) => e.status === 'Not delivered');
      default:
        return entries;
    }
  }, [entries, filter]);

  const pendingRoute = useMemo(() => {
    const pending = entries.filter((e) => e.status === 'Pending').map((e) => customerById.get(e.customerId)).filter(Boolean);
    return { route: routeUrl(pending as NonNullable<(typeof pending)[number]>[]), total: pending.length };
  }, [customerById, entries]);

  const openOrder = (customerId: string) =>
    router.push({ pathname: '/(delivery)/stop-order', params: { customerId, date: ymd } });

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(delivery)');
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant={layout.isWide ? 'list' : 'form'} style={styles.appBarRow}>
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
            {isToday ? t.todaysRun : isTomorrow ? t.tomorrowsOrders : t.run.runSheet}
          </Text>
        </ResponsiveContainer>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer variant={layout.isWide ? 'list' : 'form'} style={styles.body}>
          <PeriodStepper
            label={isToday ? common.dates.today : isTomorrow ? common.dates.tomorrow : dayLabel(ymd)}
            hint={isToday || isTomorrow ? dayLabel(ymd) : t.tapForToday}
            onPrev={() => setYmd(shiftYmd(ymd, -1))}
            onNext={() => setYmd(shiftYmd(ymd, 1))}
            nextDisabled={ymd >= tomorrow}
            onPressLabel={isToday ? undefined : () => setYmd(today)}
            prevLabel={t.previousDay}
            nextLabel={t.nextDay}
          />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.run.couldNotLoad}</Text>
              <Pressable onPress={refetch} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryBtnText}>{t.retry}</Text>
              </Pressable>
            </View>
          ) : !boy ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="account-question-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{t.notLinked.title}</Text>
              <Text style={styles.emptyText}>{t.notLinked.text}</Text>
            </View>
          ) : (
            <View style={[styles.columns, layout.isWide && styles.columnsWide]}>
              <View style={[styles.card, layout.isWide && styles.aside]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="basket-outline" size={20} color={amraleColors.blue} />
                  <Text style={styles.cardTitle}>{t.run.whatToCarry}</Text>
                  <Text style={styles.cardCount}>{t.units.stops(counts.all)}</Text>
                </View>

                {loadSheet.length ? (
                  loadSheet.map((line) => (
                    <View key={line.label} style={styles.loadRow}>
                      <View style={styles.loadText}>
                        <Text style={styles.loadName} numberOfLines={1}>
                          {line.productName}
                        </Text>
                        <Text style={styles.loadPack} numberOfLines={1}>
                          {line.packLabel || '—'}
                          {line.hasAddOn ? ` · ${t.run.includesAddOn}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.loadCount}>{`× ${line.count}`}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{t.run.nothingToCarry}</Text>
                )}
              </View>

              <View style={styles.main}>
              <View style={styles.filterRow}>
                {FILTERS.map((key) => {
                  const selected = filter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setFilter(key)}
                      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t.run.filters[key]}</Text>
                      <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{counts[key]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {!canMark ? (
                <View style={styles.planNote}>
                  <MaterialCommunityIcons name="calendar-clock" size={18} color={amraleColors.blue} />
                  <Text style={styles.planNoteText}>
                    {now >= customerCutoffFor(ymd) ? t.run.planFinal(cutoffLabel) : t.run.planOpen(cutoffLabel)}
                  </Text>
                </View>
              ) : null}

              {pendingRoute.route ? (
                <Pressable
                  onPress={() => openMaps(pendingRoute.route!.url)}
                  style={({ pressed }) => [styles.routeBtn, pressed && styles.pressed]}
                  accessibilityRole="link"
                  accessibilityLabel={t.run.routeA11y(pendingRoute.route.stops)}
                >
                  <MaterialCommunityIcons name="map-marker-path" size={20} color={amraleColors.white} />
                  <View style={styles.routeText}>
                    <Text style={styles.routeTitle}>{t.run.routeTitle(pendingRoute.route.stops)}</Text>
                    <Text style={styles.routeHint}>
                      {pendingRoute.total > MAX_ROUTE_STOPS ? t.run.routeTooMany(MAX_ROUTE_STOPS) : t.run.routeHint}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="open-in-new" size={18} color={amraleColors.white} />
                </Pressable>
              ) : null}

              {locationNote ? (
                <Text style={styles.locationNote} accessibilityLiveRegion="polite">
                  {locationNote}
                </Text>
              ) : null}

              {stops.length ? (
                <View style={[styles.stopList, layout.columns > 1 && styles.stopGrid]}>
                {stops.map((entry) => {
                  const customer = customerById.get(entry.customerId);
                  const address = customer ? formatCustomerAddress(customer) : '';
                  return (
                    <View
                      key={entry.customerId}
                      style={[styles.card, layout.columns > 1 && { width: layout.cardWidth }]}
                    >
                      <View style={styles.stopTop}>
                        <Text style={styles.stopName} numberOfLines={2}>
                          {entry.name}
                        </Text>
                        <DetailStatusPill tone={STATUS_TONE[entry.status]} label={t.stopStatus[entry.status]} />
                      </View>

                      <View style={styles.metaLine}>
                        <MaterialCommunityIcons name="map-marker-outline" size={14} color={amraleColors.textSubtle} />
                        <Text style={styles.metaText} numberOfLines={4}>
                          {address || t.noAddress}
                        </Text>
                      </View>

                      <View style={styles.navRow}>
                        <Pressable
                          onPress={() => openMaps(customer ? directionsUrl(customer) : null)}
                          style={({ pressed }) => [styles.directionsBtn, pressed && styles.pressed]}
                          accessibilityRole="link"
                          accessibilityLabel={t.directionsA11y(entry.name)}
                        >
                          <MaterialCommunityIcons name="directions" size={18} color={amraleColors.blue} />
                          <Text style={styles.directionsText} numberOfLines={1}>
                            {t.directions}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openOrder(entry.customerId)}
                          style={({ pressed }) => [styles.viewOrderBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={t.run.viewOrderA11y(entry.name)}
                        >
                          <MaterialCommunityIcons name="package-variant-closed" size={18} color={amraleColors.white} />
                          <Text style={styles.viewOrderText} numberOfLines={1}>
                            {t.run.viewOrder}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
                </View>
              ) : (
                <View style={styles.centered}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={40} color={amraleColors.textSubtle} />
                  <Text style={styles.emptyTitle}>{counts.all ? t.noFilterMatch : t.run.noStopsTitle}</Text>
                  <Text style={styles.emptyText}>{counts.all ? t.run.filterEmptyText : t.run.noStopsText}</Text>
                </View>
              )}
              </View>
            </View>
          )}
        </ResponsiveContainer>
      </ScrollView>
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
  appBarTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  columns: { gap: 12 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  aside: { width: DELIVERY_ASIDE_WIDTH, flexGrow: 0, flexShrink: 0 },
  main: { flex: 1, minWidth: 0, gap: 12 },
  stopList: { gap: 12 },
  stopGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },

  card: {
    gap: 8,
    padding: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  cardCount: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },

  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: amraleColors.inputBorderLight,
  },
  loadText: { flex: 1, minWidth: 0 },
  loadName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  loadPack: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  loadCount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  chipSelected: { backgroundColor: amraleColors.blue, borderColor: amraleColors.blue },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  chipTextSelected: { color: amraleColors.white },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: amraleColors.textMuted,
    backgroundColor: amraleColors.inputBgLight,
  },
  chipCountSelected: { color: amraleColors.white, backgroundColor: 'rgba(255, 255, 255, 0.22)' },

  stopTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  stopName: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: amraleColors.textMuted,
  },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  directionsBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#e3efff',
  },
  directionsText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.blue },
  viewOrderBtn: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.blue,
  },
  viewOrderText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
  },
  routeText: { flex: 1, minWidth: 0 },
  routeTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.white },
  routeHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  locationNote: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, lineHeight: 18, color: '#0b4fae' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, textAlign: 'center' },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  planNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#e3efff',
  },
  planNoteText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, lineHeight: 18, color: '#0b4fae' },
  primaryBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.blue,
  },
  primaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
