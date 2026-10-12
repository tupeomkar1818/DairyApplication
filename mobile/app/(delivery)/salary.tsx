import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { shiftMonth } from '@/src/components/admin/customerSubscriptionMonthUtils';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { deliveryMonthLabel } from '@/src/components/delivery/deliveryWindow';
import { useDeliveryLayout } from '@/src/components/delivery/layout';
import { buildMySalaryMonth, formatRupees as money } from '@/src/components/delivery/mySalary';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { useMyDeliveryBoy } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';

function dayMonthYear(iso: string | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime())
    ? '—'
    : formatDay(`${m[1]}-${m[2]}-${m[3]}`, { year: true });
}

/** The month the boy joined; earlier months have nothing to show. */
function joiningMonth(joiningDate: string | undefined): string | null {
  const m = String(joiningDate ?? '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export default function MySalaryScreen() {
  const t = useStrings('delivery');
  const s = t.salary;
  const params = useLocalSearchParams<{ month?: string }>();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const layout = useDeliveryLayout();
  const { boy, allBoys, isLoading, isError, refetch } = useMyDeliveryBoy();

  const thisMonth = useMemo(() => todayYmd().slice(0, 7), []);
  const [month, setMonth] = useState<string>(
    /^\d{4}-\d{2}$/.test(params.month ?? '') && (params.month as string) <= thisMonth
      ? (params.month as string)
      : thisMonth,
  );

  const oldestMonth = joiningMonth(boy?.joiningDate);
  const summary = useMemo(() => buildMySalaryMonth(boy as never, allBoys as never, month), [allBoys, boy, month]);

  const isCurrentMonth = month === thisMonth;

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
            {s.title}
          </Text>
        </ResponsiveContainer>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer variant={layout.isWide ? 'list' : 'form'} style={styles.body}>
          <PeriodStepper
            label={deliveryMonthLabel(month)}
            hint={isCurrentMonth ? s.thisMonthSoFar : undefined}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            prevDisabled={!!oldestMonth && month <= oldestMonth}
            nextDisabled={isCurrentMonth}
            prevLabel={t.previousMonth}
            nextLabel={t.nextMonth}
          />

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={amraleColors.blue} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={amraleColors.textSubtle} />
              <Text style={styles.emptyTitle}>{s.couldNotLoad}</Text>
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
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>{isCurrentMonth ? s.earnedSoFar : s.earned}</Text>
                  {/* A month with nothing earned and nothing paid is not "Paid" — it simply has no settlement yet. */}
                  {summary.earned > 0 || summary.paidToDate > 0 || summary.advanceTaken > 0 ? (
                    <Text style={styles.heroPill}>{s.status[summary.status] ?? summary.status}</Text>
                  ) : null}
                </View>
                <Text style={styles.heroValue}>{money(summary.earned)}</Text>
                <Text style={styles.heroHint}>
                  {s.presentTimesRate(summary.presentDays, money(summary.perDay))}
                  {summary.coverDays ? ` · ${s.coverDays(summary.coverDays)}` : ''}
                </Text>
              </View>

              <View style={styles.tileRow}>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>{s.advanceTaken}</Text>
                  <Text style={styles.tileValue}>{money(summary.advanceTaken)}</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>{s.paid}</Text>
                  <Text style={styles.tileValue}>{money(summary.paidToDate)}</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>{s.stillDue}</Text>
                  <Text style={[styles.tileValue, summary.pending > 0 && styles.tileValueDue]}>
                    {money(summary.pending)}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardRow, layout.isWide && styles.cardRowWide]}>
              <View style={[styles.card, layout.isWide && styles.cardHalf]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={amraleColors.blue} />
                  <Text style={styles.cardTitle}>{s.howItAddsUp}</Text>
                </View>

                <Row label={s.presentDaysRow(summary.presentDays, money(summary.perDay))} value={money(summary.basePay)} />
                {summary.coverDays ? (
                  <Row label={s.routeCoverRow(summary.coverDays)} value={money(summary.coverPay)} />
                ) : null}
                {summary.bonus ? <Row label={s.bonus} value={money(summary.bonus)} /> : null}
                {summary.deduction ? (
                  <Row label={s.deduction} value={`- ${money(summary.deduction)}`} negative />
                ) : null}
                {summary.previousBalance ? (
                  <Row
                    label={summary.previousBalance > 0 ? s.carriedForward : s.overpaymentAdjusted}
                    value={`${summary.previousBalance > 0 ? '' : '- '}${money(Math.abs(summary.previousBalance))}`}
                    negative={summary.previousBalance < 0}
                  />
                ) : null}
                <Row label={isCurrentMonth ? s.earnedSoFar : s.earned} value={money(summary.earned)} strong />
              </View>

              <View style={[styles.card, layout.isWide && styles.cardHalf]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color={amraleColors.blue} />
                  <Text style={styles.cardTitle}>{s.payment}</Text>
                </View>
                <Row label={s.advanceAlreadyTaken} value={money(summary.advanceTaken)} />
                <Row label={s.paidTowardSalary} value={money(summary.paidToDate)} />
                <Row label={s.stillToBePaid} value={money(summary.pending)} strong />
                <Row label={s.lastPayment} value={dayMonthYear(summary.lastPaymentDateIso)} />
                {summary.lastPaymentMode ? (
                  <Row
                    label={s.paidBy}
                    value={(s.paymentModes as Record<string, string>)[summary.lastPaymentMode] ?? summary.lastPaymentMode}
                  />
                ) : null}
                <Text style={styles.footnote}>{s.footnote}</Text>
              </View>
              </View>

              <Pressable
                onPress={() => router.push({ pathname: '/(delivery)/attendance', params: { month } })}
                style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={s.attendanceA11y}
              >
                <MaterialCommunityIcons name="calendar-check-outline" size={20} color={amraleColors.blue} />
                <View style={styles.linkText}>
                  <Text style={styles.linkTitle}>{t.attendance.title}</Text>
                  <Text style={styles.linkHint}>{s.presentAbsent(summary.presentDays, summary.absentDays)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
              </Pressable>
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowLabelStrong]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong, negative && styles.rowValueNegative]}>
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
  appBarTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  heroCard: { gap: 4, padding: 16, borderRadius: amraleRadius.lg, backgroundColor: amraleColors.blue },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },
  // The shared status pill's tinted backgrounds wash out on the blue hero, so this one is white on translucent white.
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    color: amraleColors.white,
  },
  heroValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 30, lineHeight: 38, color: amraleColors.white },
  heroHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },

  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardRow: { gap: 12 },
  cardRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  cardHalf: { flex: 1, minWidth: 0 },
  tile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 100,
    justifyContent: 'space-between',
    gap: 2,
    padding: 12,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
  },
  tileLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  tileValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.text },
  tileValueDue: { color: amraleColors.error },

  card: {
    gap: 2,
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
  rowLabelStrong: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.text },
  rowValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  rowValueStrong: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  rowValueNegative: { color: amraleColors.error },
  footnote: {
    marginTop: 8,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: amraleColors.textSubtle,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
  },
  linkText: { flex: 1, minWidth: 0 },
  linkTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  linkHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },

  centered: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
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
});
