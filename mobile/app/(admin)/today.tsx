import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ADMIN_LIST_GAP, AdminListScreenLayout, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import {
  buildTodayEntries,
  filterTodayEntries,
  shiftYmd,
  todayYmd,
  type TodayBucket,
  type TodayEntry,
} from '@/src/components/admin/dashboardMetrics';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  adminListCardStyles as cardStyles,
} from '@/src/components/shared/adminListUi';
import { DetailStatusPill, type DetailPillTone } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useCustomers } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

/** Tabs of this screen — the four dashboard tiles open straight into the matching one. Labels: `admin.today.buckets`. */
const BUCKETS: TodayBucket[] = ['due', 'delivered', 'missed', 'addons'];

const STATUS_TONE: Record<TodayEntry['status'], DetailPillTone> = {
  Delivered: 'green',
  'Not delivered': 'red',
  Pending: 'amber',
};

function isBucket(value: string | undefined): value is TodayBucket {
  return value === 'due' || value === 'delivered' || value === 'missed' || value === 'addons';
}

/** "Wed, 16 Sep 2026" for a yyyy-mm-dd day. */
function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? ymd
    : formatDay(ymd, { weekday: true, year: true });
}

export default function AdminTodayScreen() {
  const params = useLocalSearchParams<{ bucket?: string; date?: string }>();
  const customers = useCustomers();
  const grid = useAdminListGrid();
  const t = useStrings('admin');
  const tc = useStrings('common');
  const statusLabel: Record<TodayEntry['status'], string> = {
    Delivered: tc.states.delivered,
    'Not delivered': tc.states.notDelivered,
    Pending: tc.states.pending,
  };

  const [bucket, setBucket] = useState<TodayBucket>(isBucket(params.bucket) ? params.bucket : 'due');
  const [query, setQuery] = useState('');

  const today = useMemo(() => todayYmd(), []);
  // An earlier day can be opened by link (?date=) or with the stepper; the future has nothing to show.
  const [ymd, setYmd] = useState<string>(
    /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') && (params.date as string) <= today ? (params.date as string) : today,
  );
  const isToday = ymd === today;
  const entries = useMemo(() => buildTodayEntries(customers.data?.items ?? [], ymd), [customers.data?.items, ymd]);

  const counts = useMemo(
    () => ({
      due: filterTodayEntries(entries, 'due').length,
      delivered: filterTodayEntries(entries, 'delivered').length,
      missed: filterTodayEntries(entries, 'missed').length,
      addons: filterTodayEntries(entries, 'addons').length,
    }),
    [entries],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inBucket = filterTodayEntries(entries, bucket);
    if (!q) return inBucket;
    return inBucket.filter((e) => `${e.name} ${e.mobile} ${e.route}`.toLowerCase().includes(q));
  }, [entries, bucket, query]);

  const summaryText = query.trim()
    ? t.lists.showing(rows.length, filterTodayEntries(entries, bucket).length)
    : t.today.customers(rows.length);

  return (
    <AdminListScreenLayout title={t.today.title}>
      {({ bottomInset }) => {
        if (customers.isLoading) {
          return (
            <View style={styles.loading}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          );
        }

        if (customers.isError && !customers.data) {
          return <AdminListErrorState title={t.today.loadError} onRetry={() => void customers.refetch()} />;
        }

        return (
          <View style={styles.wrap}>
            <View style={[styles.stepper, grid.containerStyle]}>
              <PeriodStepper
                label={isToday ? tc.dates.today : dayLabel(ymd)}
                hint={isToday ? dayLabel(ymd) : t.lists.tapForToday}
                onPrev={() => setYmd(shiftYmd(ymd, -1))}
                onNext={() => setYmd(shiftYmd(ymd, 1))}
                nextDisabled={isToday}
                onPressLabel={isToday ? undefined : () => setYmd(today)}
                prevLabel={t.lists.previousDay}
                nextLabel={t.lists.nextDay}
              />
            </View>

            <AdminListControls
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder={t.lists.searchPlaceholder}
              searchFieldName="today-search"
              chips={BUCKETS.map((key) => ({ key, label: t.today.buckets[key], count: counts[key] }))}
              activeChip={bucket}
              onChipChange={setBucket}
              summaryText={summaryText}
              isMobile={grid.isMobile}
              containerStyle={grid.containerStyle}
            />

            <FlatList
              data={rows}
              key={grid.columns}
              numColumns={grid.columns}
              columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
              keyExtractor={(e) => e.customerId}
              contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <AdminListEmptyState
                  icon={query.trim() ? 'filter-off-outline' : 'clipboard-text-outline'}
                  title={query.trim() ? t.today.noMatchTitle : t.today.empty[bucket].title}
                  text={query.trim() ? t.lists.tryDifferent : t.today.empty[bucket].text}
                  actionLabel={query.trim() ? t.lists.clearSearch : t.lists.backToDashboard}
                  onAction={query.trim() ? () => setQuery('') : () => router.replace('/(admin)')}
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: item.customerId } })}
                  style={({ pressed }) => [cardStyles.card, grid.cellStyle, pressed && cardStyles.cardPressed]}
                  accessibilityLabel={t.lists.openA11y(item.name)}
                >
                  <View style={styles.rowTop}>
                    <Text style={cardStyles.name} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <DetailStatusPill tone={STATUS_TONE[item.status]} label={statusLabel[item.status]} />
                  </View>

                  <View style={cardStyles.metaLine}>
                    <MaterialCommunityIcons name="routes" size={14} color={amraleColors.textSubtle} />
                    <Text style={cardStyles.metaText} numberOfLines={1}>
                      {item.route || t.lists.noRoute}
                    </Text>
                  </View>

                  {item.planItems.length ? (
                    <View style={cardStyles.metaLine}>
                      <MaterialCommunityIcons name="package-variant-closed" size={14} color={amraleColors.textSubtle} />
                      <Text style={cardStyles.metaText} numberOfLines={2}>
                        {item.planItems.join(', ')}
                      </Text>
                    </View>
                  ) : null}

                  {item.addOnItems.length ? (
                    <View style={cardStyles.metaLine}>
                      <MaterialCommunityIcons name="basket-plus-outline" size={14} color={amraleColors.textSubtle} />
                      <Text style={cardStyles.metaText} numberOfLines={4}>
                        {t.today.addOn(item.addOnItems.join(', '))}
                      </Text>
                    </View>
                  ) : null}

                  {item.amount > 0 ? <Text style={styles.amount}>{t.today.amountToday(`₹${item.amount.toLocaleString('en-IN')}`)}</Text> : null}
                </Pressable>
              )}
            />
          </View>
        );
      }}
    </AdminListScreenLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  stepper: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: amraleSpacing.lg },
  list: { flex: 1 },
  listContent: { paddingHorizontal: amraleSpacing.md, paddingBottom: amraleSpacing.xl, gap: ADMIN_LIST_GAP },
  gridRow: { gap: ADMIN_LIST_GAP },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  amount: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.blue,
  },
});
