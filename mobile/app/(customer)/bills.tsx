import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  buildBillingTimeline,
  summarizeBilling,
  type BillingTimelineRow,
} from '@/src/components/admin/billingTimeline';
import {
  computeSubscriptionBillingTotalForMonth,
  monthLabel,
  shiftMonth,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerLoading,
  CustomerNotLinked,
  CustomerRow,
  CustomerScreen,
  CustomerStateBlock,
  dayLabel,
  money,
} from '@/src/components/customer/customerUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { addOnLabel, addOnLineTotal, deliveredAddOnsForMonth } from '@/src/domain/customers/addOns';
import { paymentModeLabel, pendingPaymentTotal } from '@/src/domain/customers/paymentRequests';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { billOfferLines } from '@/src/components/customer/offers/offerCards';
import { offerDiscountsForMonth, offerText, orderSavings } from '@/src/domain/offers/offers';

type BillState = 'overdue' | 'due' | 'running' | 'paid' | 'nothing';

/** Where a month's bill stands today. */
function billState(row: Pick<BillingTimelineRow, 'billDateYmd' | 'dueDateYmd' | 'pending' | 'invoiceTotal'>, today: string): BillState {
  if (row.pending <= 0) return row.invoiceTotal > 0 ? 'paid' : 'nothing';
  if (row.dueDateYmd < today) return 'overdue';
  if (row.billDateYmd <= today) return 'due';
  return 'running';
}

const STATE_TAG: Record<BillState, { fg: string; bg: string }> = {
  overdue: { fg: '#9f1d1d', bg: '#fde2e1' },
  due: { fg: '#8a4b00', bg: '#fff0d6' },
  running: { fg: '#0b4fae', bg: '#e3efff' },
  paid: { fg: '#16623a', bg: '#dcf3e5' },
  nothing: { fg: '#4d5b6b', bg: '#eef1f5' },
};

function StateTag({ state }: { state: BillState }) {
  const t = useStrings('billing');
  const tag = STATE_TAG[state];
  return (
    <View style={[styles.tag, { backgroundColor: tag.bg }]}>
      <Text style={[styles.tagText, { color: tag.fg }]}>{t.bills.state[state]}</Text>
    </View>
  );
}

