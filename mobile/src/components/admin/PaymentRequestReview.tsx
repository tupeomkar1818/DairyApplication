import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { formInputStyles } from '@/src/components/shared/formFields';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { CustomerPaymentRequest } from '@/src/domain/customers/entities';
import {
  confirmPaymentRequest,
  paymentMethodLabel,
  PaymentRequestError,
  rejectPaymentRequest,
} from '@/src/domain/customers/paymentRequests';
import { notifyPaymentRecorded, notifyPaymentRejected } from '@/src/domain/notifications/events';
import { useUpdateCustomer } from '@/src/hooks/customers';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatDay, formatMoney } from '@/src/utils/format';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';
import { useOffers } from '@/src/hooks/offers/useOffers';

/**
 * Payments customers sent from the app, for the dairy to confirm once the money is in (or to turn down, with a
 * reason the customer sees). Confirming records the payment the same way "Mark paid" does.
 */

type Item = { customer: CustomerResponse; request: CustomerPaymentRequest };

export function pendingPaymentItems(customers: readonly CustomerResponse[]): Item[] {
  return customers
    .flatMap((customer) => (customer.paymentRequests ?? []).filter((r) => r.status === 'Pending').map((request) => ({ customer, request })))
    .sort((a, b) => String(a.request.createdAt).localeCompare(String(b.request.createdAt)));
}

/** Ready-made reasons for turning a payment down (labels in `billing.review.quickReasons`). */
const QUICK_REASONS = ['noPayment', 'amountMismatch', 'cashNotYet'] as const;

