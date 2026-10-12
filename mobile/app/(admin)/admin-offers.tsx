import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { OFFER_KIND_ICONS, OfferNotice, OfferStatusPill } from '@/src/components/admin/offers/OfferAdminParts';
import { offerSummary } from '@/src/components/admin/offers/offerSummary';
import {
  CustomerLoading,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
  useCustomerLayout,
} from '@/src/components/customer/customerUi';
import type { Offer } from '@/src/domain/offers/entities';
import { offerStatus, offerText, type OfferStatus } from '@/src/domain/offers/offers';
import { buildWebsiteOffersFeed } from '@/src/domain/offers/websiteFeed';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { shareWebsiteOffersFile } from '@/src/infrastructure/offersShare';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';

const FILTERS: readonly OfferStatus[] = ['live', 'scheduled', 'ended'];

/** Every offer the dairy has run or planned, by Live / Starts soon / Ended. */
export default function AdminOffersScreen() {
  const offers = useOffers();
  const t = useStrings('offerAdmin');
  const to = useStrings('offers');
  const tc = useStrings('common');
  const { isWide } = useCustomerLayout();
  const today = todayYmd();
  const [chosen, setChosen] = useState<OfferStatus | null>(null);
  const [websiteOpen, setWebsiteOpen] = useState(false);

  const grouped = useMemo(() => {
    const by: Record<OfferStatus, Offer[]> = { live: [], scheduled: [], ended: [] };
    for (const o of offers.all) by[offerStatus(o, today)].push(o);
    by.live.sort((a, b) => (a.endYmd ?? '9999').localeCompare(b.endYmd ?? '9999') || b.startYmd.localeCompare(a.startYmd));
    by.scheduled.sort((a, b) => a.startYmd.localeCompare(b.startYmd));
    by.ended.sort((a, b) => (b.endYmd ?? b.startYmd).localeCompare(a.endYmd ?? a.startYmd));
    return by;
  }, [offers.all, today]);

  // Until the admin picks a filter, open on the first one that has offers.
  const filter = chosen ?? FILTERS.find((f) => grouped[f].length > 0) ?? 'live';
  const list = grouped[filter];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(admin)'));

  return (
    <CustomerScreen title={t.list.title} onBack={goBack}>
      <View style={styles.actions}>
        <CustomerPrimaryButton
          label={t.list.add}
          icon="plus"
          onPress={() => router.push('/(admin)/offer-edit')}
          style={styles.actionBtn}
        />
        <CustomerSecondaryButton label={t.list.websiteFile} onPress={() => setWebsiteOpen(true)} style={styles.actionBtn} />
      </View>

      {offers.isLoading ? (
        <CustomerLoading />
      ) : offers.isError && offers.all.length === 0 ? (
        <CustomerStateBlock icon="cloud-alert-outline" title={t.list.loadFailed} actionLabel={tc.actions.retryShort} onAction={offers.refetch} />
      ) : offers.all.length === 0 ? (
        <CustomerStateBlock
          icon="tag-multiple-outline"
          title={t.list.emptyTitle}
          text={t.list.emptyText}
          actionLabel={t.list.add}
          onAction={() => router.push('/(admin)/offer-edit')}
        />
      ) : (
        <>
          <View style={styles.chipRow}>
            {FILTERS.map((f) => {
              const selected = f === filter;
              return (
                <Pressable
                  key={f}
                  onPress={() => setChosen(f)}
                  style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{to.status[f]}</Text>
                  <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{grouped[f].length}</Text>
                </Pressable>
              );
            })}
          </View>

          {list.length === 0 ? (
            <CustomerStateBlock icon="tag-off-outline" title={t.list.emptyFilter[filter]} />
          ) : (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {list.map((o) => (
                <OfferCard key={o.id} offer={o} status={filter} style={isWide ? styles.cardWide : undefined} />
              ))}
            </View>
          )}
        </>
      )}

      <WebsiteOffersDialog visible={websiteOpen} offers={offers.all} onDismiss={() => setWebsiteOpen(false)} />
    </CustomerScreen>
  );
}

