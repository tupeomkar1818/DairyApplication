import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerChoiceChips,
  CustomerDateField,
  CustomerLoading,
  CustomerNotLinked,
  CustomerPrimaryButton,
  CustomerRow,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
  dayLabel,
  money,
} from '@/src/components/customer/customerUi';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { formInputStyles } from '@/src/components/shared/formFields';
import type { PaymentRequestMethod } from '@/src/domain/customers/entities';
import {
  addPaymentRequest,
  buildUpiPayLink,
  cancelPaymentRequest,
  isValidUpiId,
  MAX_APP_PAYMENT,
  newPaymentReference,
  paymentMethodLabel,
  pendingPaymentRequests,
  PaymentRequestError,
  validatePaymentRequest,
} from '@/src/domain/customers/paymentRequests';
import { notifyPaymentSubmitted } from '@/src/domain/notifications/events';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatMonth } from '@/src/utils/format';
import { useOffers } from '@/src/hooks/offers/useOffers';

type AmountChoice = 'total' | 'overdue' | 'other';

/** Only a real (https) gateway is offered; placeholders such as example.com or localhost in a `.env` are not. */
const GATEWAY_URL = (() => {
  const url = String(process.env.EXPO_PUBLIC_PAYMENT_GATEWAY_URL ?? '').trim();
  const host = url.match(/^https:\/\/([^/?#:]+)/i)?.[1]?.toLowerCase() ?? '';
  if (!host || host === 'localhost' || /(^|\.)example\.(com|org|net)$/.test(host)) return '';
  return url;
})();

function backToBills() {
  if (router.canGoBack()) router.back();
  else router.replace('/(customer)/bills');
}

/** After sending: My bills, whether or not it is under this screen (a notification may have opened Pay bill). */
function showBills() {
  router.dismissTo('/(customer)/bills');
}

/**
 * Paying the bill: choose how much, pay through a UPI app (or say cash is coming), and send the reference so the dairy
 * can confirm it. The bill only goes down once the dairy confirms — until then the payment shows as waiting.
 */
export default function CustomerPayBillScreen() {
  const tAll = useStrings('billing');
  const t = tAll.payBill;
  const tBills = tAll.bills;
  const lang = useLanguage();
  const { customer, isLoading, isError, refetch, save, isSaving } = useMyCustomer();
  const settingsQuery = useDashboardSettings();
  const payment = settingsQuery.data?.settings.payment;
  const today = useMemo(() => todayYmd(), []);

  const offers = useOffers();
  const summary = useMemo(
    () => (customer ? summarizeBilling(customer, buildBillingTimeline(customer, today.slice(0, 7), { offers: offers.all }), today) : null),
    [customer, today, offers.all],
  );
  const pending = useMemo(() => (customer ? pendingPaymentRequests(customer) : []), [customer]);
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const rejected = useMemo(
    () =>
      (customer?.paymentRequests ?? [])
        .filter((r) => r.status === 'Rejected')
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, 3),
    [customer],
  );

  const upiReady = !!payment && isValidUpiId(payment.upiId);
  const methods = useMemo(() => {
    const out: { key: PaymentRequestMethod; label: string }[] = [];
    if (upiReady) out.push({ key: 'UPI', label: t.methodUpi });
    if (GATEWAY_URL) out.push({ key: 'Online', label: t.methodOnline });
    if (payment?.acceptCash) out.push({ key: 'Cash', label: t.methodCash });
    return out;
  }, [upiReady, payment?.acceptCash, t, lang]);

  const outstanding = summary?.outstanding ?? 0;
  const overdueNow = summary?.overdue ?? 0;
  // What is still to pay once the payments already sent are confirmed (they settle the oldest, overdue bills first).
  const suggested = Math.max(0, Math.round(outstanding - pendingTotal));
  const overdue = Math.max(0, Math.round(overdueNow - pendingTotal));

  const [amountChoice, setAmountChoice] = useState<AmountChoice>('total');
  const [otherAmount, setOtherAmount] = useState('');
  const [method, setMethod] = useState<PaymentRequestMethod | null>(null);
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [sent, setSent] = useState<{ amount: number; method: PaymentRequestMethod } | null>(null);
  // One reference per visit, so the dairy can match this transfer in its bank statement.
  const [ourRef] = useState(() => newPaymentReference());

  const activeMethod = method ?? methods[0]?.key ?? null;
  const amountOptions = useMemo(() => {
    const out: { key: AmountChoice; label: string }[] = [];
    if (suggested > 0) out.push({ key: 'total', label: t.allDue(money(suggested)) });
    if (overdue > 0 && overdue < suggested) out.push({ key: 'overdue', label: t.overdue(money(overdue)) });
    out.push({ key: 'other', label: t.otherAmount });
    return out;
  }, [suggested, overdue, t, lang]);
  const choice: AmountChoice = amountOptions.some((o) => o.key === amountChoice) ? amountChoice : amountOptions[0]!.key;
  const amount =
    choice === 'total' ? suggested : choice === 'overdue' ? overdue : Math.round(Number(otherAmount.replace(/[^\d.]/g, '')) * 100) / 100 || 0;

  const oldestUnpaid = summary?.unpaid[0]?.month;
  // The UPI transaction note shows in the payer's UPI app and bank statement: always plain English (ASCII).
  const billNote = oldestUnpaid ? `Milk bill ${formatMonth(oldestUnpaid, 'en')} ${ourRef}` : `Milk bill ${ourRef}`;

  async function openUpiApp() {
    if (!payment || amount <= 0) return;
    setError(null);
    const link = buildUpiPayLink({ upiId: payment.upiId, payeeName: payment.payeeName, amount, note: billNote, reference: ourRef });
    try {
      await Linking.openURL(link);
    } catch {
      setError(t.noUpiApp);
    }
  }

  async function openGateway() {
    if (!GATEWAY_URL || !customer || amount <= 0) return;
    const qs = `kind=customer-bill&customerId=${encodeURIComponent(customer.id)}&amount=${encodeURIComponent(String(amount))}&reference=${ourRef}`;
    await WebBrowser.openBrowserAsync(GATEWAY_URL.includes('?') ? `${GATEWAY_URL}&${qs}` : `${GATEWAY_URL}?${qs}`);
  }

  async function copy(text: string, what: string) {
    try {
      await Clipboard.setStringAsync(text);
      setSnack(t.copied(what));
    } catch {
      setSnack(t.copyFailed(what));
    }
  }

  async function send() {
    if (!customer || !activeMethod) return;
    setError(null);
    const input = { amount, method: activeMethod, reference, paidOnYmd: paidOn, note };
    const problem = validatePaymentRequest(customer, input, today);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const { paymentRequests, request } = addPaymentRequest(customer, input, { today, nowIso });
      await save({ paymentRequests });
      notifyPaymentSubmitted({
        customerId: customer.id,
        customerName: customer.name,
        amount: request.amount,
        method: request.method,
        reference: request.reference,
        paidOnYmd: request.paidOnYmd,
        deliveryBoyId: customer.assignedDeliveryBoyId,
        requestId: request.id,
      });
      setSent({ amount: request.amount, method: request.method });
      setReference('');
      setNote('');
    } catch (e) {
      setError(e instanceof PaymentRequestError || e instanceof Error ? e.message : t.sendFailed);
    }
  }

  async function cancel(requestId: string) {
    if (!customer) return;
    try {
      await save({ paymentRequests: cancelPaymentRequest(customer, requestId, new Date().toISOString()) });
      setSnack(t.withdrawn);
    } catch {
      setSnack(t.withdrawFailed);
    }
  }

  return (
    <CustomerScreen title={t.title} onBack={backToBills}>
      {isLoading || settingsQuery.isLoading ? (
        <CustomerLoading />
      ) : isError ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.loadError} actionLabel={tBills.retry} onAction={refetch} />
      ) : !customer || !summary ? (
        <CustomerNotLinked />
      ) : sent ? (
        <CustomerCard>
          <View style={styles.sentIcon}>
            <MaterialCommunityIcons name="check-circle" size={44} color="#16623a" />
          </View>
          <Text style={styles.sentTitle}>{sent.method === 'Cash' ? t.sentCashTitle : t.sentTitle}</Text>
          <Text style={styles.sentText}>
            {sent.method === 'Cash' ? t.sentCashText(money(sent.amount)) : t.sentText(money(sent.amount))}
          </Text>
          <CustomerPrimaryButton label={t.backToBills} icon="receipt-text-outline" onPress={showBills} />
        </CustomerCard>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{tBills.totalToPay}</Text>
            <Text style={styles.heroValue}>{money(outstanding)}</Text>
            <Text style={styles.heroHint}>
              {pendingTotal > 0
                ? t.alreadySent(money(pendingTotal))
                : overdueNow > 0
                  ? t.overdueHint(money(overdueNow))
                  : outstanding > 0
                    ? t.includesThisMonth
                    : t.paidUpAdvance}
            </Text>
          </View>

          {methods.length === 0 ? (
            <CustomerStateBlock
              icon="cash-remove"
              title={t.notSetUpTitle}
              text={t.notSetUpText}
              actionLabel={t.contactDairy}
              onAction={() => router.push('/(auth)/contact-admin')}
            />
          ) : (
            <>
              <CustomerCard>
                <CustomerCardHeader icon="cash" title={t.howMuch} />
                <CustomerChoiceChips options={amountOptions} value={choice} onChange={setAmountChoice} />
                {choice === 'other' ? (
                  <View style={formInputStyles.inputRow}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      value={otherAmount}
                      onChangeText={(text) => setOtherAmount(text.replace(/[^\d.]/g, '').slice(0, 9))}
                      placeholder={t.amountPlaceholder}
                      placeholderTextColor={amraleColors.textSubtle}
                      keyboardType="decimal-pad"
                      style={[formInputStyles.inputText, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                      accessibilityLabel={t.amountA11y}
                      maxLength={9}
                    />
                  </View>
                ) : null}
                {amount > MAX_APP_PAYMENT ? <Text style={styles.error}>{t.aboveMax(money(MAX_APP_PAYMENT))}</Text> : null}
                {payment?.instructions ? <Text style={styles.note}>{payment.instructions}</Text> : null}
              </CustomerCard>

              <CustomerCard>
                <CustomerCardHeader icon="wallet-outline" title={t.howYouPay} />
                {methods.length > 1 ? (
                  <CustomerChoiceChips options={methods} value={activeMethod ?? methods[0]!.key} onChange={(m) => { setMethod(m); setError(null); }} />
                ) : null}

                {activeMethod === 'UPI' && payment ? (
                  <View style={styles.block}>
                    <Text style={styles.step}>{t.upiStep1(amount > 0 ? money(amount) : '', payment.payeeName || t.theDairy)}</Text>
                    {Platform.OS !== 'web' ? (
                      <CustomerPrimaryButton
                        label={t.payWithUpiApp}
                        icon="cellphone-arrow-down"
                        onPress={() => void openUpiApp()}
                        disabled={amount <= 0}
                      />
                    ) : null}
                    {amount > 0 ? (
                      <View style={styles.qrBlock}>
                        <View style={styles.qr}>
                          <QRCode
                            value={buildUpiPayLink({ upiId: payment.upiId, payeeName: payment.payeeName, amount, note: billNote, reference: ourRef })}
                            size={180}
                          />
                        </View>
                        <Text style={styles.note}>{Platform.OS === 'web' ? t.scanWeb : t.scanOtherPhone}</Text>
                      </View>
                    ) : null}
                    <CopyRow label={t.upiId} value={payment.upiId} onCopy={() => void copy(payment.upiId, t.upiId)} />
                    {amount > 0 ? <CopyRow label={t.amount} value={money(amount)} onCopy={() => void copy(String(amount), t.amount)} /> : null}

                    <Text style={[styles.step, styles.stepGap]}>{t.step2}</Text>
                    <ReferenceField value={reference} onChange={setReference} label={t.utrLabel} placeholder={t.utrPlaceholder} />
                  </View>
                ) : null}

                {activeMethod === 'Online' ? (
                  <View style={styles.block}>
                    <Text style={styles.step}>{t.onlineStep1(amount > 0 ? money(amount) : '')}</Text>
                    <CustomerPrimaryButton label={t.openGateway} icon="credit-card-outline" onPress={() => void openGateway()} disabled={amount <= 0} />
                    <Text style={[styles.step, styles.stepGap]}>{t.step2}</Text>
                    <ReferenceField value={reference} onChange={setReference} label={t.onlineRefLabel} placeholder={t.onlineRefPlaceholder} />
                  </View>
                ) : null}

                {activeMethod === 'Cash' ? (
                  <View style={styles.block}>
                    <Text style={styles.note}>{t.cashNote}</Text>
                  </View>
                ) : null}

                <CustomerDateField
                  label={activeMethod === 'Cash' ? t.whenYouWillPay : t.dayYouPaid}
                  value={paidOn}
                  onChange={(ymd) => setPaidOn(ymd || today)}
                  fieldName="pay-bill-date"
                />
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t.noteLabel}</Text>
                  <View style={formInputStyles.inputRow}>
                    <TextInput
                      value={note}
                      onChangeText={(text) => setNote(text.slice(0, 200))}
                      placeholder={t.notePlaceholder}
                      placeholderTextColor={amraleColors.textSubtle}
                      style={[formInputStyles.inputText, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                      accessibilityLabel={t.noteA11y}
                    />
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}
                <CustomerPrimaryButton
                  label={activeMethod === 'Cash' ? t.tellDairy(money(amount)) : t.sendForConfirmation(money(amount))}
                  icon="send"
                  onPress={() => void send()}
                  busy={isSaving}
                  disabled={amount <= 0}
                />
                <Text style={styles.note}>{t.billGoesDownNote}</Text>
              </CustomerCard>
            </>
          )}

          {pending.length ? (
            <CustomerCard>
              <CustomerCardHeader icon="timer-sand" title={t.waitingTitle} />
              {pending.map((r) => (
                <View key={r.id} style={styles.pendingRow}>
                  <View style={styles.pendingText}>
                    <Text style={styles.pendingAmount}>{money(r.amount)}</Text>
                    <Text style={styles.pendingHint} numberOfLines={2}>
                      {[paymentMethodLabel(r.method), dayLabel(r.paidOnYmd), r.reference ? tAll.reference(r.reference) : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <CustomerSecondaryButton label={t.withdraw} tone="danger" onPress={() => void cancel(r.id)} disabled={isSaving} />
                </View>
              ))}
            </CustomerCard>
          ) : null}

          {rejected.length ? (
            <CustomerCard>
              <CustomerCardHeader icon="alert-circle-outline" title={t.notConfirmedTitle} />
              {rejected.map((r) => (
                <CustomerRow key={r.id} label={`${money(r.amount)} · ${dayLabel(r.paidOnYmd)}${r.rejectReason ? ` — ${r.rejectReason}` : ''}`} value={paymentMethodLabel(r.method)} />
              ))}
              <Text style={styles.note}>{t.notConfirmedNote}</Text>
            </CustomerCard>
          ) : null}
        </>
      )}
      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} />
    </CustomerScreen>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  const t = useStrings('billing').payBill;
  return (
    <View style={styles.copyRow}>
      <View style={styles.copyText}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.copyValue} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        onPress={onCopy}
        style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.copyA11y(label)}
      >
        <MaterialCommunityIcons name="content-copy" size={18} color={amraleColors.blue} />
        <Text style={styles.copyBtnText}>{t.copy}</Text>
      </Pressable>
    </View>
  );
}

function ReferenceField({ value, onChange, label, placeholder }: { value: string; onChange: (t: string) => void; label: string; placeholder: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={formInputStyles.inputRow}>
        <MaterialCommunityIcons name="pound" size={20} color={amraleColors.blue} />
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40))}
          placeholder={placeholder}
          placeholderTextColor={amraleColors.textSubtle}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[formInputStyles.inputText, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 4, padding: 16, borderRadius: 18, backgroundColor: amraleColors.blue },
  heroLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },
  heroValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 30, lineHeight: 38, color: amraleColors.white },
  heroHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: 'rgba(255, 255, 255, 0.86)' },
  block: { gap: 10 },
  step: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  stepGap: { marginTop: 6 },
  qrBlock: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  qr: { padding: 12, borderRadius: amraleRadius.md, backgroundColor: '#ffffff', borderWidth: 1, borderColor: amraleColors.inputBorderLight },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  copyText: { flex: 1, minWidth: 0, gap: 2 },
  copyValue: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  copyBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: amraleRadius.pill },
  copyBtnText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  rupee: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },
  fieldBlock: { gap: 6 },
  fieldLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  error: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, lineHeight: 18, color: amraleColors.error },
  note: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textSubtle },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pendingText: { flex: 1, minWidth: 0, gap: 2 },
  pendingAmount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  pendingHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  sentIcon: { alignItems: 'center', paddingTop: 8 },
  sentTitle: { textAlign: 'center', fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  sentText: { textAlign: 'center', fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  pressed: { opacity: 0.8 },
});
