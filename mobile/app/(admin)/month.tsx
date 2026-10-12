import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ADMIN_LIST_GAP, AdminListScreenLayout, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import { monthLabel, shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import {
  buildMonthRows,
  computeMoneyMetrics,
  computePayrollDue,
  monthBillingBasis,
  monthKeyOf,
  todayYmd,
  type MonthBucket,
  type MonthRow,
} from '@/src/components/admin/dashboardMetrics';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  adminListCardStyles as cardStyles,
} from '@/src/components/shared/adminListUi';
import { useCustomers } from '@/src/hooks/customers';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';
import { useOffers } from '@/src/hooks/offers/useOffers';

/** Labels, empty states and row hints: `admin.month`. */
const BUCKETS: MonthBucket[] = ['expected', 'collected', 'outstanding', 'payroll'];

function isBucket(value: string | undefined): value is MonthBucket {
  return value === 'expected' || value === 'collected' || value === 'outstanding' || value === 'payroll';
}

function money(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/** "05 Sep" for a yyyy-mm-dd payment date; anything else is shown as-is. */
function dayLabel(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? ymd : formatDay(ymd);
}

export default function AdminMonthScreen() {
  const params = useLocalSearchParams<{ bucket?: string; month?: string }>();
  const customers = useCustomers();
  const deliveryBoys = useDeliveryBoys();
  const grid = useAdminListGrid();
  const t = useStrings('admin');
  const tc = useStrings('common');
  const lang = useLanguage();

  const [bucket, setBucket] = useState<MonthBucket>(isBucket(params.bucket) ? params.bucket : 'expected');
  const [query, setQuery] = useState('');

  const currentMonth = useMemo(() => monthKeyOf(todayYmd()), []);
  // An earlier month can be opened by link (?month=) or with the stepper; the future has nothing settled yet.
  const [monthKey, setMonthKey] = useState<string>(
    /^\d{4}-\d{2}$/.test(params.month ?? '') && (params.month as string) <= currentMonth
      ? (params.month as string)
      : currentMonth,
  );
  const isCurrentMonth = monthKey === currentMonth;
  /**
   * A settled month is billed from what was actually delivered; the running month shows what it should bring in.
   * Outstanding is a live balance with no per-month history, so it is only offered for the current month.
   */
  const basis = monthBillingBasis(monthKey, currentMonth);
  const buckets = isCurrentMonth ? BUCKETS : BUCKETS.filter((b) => b !== 'outstanding');
  const customerItems = customers.data?.items;
  const offers = useOffers();
  const boyItems = deliveryBoys.data?.items;

  const totals = useMemo(() => {
    const m = computeMoneyMetrics(customerItems ?? [], monthKey, basis, undefined, offers.all);
    return {
      expected: m.expected,
      collected: m.collected,
      outstanding: m.outstanding,
      payroll: computePayrollDue(boyItems ?? [], monthKey),
    };
  }, [customerItems, boyItems, monthKey, basis, offers.all]);

  /** All four row sets: the chips need their counts, and switching chips should not recompute. */
  const rowsByBucket = useMemo(() => {
    const input = { customers: customerItems ?? [], boys: boyItems ?? [], monthKey, basis, offers: offers.all };
    return {
      expected: buildMonthRows(input, 'expected'),
      collected: buildMonthRows(input, 'collected'),
      outstanding: buildMonthRows(input, 'outstanding'),
      payroll: buildMonthRows(input, 'payroll'),
    } satisfies Record<MonthBucket, MonthRow[]>;
    // Route and tag words on the rows are in the app language.
  }, [customerItems, boyItems, monthKey, basis, lang, offers.all]);
  // Outstanding is hidden on past months; fall back to the billing bucket when paging back from it.
  const effectiveBucket: MonthBucket = !isCurrentMonth && bucket === 'outstanding' ? 'expected' : bucket;
  const rows = rowsByBucket[effectiveBucket];

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.title} ${r.subtitle} ${r.tag ?? ''}`.toLowerCase().includes(q));
  }, [rows, query]);

  const isLoading = customers.isLoading || deliveryBoys.isLoading;
  const isError = (customers.isError && !customers.data) || (deliveryBoys.isError && !deliveryBoys.data);

  const summaryText = query.trim()
    ? t.lists.showing(visibleRows.length, rows.length)
    : `${money(totals[effectiveBucket])} · ${monthLabel(monthKey)}`;

  function openRow(row: MonthRow) {
    if (row.target.kind === 'customer') {
      router.push({ pathname: '/(admin)/customers-detail', params: { id: row.target.id } });
      return;
    }
    router.push({ pathname: '/(admin)/delivery-detail', params: { id: row.target.id, tab: 'salary' } });
  }

  return (
    <AdminListScreenLayout title={t.month.title}>
      {({ bottomInset }) => {
        if (isLoading) {
          return (
            <View style={styles.loading}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          );
        }

        if (isError) {
          return (
            <AdminListErrorState
              title={t.month.loadError}
              onRetry={() => {
                void customers.refetch();
                void deliveryBoys.refetch();
              }}
            />
          );
        }

        return (
          <View style={styles.wrap}>
            <View style={[styles.stepper, grid.containerStyle]}>
              <PeriodStepper
                label={monthLabel(monthKey)}
                hint={isCurrentMonth ? tc.dates.thisMonth : t.month.tapForThisMonth}
                onPrev={() => setMonthKey(shiftMonth(monthKey, -1))}
                onNext={() => setMonthKey(shiftMonth(monthKey, 1))}
                nextDisabled={isCurrentMonth}
                onPressLabel={isCurrentMonth ? undefined : () => setMonthKey(currentMonth)}
                prevLabel={t.month.previousMonth}
                nextLabel={t.month.nextMonth}
              />
            </View>

            <AdminListControls
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder={t.month.searchPlaceholder}
              searchFieldName="month-search"
              chips={buckets.map((key) => ({
                key,
                label: key === 'expected' && basis === 'billed' ? t.month.billed : t.month.buckets[key],
                count: rowsByBucket[key].length,
              }))}
              activeChip={effectiveBucket}
              onChipChange={setBucket}
              summaryText={summaryText}
              isMobile={grid.isMobile}
              containerStyle={grid.containerStyle}
            />

            <FlatList
              data={visibleRows}
              key={grid.columns}
              numColumns={grid.columns}
              columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
              keyExtractor={(r) => r.id}
              contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <AdminListEmptyState
                  icon={query.trim() ? 'filter-off-outline' : 'cash-multiple'}
                  title={
                    query.trim()
                      ? t.month.noMatchTitle
                      : effectiveBucket === 'expected' && basis === 'billed'
                        ? t.month.emptyBilled.title
                        : t.month.empty[effectiveBucket].title
                  }
                  text={
                    query.trim()
                      ? t.month.tryDifferent
                      : effectiveBucket === 'expected' && basis === 'billed'
                        ? t.month.emptyBilled.text
                        : t.month.empty[effectiveBucket].text
                  }
                  actionLabel={query.trim() ? t.lists.clearSearch : t.lists.backToDashboard}
                  onAction={query.trim() ? () => setQuery('') : () => router.replace('/(admin)')}
                />
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => openRow(item)}
                  style={({ pressed }) => [cardStyles.card, grid.cellStyle, pressed && cardStyles.cardPressed]}
                  accessibilityLabel={t.lists.openA11y(item.title)}
                >
                  <View style={styles.rowTop}>
                    <Text style={cardStyles.name} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.amount} numberOfLines={1}>
                      {money(item.amount)}
                    </Text>
                  </View>

                  <View style={cardStyles.metaLine}>
                    <MaterialCommunityIcons
                      name={effectiveBucket === 'collected' ? 'calendar-outline' : 'routes'}
                      size={14}
                      color={amraleColors.textSubtle}
                    />
                    <Text style={cardStyles.metaText} numberOfLines={1}>
                      {effectiveBucket === 'collected' ? dayLabel(item.subtitle) : item.subtitle}
                    </Text>
                    {item.tag ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{item.tag}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.hint}>
                    {effectiveBucket === 'expected' && basis === 'billed' ? t.month.billedThisMonth : t.month.rowHint[effectiveBucket]}
                  </Text>
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
    flexShrink: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.blue,
  },
  tag: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.inputBgLight,
  },
  tagText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    lineHeight: 15,
    color: amraleColors.textMuted,
  },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textSubtle,
  },
});