export default function CustomerBillsScreen() {
  const t = useStrings('billing').bills;
  const o = useStrings('offers');
  const ot = useStrings('offerCustomer').bill;
  const lang = useLanguage();
  const { customer, isLoading, isError, refetch } = useMyCustomer();
  const today = useMemo(() => todayYmd(), []);
  const currentMonth = today.slice(0, 7);
  // Opened at a month by a link (e.g. a notification); never a month that has not started.
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<string>(() =>
    /^\d{4}-\d{2}$/.test(params.month ?? '') && (params.month as string) <= currentMonth ? (params.month as string) : currentMonth,
  );

  const offers = useOffers();
  const timeline = useMemo(
    () => (customer ? buildBillingTimeline(customer, currentMonth, { offers: offers.all }) : []),
    [customer, currentMonth, offers.all],
  );
  const summary = useMemo(
    () => (customer ? summarizeBilling(customer, timeline, today) : null),
    [customer, timeline, today],
  );
  const firstMonth = timeline[timeline.length - 1]?.month ?? currentMonth;
  const awaitingConfirmation = customer ? pendingPaymentTotal(customer) : 0;

  const bill = useMemo(() => {
    if (!customer) return null;
    const row = timeline.find((r) => r.month === month);
    if (!row) return null;
    const subscription = Math.round(
      computeSubscriptionBillingTotalForMonth(month, customer.subscriptionPlans ?? [], [], customer.deliveries ?? []),
    );
    const addOns = deliveredAddOnsForMonth(customer, month);
    const addOnTotal = Math.round(addOns.reduce((sum, o) => sum + addOnLineTotal(o), 0));
    const deliveredDays = new Set(
      (customer.deliveries ?? [])
        .filter((d) => d.status === 'Delivered' && String(d.deliveryDate ?? '').slice(0, 7) === month)
        .map((d) => String(d.deliveryDate).slice(0, 10)),
    ).size;
    // Offer lines add up to what the bill took off (the timeline row), so the charges card totals the row.
    const offerLines = billOfferLines(offerDiscountsForMonth(customer, month, offers.all), row.offerDiscount);
    const offerTotal = offerLines.reduce((sum, l) => sum + l.amount, 0);
    return {
      row,
      subscription,
      addOns,
      addOnTotal,
      offerLines,
      discount: Math.max(0, subscription + addOnTotal - offerTotal - row.baseAmount),
      // What offerSavingsForMonth counts, with the bill offers as the bill actually took them off.
      saved: addOns.reduce((sum, order) => sum + orderSavings(order), 0) + offerTotal,
      deliveredDays,
      state: billState(row, today),
    };
  }, [customer, month, timeline, today, offers.all]);

  const isCurrentMonth = month === currentMonth;

  return (
    <CustomerScreen title={t.title}>
      {isLoading ? (
        <CustomerLoading />
      ) : isError ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.loadError} actionLabel={t.retry} onAction={refetch} />
      ) : !customer || !summary ? (
        <CustomerNotLinked />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{t.totalToPay}</Text>
            <Text style={styles.heroValue}>{money(summary.outstanding)}</Text>
            {summary.overdue > 0 ? (
              <View style={styles.heroAlert}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#9f1d1d" />
                <Text style={styles.heroAlertText}>{t.overdueAlert(money(summary.overdue))}</Text>
              </View>
            ) : (
              <Text style={styles.heroHint}>
                {summary.outstanding > 0
                  ? t.nothingOverdue
                  : summary.advance > 0
                    ? t.advance(money(summary.advance))
                    : t.allPaid}
              </Text>
            )}
            {awaitingConfirmation > 0 ? (
              <View style={styles.heroPending}>
                <MaterialCommunityIcons name="timer-sand" size={15} color="#0b4fae" />
                <Text style={styles.heroPendingText}>{t.awaiting(money(awaitingConfirmation))}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => router.push('/(customer)/pay-bill' as never)}
              style={({ pressed }) => [styles.payBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.payBill}
            >
              <MaterialCommunityIcons name="cash-fast" size={20} color={amraleColors.blue} />
              <Text style={styles.payBtnText}>{summary.outstanding > awaitingConfirmation ? t.payBill : t.payments}</Text>
            </Pressable>
          </View>

          {summary.unpaid.length ? (
            <CustomerCard>
              <CustomerCardHeader icon="file-clock-outline" title={t.unpaidTitle} />
              {summary.unpaid.map((b) => {
                const state: BillState = b.overdue ? 'overdue' : b.issued ? 'due' : 'running';
                const selected = b.month === month;
                return (
                  <Pressable
                    key={b.month}
                    onPress={() => setMonth(b.month)}
                    style={({ pressed }) => [styles.unpaidRow, selected && styles.unpaidRowSelected, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t.unpaidRowA11y(monthLabel(b.month), money(b.amount))}
                  >
                    <View style={styles.unpaidText}>
                      <Text style={styles.unpaidMonth}>{monthLabel(b.month)}</Text>
                      <Text style={styles.unpaidHint} numberOfLines={2}>
                        {b.issued ? t.payBy(dayLabel(b.dueDateYmd)) : t.billOn(dayLabel(b.billDateYmd))}
                      </Text>
                    </View>
                    <View style={styles.unpaidRight}>
                      <Text style={styles.unpaidAmount}>{money(b.amount)}</Text>
                      <StateTag state={state} />
                    </View>
                  </Pressable>
                );
              })}
              <Text style={styles.note}>{t.oldestFirstNote}</Text>
            </CustomerCard>
          ) : null}

          <PeriodStepper
            label={monthLabel(month)}
            hint={isCurrentMonth ? t.thisMonthRunning : undefined}
            onPrev={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
            prevDisabled={month <= firstMonth}
            nextDisabled={isCurrentMonth}
            prevLabel={t.previousMonth}
            nextLabel={t.nextMonth}
          />

          {!bill ? (
            <CustomerStateBlock icon="receipt-text-outline" title={t.noBill} />
          ) : (
            <>
              <CustomerCard>
                <View style={styles.billHeader}>
                  <View style={styles.billHeaderTitle}>
                    <CustomerCardHeader icon="receipt-text-outline" title={t.monthBill(monthLabel(month))} />
                  </View>
                  <StateTag state={bill.state} />
                </View>
                <CustomerRow label={isCurrentMonth ? t.chargesSoFar : t.charges} value={money(bill.row.baseAmount)} />
                {bill.row.carryForwardIn > 0 ? (
                  <CustomerRow label={t.carriedIn} value={`+ ${money(bill.row.carryForwardIn)}`} />
                ) : null}
                <CustomerRow label={t.billTotal} value={money(bill.row.invoiceTotal)} />
                {bill.row.paidApplied > 0 ? (
                  <CustomerRow label={t.paidTowards} value={`- ${money(bill.row.paidApplied)}`} />
                ) : null}
                <CustomerRow label={t.stillToPay} value={money(bill.row.pending)} strong />
                <CustomerRow label={t.billDate} value={dayLabel(bill.row.billDateYmd)} />
                <CustomerRow label={t.payByLabel} value={dayLabel(bill.row.dueDateYmd)} />
                {bill.row.carryForwardIn > 0 ? <Text style={styles.note}>{t.carriedNote}</Text> : null}
              </CustomerCard>

              <CustomerCard>
                <CustomerCardHeader icon="format-list-bulleted" title={t.charges} />
                <CustomerRow label={t.subscriptionDays(bill.deliveredDays)} value={money(bill.subscription)} />
                <CustomerRow label={t.addOns} value={money(bill.addOnTotal)} />
                {bill.discount > 0 ? <CustomerRow label={t.discount} value={`- ${money(bill.discount)}`} /> : null}
                {bill.offerLines.map((line) => (
                  <CustomerRow
                    key={line.offerId}
                    label={o.billLine(offerText(line.title, lang))}
                    value={`- ${money(line.amount)}`}
                  />
                ))}
                <CustomerRow label={t.chargesTotal} value={money(bill.row.baseAmount)} strong />
                {bill.saved > 0 ? (
                  <View style={styles.saved}>
                    <MaterialCommunityIcons name="tag-heart-outline" size={16} color="#16623a" />
                    <Text style={styles.savedText}>{ot.savedThisMonth(money(bill.saved))}</Text>
                  </View>
                ) : null}
                <Text style={styles.note}>{t.deliveredOnlyNote}</Text>
              </CustomerCard>

              {bill.addOns.length ? (
                <CustomerCard>
                  <CustomerCardHeader icon="basket-outline" title={t.addOnsDelivered} />
                  {bill.addOns.map((order) => {
                    const saved = orderSavings(order);
                    return (
                      <View key={order.id} style={styles.lineRow}>
                        <Text style={styles.lineDate}>{dayLabel(String(order.deliveryDate ?? order.orderDate).slice(0, 10))}</Text>
                        <View style={styles.lineMain}>
                          <Text style={styles.lineNameText} numberOfLines={3}>
                            {addOnLabel(order, lang)}
                          </Text>
                          {order.offer ? (
                            <View style={styles.offerTags}>
                              <Text style={styles.offerTag}>{o.offer}</Text>
                              {saved > 0 ? <Text style={styles.savedTag}>{o.save(money(saved))}</Text> : null}
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.lineAmount}>{money(addOnLineTotal(order))}</Text>
                      </View>
                    );
                  })}
                </CustomerCard>
              ) : null}
            </>
          )}

          <CustomerCard>
            <CustomerCardHeader icon="cash-check" title={t.paymentsMade} />
            {summary.payments.length ? (
              summary.payments.slice(0, 6).map((p) => (
                <View key={p.id} style={styles.lineRow}>
                  <Text style={styles.lineDate}>{dayLabel(String(p.paymentDate ?? '').slice(0, 10))}</Text>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {p.paymentMode ? paymentModeLabel(p.paymentMode) : t.paymentFallback}
                  </Text>
                  <Text style={styles.lineAmount}>{money(Math.round(Number(p.amountPaid ?? 0)))}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.note}>{t.noPayments}</Text>
            )}
            <Text style={styles.note}>{t.paymentsNote}</Text>
          </CustomerCard>
        </>
      )}
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 4, padding: 16, borderRadius: 18, backgroundColor: amraleColors.blue },
  heroLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },
  heroValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 30, lineHeight: 38, color: amraleColors.white },
  heroHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },
  heroAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#fde2e1',
    maxWidth: '100%',
  },
  heroAlertText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#9f1d1d' },
  heroPending: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#e3efff',
    maxWidth: '100%',
  },
  heroPendingText: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#0b4fae' },
  payBtn: {
    marginTop: 10,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: amraleColors.white,
  },
  payBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },
  note: {
    marginTop: 6,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: amraleColors.textSubtle,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 11 },
  unpaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 12,
  },
  unpaidRowSelected: { backgroundColor: 'rgba(37, 117, 252, 0.08)' },
  pressed: { opacity: 0.7 },
  unpaidText: { flex: 1, minWidth: 0, gap: 2 },
  unpaidMonth: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  unpaidHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  unpaidRight: { alignItems: 'flex-end', gap: 4 },
  unpaidAmount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },
  billHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  billHeaderTitle: { flex: 1, minWidth: 0 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  lineDate: { width: 70, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  lineName: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.text },
  lineAmount: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.text },
  lineMain: { flex: 1, minWidth: 0, gap: 3 },
  lineNameText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.text },
  offerTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  offerTag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: '#a3246b',
    backgroundColor: '#fbe3f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  savedTag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: '#16623a',
    backgroundColor: '#dcf3e5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#dcf3e5',
  },
  savedText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#16623a' },
});
