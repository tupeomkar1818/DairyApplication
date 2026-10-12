import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaymentRequestReview, pendingPaymentItems } from '@/src/components/admin/PaymentRequestReview';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { ScreenHeader } from '@/src/components/shared/ScreenHeader';
import { isValidUpiId, paymentMethodLabel } from '@/src/domain/customers/paymentRequests';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useCustomers } from '@/src/hooks/customers';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatMoney } from '@/src/utils/format';

/** Every payment customers sent from the app that still needs the dairy's confirmation, oldest first. */
export default function AdminPaymentRequestsScreen() {
  const tAll = useStrings('billing');
  const t = tAll.requests;
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const customers = useCustomers();
  const items = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const pending = useMemo(() => pendingPaymentItems(items), [items]);
  const total = pending.reduce((s, x) => s + x.request.amount, 0);
  const [snack, setSnack] = useState<string | null>(null);
  const settings = useDashboardSettings();
  const paymentSettings = settings.data?.settings.payment;
  const notSetUp = !!settings.data && !(paymentSettings && (isValidUpiId(paymentSettings.upiId) || paymentSettings.acceptCash));
  const openSettings = () => router.push('/(admin)/payment-settings' as never);

  const reviewed = useMemo(
    () =>
      items
        .flatMap((customer) =>
          (customer.paymentRequests ?? [])
            .filter((r) => r.status === 'Confirmed' || r.status === 'Rejected')
            .map((request) => ({ customer, request })),
        )
        .sort((a, b) => String(b.request.reviewedAt ?? b.request.updatedAt).localeCompare(String(a.request.reviewedAt ?? a.request.updatedAt)))
        .slice(0, 15),
    [items],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t.title}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)'))}
        paddingTop={headerPaddingTop}
        right={
          <Pressable
            onPress={openSettings}
            hitSlop={6}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.settingsA11y}
          >
            <MaterialCommunityIcons name="cog-outline" size={24} color={amraleColors.blue} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }}>
        <ResponsiveContainer variant="form" style={styles.body}>
          {customers.isLoading ? (
            <ActivityIndicator color={amraleColors.blue} size="large" style={styles.loading} />
          ) : (
            <>
              {notSetUp ? (
                <Pressable onPress={openSettings} style={({ pressed }) => [styles.setup, pressed && styles.pressed]} accessibilityRole="button">
                  <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#B45309" />
                  <Text style={styles.setupText}>{t.notSetUp}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#B45309" />
                </Pressable>
              ) : null}
              <Text style={styles.intro}>
                {pending.length ? t.intro(pending.length, formatMoney(total)) : t.nothingWaiting}
              </Text>

              <PaymentRequestReview customers={items} showCustomer onResult={setSnack} />

              {reviewed.length ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t.recentlyReviewed}</Text>
                  {reviewed.map(({ customer, request }) => (
                    <View key={request.id} style={styles.row}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {`${formatMoney(request.amount)} · ${customer.name}`}
                        </Text>
                        <Text style={styles.rowHint} numberOfLines={2}>
                          {[
                            paymentMethodLabel(request.method),
                            request.reference ? tAll.reference(request.reference) : '',
                            request.reviewedAt ? formatDateTime(request.reviewedAt) : '',
                            request.rejectReason ?? '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <View style={[styles.status, request.status === 'Confirmed' ? styles.statusOk : styles.statusBad]}>
                        <Text style={[styles.statusText, request.status === 'Confirmed' ? styles.statusTextOk : styles.statusTextBad]}>
                          {tAll.requestStatus[request.status]}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ResponsiveContainer>
      </ScrollView>
      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 14 },
  loading: { marginTop: 48 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  setup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: '#FFF4E0',
  },
  setupText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, lineHeight: 18, color: '#8A4B00' },
  intro: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  section: { gap: 8, marginTop: 6 },
  sectionTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase', color: amraleColors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  rowHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: amraleRadius.pill },
  statusOk: { backgroundColor: '#dcf3e5' },
  statusBad: { backgroundColor: '#fde2e1' },
  statusText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12 },
  statusTextOk: { color: '#16623a' },
  statusTextBad: { color: '#9f1d1d' },
});
