import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import {
  OfferConfirmDialog,
  OfferInfoRows,
  OfferPoster,
  OfferStatusPill,
} from '@/src/components/admin/offers/OfferAdminParts';
import { buildOfferStats } from '@/src/components/admin/offers/offerStats';
import { offerDetailRows, offerSummary } from '@/src/components/admin/offers/offerSummary';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerLoading,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
  useCustomerLayout,
} from '@/src/components/customer/customerUi';
import { DetailStatTile } from '@/src/components/shared/detailUi';
import { canDeleteOffer, endOfferNow } from '@/src/domain/offers/offerAdmin';
import { offerStatus, offerText } from '@/src/domain/offers/offers';
import { useCustomers } from '@/src/hooks/customers';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDateTime, formatDay, formatMoney, formatMonth } from '@/src/utils/format';

/** Everything about one offer: what it gives, its dates and code, how it is doing, and ending, deleting or copying it. */
export default function AdminOfferDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const offers = useOffers();
  const customers = useCustomers();
  const t = useStrings('offerAdmin');
  const to = useStrings('offers');
  const lang = useLanguage();
  const { isWide } = useCustomerLayout();
  const today = todayYmd();
  const [confirm, setConfirm] = useState<'end' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const offer = offers.all.find((o) => o.id === id) ?? null;
  const customerItems = useMemo(() => customers.data?.items ?? [], [customers.data?.items]);
  const stats = useMemo(
    () => (offer ? buildOfferStats(offer, customerItems, offers.all, today) : null),
    [offer, customerItems, offers.all, today],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-offers'));

  if (offers.isLoading) {
    return (
      <CustomerScreen title={t.detail.title} onBack={goBack}>
        <CustomerLoading />
      </CustomerScreen>
    );
  }
  if (!offer || !stats) {
    return (
      <CustomerScreen title={t.detail.title} onBack={goBack}>
        <CustomerStateBlock icon="tag-off-outline" title={t.form.notFound} actionLabel={t.form.backToList} onAction={() => router.replace('/(admin)/admin-offers')} />
      </CustomerScreen>
    );
  }

  const status = offerStatus(offer, today);
  const deletable = canDeleteOffer(offer, today);
  const busy = offers.save.isPending || offers.remove.isPending;
  const none = t.detail.none;
  const withYear = (ymd: string) => formatDay(ymd, { weekday: true, year: true });

  async function runConfirmed() {
    if (!offer || !confirm) return;
    setActionError(null);
    try {
      if (confirm === 'end') {
        await offers.save.mutateAsync(endOfferNow(offer, todayYmd()));
        setConfirm(null);
      } else {
        await offers.remove.mutateAsync(offer.id);
        setConfirm(null);
        router.replace('/(admin)/admin-offers');
      }
    } catch {
      setActionError(t.detail.actionFailed);
    }
  }

  const statTile = isWide ? styles.tileWide : undefined;
  const itemsLabel = offer.kind === 'combo' ? t.detail.combosOrdered : t.detail.packsOrdered;
  const showOrders = offer.kind === 'price' || offer.kind === 'combo';

  return (
    <CustomerScreen title={t.detail.title} onBack={goBack}>
      <CustomerCard style={styles.gap}>
        <OfferPoster key={offer.imageUri ?? 'none'} uri={offer.imageUri} height={isWide ? 240 : 180} />
        <View style={styles.headRow}>
          <Text style={styles.title}>{offerText(offer.title, lang)}</Text>
        </View>
        <View style={styles.pills}>
          <OfferStatusPill status={status} />
          <Text style={styles.kind}>{to.kinds[offer.kind]}</Text>
        </View>
        {offerSummary(offer, lang) ? <Text style={styles.summary}>{offerSummary(offer, lang)}</Text> : null}
        {offerText(offer.description, lang) ? <Text style={styles.description}>{offerText(offer.description, lang)}</Text> : null}
        <OfferInfoRows
          rows={[
            { label: t.detail.firstDay, value: withYear(offer.startYmd) },
            { label: t.detail.lastDay, value: offer.endYmd ? withYear(offer.endYmd) : to.untilEnded },
            ...(offer.endedAt ? [{ label: t.detail.status, value: t.detail.endedEarly(formatDateTime(offer.endedAt)) }] : []),
            { label: t.detail.code, value: offer.code ?? t.detail.noCode },
          ]}
        />
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="text-box-outline" title={t.detail.titlesTitle} />
        <OfferInfoRows
          rows={[
            { label: t.detail.titleEn, value: offer.title.en || none },
            { label: t.detail.titleMr, value: offer.title.mr?.trim() || t.detail.sameAsEnglish },
            { label: t.detail.descriptionEn, value: offer.description?.en?.trim() || none },
            {
              label: t.detail.descriptionMr,
              value: offer.description?.mr?.trim() || (offer.description?.en?.trim() ? t.detail.sameAsEnglish : none),
            },
          ]}
        />
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="tag-text-outline" title={t.detail.detailsTitle} />
        <OfferInfoRows rows={offerDetailRows(offer, lang)} />
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="chart-box-outline" title={t.detail.statsTitle} />
        <View style={styles.tiles}>
          {showOrders ? (
            <>
              <DetailStatTile label={t.detail.orders} value={String(stats.orders)} style={statTile} />
              <DetailStatTile label={t.detail.customersOrdered} value={String(stats.customers)} style={statTile} />
              <DetailStatTile label={itemsLabel} value={String(stats.items)} style={statTile} />
              <DetailStatTile label={t.detail.sales} value={formatMoney(stats.sales)} tone="blue" style={statTile} />
              <DetailStatTile label={t.detail.savings} value={formatMoney(stats.savings)} tone="green" style={statTile} />
            </>
          ) : null}
          {stats.discounts ? (
            <>
              <DetailStatTile
                label={t.detail.discountIn(formatMonth(stats.discounts.thisMonth))}
                value={formatMoney(stats.discounts.thisMonthAmount)}
                tone="green"
                style={statTile}
              />
              <DetailStatTile
                label={t.detail.discountIn(formatMonth(stats.discounts.lastMonth))}
                value={formatMoney(stats.discounts.lastMonthAmount)}
                style={statTile}
              />
            </>
          ) : null}
        </View>
        <Text style={styles.hint}>{t.detail.statsNote}</Text>
      </CustomerCard>

      {offer.code ? (
        <CustomerCard style={styles.gap}>
          <CustomerCardHeader icon="ticket-percent-outline" title={t.detail.claimsTitle} />
          {stats.claims.length === 0 ? (
            <Text style={styles.hint}>{t.detail.noClaims}</Text>
          ) : (
            <OfferInfoRows
              rows={stats.claims.map((c) => ({
                label: c.name || t.detail.formerCustomer,
                value: t.detail.claimedOn(formatDateTime(c.claimedAt)),
              }))}
            />
          )}
        </CustomerCard>
      ) : null}

      <View style={styles.actions}>
        <CustomerPrimaryButton
          label={t.detail.edit}
          icon="pencil-outline"
          onPress={() => router.push({ pathname: '/(admin)/offer-edit', params: { id: offer.id } })}
          style={styles.actionBtn}
        />
        <CustomerSecondaryButton
          label={t.detail.copy}
          onPress={() => router.push({ pathname: '/(admin)/offer-edit', params: { copyFrom: offer.id } })}
          style={styles.actionBtn}
        />
        {status !== 'ended' ? (
          <CustomerSecondaryButton
            label={t.detail.endNow}
            tone="danger"
            disabled={busy}
            onPress={() => {
              setActionError(null);
              setConfirm('end');
            }}
            style={styles.actionBtn}
          />
        ) : null}
        {deletable ? (
          <CustomerSecondaryButton
            label={t.detail.delete}
            tone="danger"
            disabled={busy}
            onPress={() => {
              setActionError(null);
              setConfirm('delete');
            }}
            style={styles.actionBtn}
          />
        ) : null}
      </View>
      {!deletable ? <Text style={styles.hint}>{t.detail.cannotDelete}</Text> : null}

      <OfferConfirmDialog
        visible={confirm !== null}
        title={confirm === 'delete' ? t.detail.deleteTitle : t.detail.endTitle}
        text={confirm === 'delete' ? t.detail.deleteText : t.detail.endText}
        confirmLabel={confirm === 'delete' ? t.detail.delete : t.detail.endNow}
        danger
        busy={busy}
        error={actionError}
        onConfirm={() => void runConfirmed()}
        onDismiss={() => {
          setConfirm(null);
          setActionError(null);
        }}
      />
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, lineHeight: 27, color: amraleColors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  kind: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.textMuted },
  summary: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, lineHeight: 22, color: amraleColors.blue },
  description: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 21, color: amraleColors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWide: { flexBasis: '30%' },
  hint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexGrow: 1, flexBasis: 180 },
});
