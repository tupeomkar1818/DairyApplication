import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerLoading,
  CustomerNotLinked,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerStateBlock,
  dayLabel,
} from '@/src/components/customer/customerUi';
import { OfferCard } from '@/src/components/customer/offers/OfferCard';
import { OfferOrderSheet, type OfferOrderTarget } from '@/src/components/customer/offers/OfferOrderSheet';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { applyOfferCode } from '@/src/domain/offers/claim';
import { liveOffersFor, OfferCodeError, offerText } from '@/src/domain/offers/offers';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useProducts } from '@/src/hooks/products';
import { useNow } from '@/src/hooks/useNow';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * The dairy's offers for this customer: type a code to unlock one, see what each offer gives, and order offer packs
 * or combos for a day. Bill discounts and subscription rewards need nothing — they come off the monthly bill.
 */
export default function CustomerOffersScreen() {
  const t = useStrings('offerCustomer');
  const o = useStrings('offers');
  const shell = useStrings('customer').shell;
  const lang = useLanguage();
  const { customer, isLoading, isError, refetch, save, isSaving } = useMyCustomer();
  const offers = useOffers();
  const products = useProducts();
  const now = useNow(60_000);
  const today = todayYmd(now);

  const live = useMemo(() => (customer ? liveOffersFor(offers.all, customer, today) : []), [customer, offers.all, today]);
  const canOrder = !!customer && customer.status !== 'Inactive';

  const [code, setCode] = useState('');
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [target, setTarget] = useState<OfferOrderTarget | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function applyCode() {
    if (!customer) return;
    setCodeMessage(null);
    setCodeError(null);
    setApplying(true);
    try {
      const offer = await applyOfferCode({ customer, offers: offers.all, code, todayYmd: today, saveCustomer: save });
      setCode('');
      // The claim unlocked an offer this app could not see before, and is on the record from now on.
      offers.refetch();
      refetch();
      const title = offerText(offer.title, lang);
      setCodeMessage(offer.startYmd > today ? t.code.appliedStartsLater(title, dayLabel(offer.startYmd)) : t.code.applied(title));
    } catch (err) {
      setCodeError(err instanceof OfferCodeError ? o.codeErrors[err.problem] : t.code.saveError);
    } finally {
      setApplying(false);
    }
  }

  return (
    <CustomerScreen title={t.screen.title}>
      {isLoading || offers.isLoading ? (
        <CustomerLoading />
      ) : isError ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.screen.loadError} actionLabel={shell.retry} onAction={refetch} />
      ) : !customer ? (
        <CustomerNotLinked />
      ) : (
        <>
          <CustomerCard>
            <CustomerCardHeader icon="ticket-percent-outline" title={t.code.title} />
            <View style={styles.codeRow}>
              <TextInput
                value={code}
                onChangeText={(next) => {
                  setCode(next);
                  setCodeError(null);
                }}
                placeholder={t.code.placeholder}
                placeholderTextColor={amraleColors.textSubtle}
                accessibilityLabel={t.code.label}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={() => void applyCode()}
                maxLength={24}
                style={styles.codeInput}
              />
              <CustomerPrimaryButton
                label={t.code.apply}
                onPress={() => void applyCode()}
                busy={applying}
                disabled={!code.trim()}
                style={styles.applyBtn}
              />
            </View>
            {codeError ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {codeError}
              </Text>
            ) : codeMessage ? (
              <View style={styles.success} accessibilityLiveRegion="polite">
                <MaterialCommunityIcons name="check-circle" size={18} color="#15803D" />
                <Text style={styles.successText}>{codeMessage}</Text>
              </View>
            ) : null}
          </CustomerCard>

          {!canOrder ? <Text style={styles.closed}>{t.screen.orderingClosed}</Text> : null}

          {live.length === 0 ? (
            <CustomerStateBlock icon="tag-heart-outline" title={t.screen.emptyTitle} text={t.screen.emptyText} />
          ) : (
            <>
              <Text style={styles.sectionTitle}>{t.screen.listTitle}</Text>
              {live.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  lang={lang}
                  products={products.data?.items ?? []}
                  canOrder={canOrder}
                  onOrderPack={(row) => setTarget({ kind: 'price', offer, item: row.item, product: row.product, pack: row.pack })}
                  onOrderCombo={() => setTarget({ kind: 'combo', offer })}
                />
              ))}
            </>
          )}

          <OfferOrderSheet
            target={target}
            customer={customer}
            offers={offers.all}
            saving={isSaving}
            onSave={save}
            onClose={() => setTarget(null)}
            onDone={(message) => {
              setTarget(null);
              setSnack(message);
            }}
          />
        </>
      )}
      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={() => setSnack(null)} />
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    letterSpacing: 1,
    color: amraleColors.text,
    // Web-only: native outlineStyle accepts solid/dotted/dashed, not 'none'.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  } as never,
  applyBtn: { paddingHorizontal: 16 },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, lineHeight: 18, color: amraleColors.error },
  success: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  successText: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: '#15803D',
  },
  closed: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, lineHeight: 18, color: '#9f1d1d' },
  sectionTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, marginTop: 4 },
});