function newAuditId(): string {
  return `audit_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function PaymentRequestReview({
  customers,
  showCustomer,
  emptyText,
  onResult,
}: {
  customers: readonly CustomerResponse[];
  /** Name each row's customer (the all-customers list); off inside one customer's page. */
  showCustomer: boolean;
  /** Shown when nothing is waiting; omit to render nothing. */
  emptyText?: string;
  onResult: (message: string) => void;
}) {
  const tAll = useStrings('billing');
  const t = tAll.review;
  const tCommon = useStrings('common');
  const update = useUpdateCustomer();
  const offers = useOffers();
  const dialogStyle = useResponsiveDialogStyle(440);
  const items = useMemo(() => pendingPaymentItems(customers), [customers]);

  const [confirming, setConfirming] = useState<Item | null>(null);
  const [amountText, setAmountText] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [rejecting, setRejecting] = useState<Item | null>(null);
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (!items.length) {
    return emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null;
  }

  function openConfirm(item: Item) {
    setDialogError(null);
    setAmountText(String(item.request.amount));
    setCollectedBy(item.request.method === 'Cash' ? String(item.customer.assignedDeliveryBoyName ?? '').replace(/^Unassigned$/i, '') : '');
    setConfirming(item);
  }

  async function confirm() {
    if (!confirming) return;
    setDialogError(null);
    const today = todayYmd();
    const nowIso = new Date().toISOString();
    try {
      const { customer, request } = confirming;
      const done = confirmPaymentRequest(customer, request.id, {
        today,
        nowIso,
        amount: Number(amountText.replace(/[^\d.]/g, '')),
        collectedBy,
        offers: offers.all,
      });
      await update.mutateAsync({
        id: customer.id,
        data: {
          payments: done.payments,
          paymentRequests: done.paymentRequests,
          pendingAmount: done.pendingAmount,
          advanceBalance: done.advanceBalance,
          lastPaymentDate: done.lastPaymentDate,
          audit: [
            ...(customer.audit ?? []),
            {
              id: newAuditId(),
              createdAt: nowIso,
              updatedAt: nowIso,
              date: nowIso,
              // Audit log entry: stored, stays in English.
              action: `App payment confirmed (${request.method} ${done.payment.amountPaid}${request.reference ? `, ref ${request.reference}` : ''})`,
              updatedBy: 'Admin',
            },
          ],
        },
      });
      notifyPaymentRecorded({
        customerId: customer.id,
        amount: done.payment.amountPaid,
        paymentMode: done.payment.paymentMode,
        dateYmd: done.payment.paymentDate.slice(0, 10),
        outstandingAfter: done.pendingAmount,
      });
      setConfirming(null);
      onResult(t.confirmed(formatMoney(done.payment.amountPaid), customer.name));
    } catch (e) {
      setDialogError(e instanceof PaymentRequestError || e instanceof Error ? e.message : t.confirmFailed);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setDialogError(null);
    const nowIso = new Date().toISOString();
    try {
      const { customer, request } = rejecting;
      const paymentRequests = rejectPaymentRequest(customer, request.id, reason, nowIso);
      await update.mutateAsync({ id: customer.id, data: { paymentRequests } });
      notifyPaymentRejected({ customerId: customer.id, amount: request.amount, reason: reason.trim(), requestId: request.id });
      setRejecting(null);
      onResult(t.rejected(customer.name));
    } catch (e) {
      setDialogError(e instanceof PaymentRequestError || e instanceof Error ? e.message : t.updateFailed);
    }
  }

  const webInput = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const { customer, request } = item;
        return (
          <View key={request.id} style={styles.card}>
            <View style={styles.top}>
              <View style={[styles.methodIcon, request.method === 'Cash' ? styles.cashIcon : null]}>
                <MaterialCommunityIcons
                  name={request.method === 'Cash' ? 'cash' : request.method === 'UPI' ? 'cellphone-check' : 'credit-card-check-outline'}
                  size={20}
                  color={request.method === 'Cash' ? '#15803D' : amraleColors.blue}
                />
              </View>
              <View style={styles.topText}>
                <Text style={styles.amount}>{formatMoney(request.amount)}</Text>
                {showCustomer ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/(admin)/customers-detail', params: { id: customer.id } })}
                    accessibilityRole="link"
                    accessibilityLabel={t.openCustomer(customer.name)}
                  >
                    <Text style={styles.customer} numberOfLines={1}>
                      {customer.name}
                      {customer.mobile ? ` · ${customer.mobile}` : ''}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{paymentMethodLabel(request.method)}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {[
                request.method === 'Cash'
                  ? t.payingOn(formatDay(request.paidOnYmd, { year: true }))
                  : t.paidOn(formatDay(request.paidOnYmd, { year: true })),
                request.reference ? tAll.reference(request.reference) : '',
                t.sentAt(formatDateTime(request.createdAt)),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {request.note ? <Text style={styles.noteText}>{`“${request.note}”`}</Text> : null}
            <View style={styles.actions}>
              <Button mode="contained" icon="check" onPress={() => openConfirm(item)} disabled={update.isPending}>
                {request.method === 'Cash' ? t.cashReceived : t.moneyReceived}
              </Button>
              <Button
                mode="outlined"
                icon="close"
                textColor={amraleColors.error}
                onPress={() => {
                  setDialogError(null);
                  setReason('');
                  setRejecting(item);
                }}
                disabled={update.isPending}
              >
                {t.notReceived}
              </Button>
            </View>
          </View>
        );
      })}

      <Portal>
        <Dialog visible={!!confirming} onDismiss={() => !update.isPending && setConfirming(null)} style={[styles.dialog, dialogStyle]}>
          <Dialog.Title style={styles.dialogTitle}>{t.confirmTitle}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogText}>
              {confirming ? t.confirmText(confirming.customer.name, confirming.request.reference) : ''}
            </Text>
            <Text style={styles.label}>{t.amountReceived}</Text>
            <View style={formInputStyles.inputRow}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                value={amountText}
                onChangeText={(text) => setAmountText(text.replace(/[^\d.]/g, '').slice(0, 9))}
                keyboardType="decimal-pad"
                style={[formInputStyles.inputText, webInput]}
                accessibilityLabel={t.amountReceived}
              />
            </View>
            {confirming?.request.method === 'Cash' ? (
              <>
                <Text style={styles.label}>{t.collectedBy}</Text>
                <View style={formInputStyles.inputRow}>
                  <TextInput
                    value={collectedBy}
                    onChangeText={(text) => setCollectedBy(text.slice(0, 80))}
                    placeholder={t.collectedByPlaceholder}
                    placeholderTextColor={amraleColors.textSubtle}
                    style={[formInputStyles.inputText, webInput]}
                    accessibilityLabel={t.collectedByA11y}
                  />
                </View>
              </>
            ) : null}
            {dialogError ? <Text style={styles.error}>{dialogError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(null)} disabled={update.isPending}>
              {tCommon.actions.cancel}
            </Button>
            <Button mode="contained" onPress={() => void confirm()} loading={update.isPending} disabled={update.isPending}>
              {t.recordPayment}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!rejecting} onDismiss={() => !update.isPending && setRejecting(null)} style={[styles.dialog, dialogStyle]}>
          <Dialog.Title style={styles.dialogTitle}>{t.rejectTitle}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogText}>{rejecting ? t.rejectText(rejecting.customer.name) : ''}</Text>
            <Text style={styles.label}>{t.reason}</Text>
            <View style={[formInputStyles.inputRow, formInputStyles.inputRowMultiline]}>
              <TextInput
                value={reason}
                onChangeText={(text) => setReason(text.slice(0, 200))}
                placeholder={t.reasonPlaceholder}
                placeholderTextColor={amraleColors.textSubtle}
                multiline
                style={[formInputStyles.inputText, styles.multiline, webInput]}
                accessibilityLabel={t.reason}
              />
            </View>
            <View style={styles.quickReasons}>
              {QUICK_REASONS.map((key) => {
                const r = t.quickReasons[key];
                return (
                  <Pressable key={key} onPress={() => setReason(r)} style={({ pressed }) => [styles.quickReason, pressed && styles.pressed]} accessibilityRole="button">
                    <Text style={styles.quickReasonText}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            {dialogError ? <Text style={styles.error}>{dialogError}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejecting(null)} disabled={update.isPending}>
              {tCommon.actions.cancel}
            </Button>
            <Button mode="contained" buttonColor={amraleColors.error} onPress={() => void reject()} loading={update.isPending} disabled={update.isPending}>
              {t.tellCustomer}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted, paddingVertical: 8 },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.12)',
    backgroundColor: amraleColors.white,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(53, 81, 161, 0.1)' },
  cashIcon: { backgroundColor: 'rgba(22, 163, 74, 0.12)' },
  topText: { flex: 1, minWidth: 0, gap: 2 },
  amount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  customer: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: amraleRadius.pill, backgroundColor: amraleColors.inputBgLight },
  badgeText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.textMuted },
  meta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },
  noteText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  dialog: { backgroundColor: amraleColors.white },
  dialogTitle: { fontFamily: amraleTypography.fontFamily.bold, color: amraleColors.text },
  dialogContent: { gap: 8 },
  dialogText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  label: { marginTop: 4, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  rupee: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.blue },
  multiline: { height: 72, textAlignVertical: 'top' },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickReason: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: amraleRadius.pill, backgroundColor: amraleColors.inputBgLight },
  quickReasonText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.text },
  error: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },
  pressed: { opacity: 0.8 },
});