function OfferCard({ offer, status, style }: { offer: Offer; status: OfferStatus; style?: object }) {
  const lang = useLanguage();
  const t = useStrings('offerAdmin');
  const to = useStrings('offers');
  const title = offerText(offer.title, lang);
  const summary = offerSummary(offer, lang);
  const dates = to.dates(formatDay(offer.startYmd), offer.endYmd ? formatDay(offer.endYmd) : to.untilEnded);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(admin)/offer-detail', params: { id: offer.id } })}
      style={({ pressed }) => [styles.card, style, status === 'ended' && styles.cardDimmed, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.list.open(title)}
    >
      <View style={styles.cardTop}>
        <View style={styles.kindIcon}>
          <MaterialCommunityIcons name={OFFER_KIND_ICONS[offer.kind]} size={22} color={amraleColors.blue} />
        </View>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.cardKind} numberOfLines={1}>
            {to.kinds[offer.kind]}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
      </View>
      {summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <OfferStatusPill status={status} />
        {offer.code ? (
          <View style={styles.codeChip}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={14} color={amraleColors.text} />
            <Text style={styles.codeText}>{offer.code}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.datesRow}>
        <MaterialCommunityIcons name="calendar-range" size={16} color={amraleColors.textSubtle} />
        <Text style={styles.dates}>{dates}</Text>
      </View>
    </Pressable>
  );
}

/** Explains the website file and exports it (share sheet on a phone, download on the web). */
function WebsiteOffersDialog({ visible, offers, onDismiss }: { visible: boolean; offers: readonly Offer[]; onDismiss: () => void }) {
  const t = useStrings('offerAdmin').website;
  const tc = useStrings('common');
  const dialogStyle = useResponsiveDialogStyle(460);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const count = buildWebsiteOffersFeed(offers, todayYmd()).offers.length;

  async function exportFile() {
    setBusy(true);
    setMessage(null);
    try {
      await shareWebsiteOffersFile(buildWebsiteOffersFeed(offers, todayYmd()));
      setMessage({ ok: true, text: t.done });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error && e.message ? e.message : t.failed });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setMessage(null);
    onDismiss();
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={[styles.dialog, dialogStyle]}>
        <Dialog.Title style={styles.dialogTitle}>{t.title}</Dialog.Title>
        <Dialog.Content style={styles.dialogContent}>
          <OfferNotice icon="web" text={t.text} />
          <Text style={styles.dialogText}>{t.count(count)}</Text>
          {message ? <Text style={[styles.dialogText, message.ok ? styles.okText : styles.errorText]}>{message.text}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={close} disabled={busy}>
            {tc.actions.close}
          </Button>
          <Button onPress={() => void exportFile()} loading={busy} disabled={busy} icon="file-download-outline">
            {t.export}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexGrow: 1, flexBasis: 180 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
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
    paddingVertical: 1,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: amraleColors.textMuted,
    backgroundColor: amraleColors.inputBgLight,
  },
  chipCountSelected: { color: amraleColors.white, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  grid: { rowGap: 12 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    gap: 10,
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
  cardWide: { width: '49%' },
  cardDimmed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: {
    width: 40,
    height: 40,
    borderRadius: amraleRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 85, 199, 0.08)',
  },
  cardHead: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  cardKind: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  summary: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, lineHeight: 20, color: amraleColors.blue },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: amraleColors.textSubtle,
  },
  codeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 12, letterSpacing: 0.5, color: amraleColors.text },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dates: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  dialog: { backgroundColor: amraleColors.white, borderRadius: amraleRadius.lg },
  dialogTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  dialogContent: { gap: 12 },
  dialogText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  okText: { fontFamily: amraleTypography.fontFamily.semiBold, color: '#15803D' },
  errorText: { fontFamily: amraleTypography.fontFamily.semiBold, color: amraleColors.error },
  pressed: { opacity: 0.88 },
});
