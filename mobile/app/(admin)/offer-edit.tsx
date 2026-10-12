import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import { OfferInfoRows, OfferNotice, OfferPoster } from '@/src/components/admin/offers/OfferAdminParts';
import {
  copyDraftFromOffer,
  draftFromOffer,
  emptyOfferDraft,
  offerFromDraft,
  packRowFrom,
  refreshListPrices,
  type OfferDraft,
  type OfferPackRow,
} from '@/src/components/admin/offers/offerDraft';
import {
  OfferAddButton,
  OfferDateField,
  OfferKindPicker,
  OfferPackRowCard,
  OfferProblems,
  OfferQuantityStepper,
} from '@/src/components/admin/offers/OfferFormParts';
import { OfferPackPickerSheet } from '@/src/components/admin/offers/OfferPackPickerSheet';
import { offerDetailRows } from '@/src/components/admin/offers/offerSummary';
import { pickAnnouncementMedia } from '@/src/components/announcements/pickAnnouncementMedia';
import { uploadPicture } from '@/src/infrastructure/uploadPicture';
import {
  CustomerCard,
  CustomerCardHeader,
  CustomerLoading,
  CustomerPrimaryButton,
  CustomerScreen,
  CustomerSecondaryButton,
  CustomerStateBlock,
} from '@/src/components/customer/customerUi';
import { ProfileField } from '@/src/components/profile/ProfileField';
import { MultiOptionChips, OptionChips, ToggleCard } from '@/src/components/shared/formFields';
import { OFFER_KINDS, type Offer, type OfferKind } from '@/src/domain/offers/entities';
import {
  mergeOfferEdit,
  newOfferId,
  offerPricingLocked,
  validateOffer,
  type OfferProblem,
} from '@/src/domain/offers/offerAdmin';
import { comboListTotal, offerStatus } from '@/src/domain/offers/offers';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useProducts } from '@/src/hooks/products';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay, formatMoney } from '@/src/utils/format';

type Section = 'about' | 'dates' | 'code' | 'kind';

const PROBLEM_SECTION: Record<OfferProblem, Section> = {
  titleRequired: 'about',
  titleTooLong: 'about',
  startInvalid: 'dates',
  startInPast: 'dates',
  endInvalid: 'dates',
  endBeforeStart: 'dates',
  endInPast: 'dates',
  codeInvalid: 'code',
  codeTaken: 'code',
  priceItemsRequired: 'kind',
  offerPriceInvalid: 'kind',
  duplicatePack: 'kind',
  comboItemsRequired: 'kind',
  comboPriceInvalid: 'kind',
  discountInvalid: 'kind',
  percentTooHigh: 'kind',
  maxDiscountInvalid: 'kind',
  minPacksInvalid: 'kind',
};

const DISCOUNT_TYPES = ['percent', 'flat'] as const;

/**
 * Add an offer (`?kind=` picks the kind; `?copyFrom=` starts from another offer) or change one (`?id=`). Once an offer
 * has started, only its wording, poster and last day can change: the rest shows read-only.
 */
export default function AdminOfferEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string; copyFrom?: string }>();
  const offers = useOffers();
  const products = useProducts();
  const t = useStrings('offerAdmin');
  const to = useStrings('offers');
  const tc = useStrings('common');
  const lang = useLanguage();
  const today = useMemo(() => todayYmd(), []);
  const [newId] = useState(() => newOfferId());

  const saved = params.id ? offers.all.find((o) => o.id === params.id) ?? null : null;
  const locked = offerPricingLocked(saved, today);
  const ended = !!saved && offerStatus(saved, today) === 'ended';
  const productItems = useMemo(() => products.data?.items ?? [], [products.data?.items]);

  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [pickerFor, setPickerFor] = useState<'price' | 'combo' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);

  // Start the form once the offers are loaded (editing and copying need the stored offer).
  useEffect(() => {
    if (draft || offers.isLoading) return;
    if (params.id) {
      if (saved) setDraft(draftFromOffer(saved));
      return;
    }
    const source = params.copyFrom ? offers.all.find((o) => o.id === params.copyFrom) : undefined;
    if (source) {
      setDraft(copyDraftFromOffer(source, today));
      return;
    }
    const kind = OFFER_KINDS.includes(params.kind as OfferKind) ? (params.kind as OfferKind) : 'price';
    setDraft(emptyOfferDraft(today, kind));
  }, [draft, offers.isLoading, offers.all, params.id, params.copyFrom, params.kind, saved, today]);

  /** Normal prices follow the catalog until the offer starts. */
  const current = useMemo(() => {
    if (!draft || locked) return draft;
    return {
      ...draft,
      priceRows: refreshListPrices(draft.priceRows, productItems),
      comboRows: refreshListPrices(draft.comboRows, productItems),
    };
  }, [draft, locked, productItems]);

  const build = (d: OfferDraft, nowIso: string): Offer => {
    const built = offerFromDraft(d, {
      id: saved?.id ?? newId,
      createdAt: saved?.createdAt ?? nowIso,
      updatedAt: nowIso,
      endedAt: saved?.endedAt,
    });
    return saved ? mergeOfferEdit(saved, built, today, nowIso) : built;
  };

  const problems = useMemo(() => {
    if (!current) return [];
    return validateOffer(build(current, new Date().toISOString()), today, { saved, others: offers.all });
  }, [current, saved, offers.all, today]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/admin-offers'));
  const screenTitle = saved ? t.form.editTitle : t.form.newTitle;

  if (offers.isLoading || (!draft && (!params.id || saved))) {
    return (
      <CustomerScreen title={screenTitle} onBack={goBack}>
        <CustomerLoading />
      </CustomerScreen>
    );
  }
  if (!current || (params.id && !saved)) {
    return (
      <CustomerScreen title={screenTitle} onBack={goBack}>
        <CustomerStateBlock icon="tag-off-outline" title={t.form.notFound} actionLabel={t.form.backToList} onAction={() => router.replace('/(admin)/admin-offers')} />
      </CustomerScreen>
    );
  }

  const d = current;
  const update = (patch: Partial<OfferDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateRow = (list: 'priceRows' | 'comboRows', packId: string, patch: Partial<OfferPackRow>) =>
    setDraft((prev) => (prev ? { ...prev, [list]: prev[list].map((r) => (r.packId === packId ? { ...r, ...patch } : r)) } : prev));
  const removeRow = (list: 'priceRows' | 'comboRows', packId: string) =>
    setDraft((prev) => (prev ? { ...prev, [list]: prev[list].filter((r) => r.packId !== packId) } : prev));

  const shown = showErrors ? problems : [];
  const messagesFor = (section: Section) => shown.filter((p) => PROBLEM_SECTION[p] === section).map((p) => to.problems[p]);

  async function pickPoster() {
    setPosterBusy(true);
    setSaveError(null);
    try {
      const picked = await pickAnnouncementMedia('image');
      // With the dairy’s server the poster goes up once and the offer keeps its address, so every phone sees it.
      if (picked.ok) update({ imageUri: await uploadPicture(picked.media.uri) });
      else if (!('cancelled' in picked)) setSaveError(picked.message);
    } catch {
      setSaveError(t.form.posterFailed);
    } finally {
      setPosterBusy(false);
    }
  }

  async function save() {
    setShowErrors(true);
    setSaveError(null);
    if (problems.length) return;
    const offer = build(d, new Date().toISOString());
    let saved;
    try {
      // The dairy's server may save a new offer under an id of its own, so the detail screen is opened on that one.
      saved = await offers.save.mutateAsync(offer);
    } catch {
      setSaveError(t.form.saveFailed);
      return;
    }
    router.replace({ pathname: '/(admin)/offer-detail', params: { id: saved?.id ?? offer.id } });
  }

  const comboTotal = comboListTotal({
    comboItems: d.comboRows.map((r) => ({ ...r, quantity: Number(r.quantity) || 0 })),
  });
  const comboPriceNumber = Number(d.comboPrice);
  const comboSaves = d.comboPrice.trim() && Number.isFinite(comboPriceNumber) ? comboTotal - Math.round(comboPriceNumber) : null;
  const rewardOptions = productItems
    .filter((p) => p.isActive !== false || d.rewardProducts.some((r) => r.productId === p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => p.id);
  const productName = (id: string) =>
    productItems.find((p) => p.id === id)?.name ?? d.rewardProducts.find((r) => r.productId === id)?.productName ?? id;

  return (
    <CustomerScreen title={screenTitle} onBack={goBack}>
      {locked && saved ? (
        <CustomerCard style={styles.gap}>
          <OfferNotice icon="lock-outline" title={t.form.lockedTitle} text={ended ? t.form.endedText : t.form.lockedText} />
          <OfferInfoRows
            rows={[
              { label: t.detail.kind, value: to.kinds[saved.kind] },
              { label: t.detail.firstDay, value: formatDay(saved.startYmd, { weekday: true, year: true }) },
              ...(ended
                ? [{ label: t.detail.lastDay, value: saved.endYmd ? formatDay(saved.endYmd, { weekday: true, year: true }) : to.untilEnded }]
                : []),
              { label: t.detail.code, value: saved.code ?? t.detail.noCode },
              ...offerDetailRows(saved, lang),
            ]}
          />
        </CustomerCard>
      ) : (
        <CustomerCard style={styles.gap}>
          <CustomerCardHeader icon="shape-outline" title={t.form.kindTitle} />
          <OfferKindPicker value={d.kind} onChange={(kind) => update({ kind })} />
        </CustomerCard>
      )}

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="text-box-edit-outline" title={t.form.aboutTitle} />
        <ProfileField
          label={t.form.titleEn}
          value={d.titleEn}
          onChangeText={(titleEn) => update({ titleEn })}
          placeholder={t.form.titleEnPlaceholder}
          maxLength={80}
        />
        <ProfileField
          label={t.form.titleMr}
          value={d.titleMr}
          onChangeText={(titleMr) => update({ titleMr })}
          placeholder={t.form.titleMrPlaceholder}
          maxLength={80}
        />
        <Text style={styles.hint}>{t.form.titleMrHint}</Text>
        <ProfileField
          label={t.form.descriptionEn}
          value={d.descriptionEn}
          onChangeText={(descriptionEn) => update({ descriptionEn })}
          multiline
          style={styles.multiline}
        />
        <ProfileField
          label={t.form.descriptionMr}
          value={d.descriptionMr}
          onChangeText={(descriptionMr) => update({ descriptionMr })}
          multiline
          style={styles.multiline}
        />
        <Text style={styles.hint}>{t.form.descriptionHint}</Text>
        <OfferProblems messages={messagesFor('about')} />
      </CustomerCard>

      <CustomerCard style={styles.gap}>
        <CustomerCardHeader icon="image-outline" title={t.form.posterTitle} />
        {d.imageUri ? (
          <>
            <OfferPoster key={d.imageUri} uri={d.imageUri} height={180} />
            <CustomerSecondaryButton label={t.form.removePoster} tone="danger" onPress={() => update({ imageUri: '' })} />
          </>
        ) : (
          <OfferAddButton label={t.form.addPoster} icon="image-plus" onPress={() => void pickPoster()} />
        )}
        <Text style={styles.hint}>{t.form.posterHint}</Text>
      </CustomerCard>

      {/* An ended offer keeps its dates: bills counted it through its last day. */}
      {ended ? null : (
        <CustomerCard style={styles.gap}>
          <CustomerCardHeader icon="calendar-range" title={t.form.datesTitle} />
          {locked ? null : (
            <OfferDateField
              label={t.form.firstDay}
              fieldName="offer-first-day"
              value={d.startYmd}
              onChange={(startYmd) => update({ startYmd })}
              hasError={shown.includes('startInvalid') || shown.includes('startInPast')}
            />
          )}
          <OfferDateField
            label={t.form.lastDay}
            fieldName="offer-last-day"
            value={d.endYmd}
            onChange={(endYmd) => update({ endYmd })}
            hasError={shown.includes('endInvalid') || shown.includes('endBeforeStart') || shown.includes('endInPast')}
          />
          <View style={styles.hintRow}>
            <Text style={[styles.hint, styles.hintFlex]}>{t.form.lastDayHint}</Text>
            {d.endYmd ? (
              <Pressable onPress={() => update({ endYmd: '' })} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>{tc.actions.clear}</Text>
              </Pressable>
            ) : null}
          </View>
          <OfferProblems messages={messagesFor('dates')} />
        </CustomerCard>
      )}

      {locked ? null : (
        <>
          <CustomerCard style={styles.gap}>
            <CustomerCardHeader icon="ticket-percent-outline" title={t.form.codeTitle} />
            <ProfileField
              label={t.form.codeLabel}
              value={d.code}
              onChangeText={(code) => update({ code: code.replace(/\s+/g, '').toUpperCase() })}
              placeholder="DIWALI50"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            <Text style={styles.hint}>{t.form.codeHint}</Text>
            <OfferProblems messages={messagesFor('code')} />
          </CustomerCard>

          {d.kind === 'price' ? (
            <CustomerCard style={styles.gap}>
              <CustomerCardHeader icon="tag-outline" title={t.form.packsTitle} />
              {d.priceRows.length === 0 ? <Text style={styles.hint}>{t.form.noPacksYet}</Text> : null}
              {d.priceRows.map((row) => (
                <OfferPackRowCard key={row.packId} row={row} onRemove={() => removeRow('priceRows', row.packId)}>
                  <Text style={styles.normalPrice}>{t.form.normalPrice(formatMoney(row.listPrice))}</Text>
                  <ProfileField
                    label={t.form.offerPrice}
                    value={row.offerPrice}
                    onChangeText={(offerPrice) => updateRow('priceRows', row.packId, { offerPrice: offerPrice.replace(/[^\d.]/g, '') })}
                    keyboardType="decimal-pad"
                    placeholder={String(Math.max(0, row.listPrice - 1))}
                  />
                </OfferPackRowCard>
              ))}
              <OfferAddButton label={t.form.addPack} icon="plus" onPress={() => setPickerFor('price')} />
              <ToggleCard
                icon="calendar-sync-outline"
                label={t.form.includeRegular}
                hint={t.form.includeRegularHint}
                value={d.includeRegular}
                onChange={(includeRegular) => update({ includeRegular })}
              />
              <OfferProblems messages={messagesFor('kind')} />
            </CustomerCard>
          ) : null}

          {d.kind === 'combo' ? (
            <CustomerCard style={styles.gap}>
              <CustomerCardHeader icon="gift-outline" title={t.form.comboTitle} />
              {d.comboRows.length === 0 ? <Text style={styles.hint}>{t.form.noPacksYet}</Text> : null}
              {d.comboRows.map((row) => (
                <OfferPackRowCard key={row.packId} row={row} onRemove={() => removeRow('comboRows', row.packId)}>
                  <Text style={styles.normalPrice}>{t.form.normalPrice(formatMoney(row.listPrice))}</Text>
                  <OfferQuantityStepper
                    name={`${row.productName} ${row.packLabel}`}
                    value={row.quantity}
                    onChange={(quantity) => updateRow('comboRows', row.packId, { quantity })}
                  />
                </OfferPackRowCard>
              ))}
              <OfferAddButton label={t.form.addPack} icon="plus" onPress={() => setPickerFor('combo')} />
              <Text style={styles.total}>{t.form.normalTotal(formatMoney(comboTotal))}</Text>
              <ProfileField
                label={t.form.comboPrice}
                value={d.comboPrice}
                onChangeText={(comboPrice) => update({ comboPrice: comboPrice.replace(/[^\d.]/g, '') })}
                keyboardType="decimal-pad"
              />
              {comboSaves !== null && comboSaves > 0 ? (
                <Text style={styles.saves}>{t.form.customerSaves(formatMoney(comboSaves))}</Text>
              ) : null}
              <OfferProblems messages={messagesFor('kind')} />
            </CustomerCard>
          ) : null}

          {d.kind === 'bill' || d.kind === 'subscription' ? (
            <CustomerCard style={styles.gap}>
              <CustomerCardHeader icon={d.kind === 'bill' ? 'receipt-text-outline' : 'calendar-star'} title={t.form.discountTitle} />
              <OptionChips
                options={DISCOUNT_TYPES}
                value={d.discountType}
                onChange={(discountType) => update({ discountType })}
                labelFor={(type) => (type === 'percent' ? t.form.percent : d.kind === 'bill' ? t.form.flatBill : t.form.flatPack)}
              />
              <ProfileField
                label={d.discountType === 'percent' ? t.form.percentValue : d.kind === 'bill' ? t.form.flatBillValue : t.form.flatPackValue}
                value={d.discountValue}
                onChangeText={(discountValue) => update({ discountValue: discountValue.replace(/[^\d.]/g, '') })}
                keyboardType="decimal-pad"
              />
              {d.discountType === 'percent' ? (
                <ProfileField
                  label={d.kind === 'bill' ? t.form.maxPerBill : t.form.maxPerMonth}
                  value={d.maxDiscount}
                  onChangeText={(maxDiscount) => update({ maxDiscount: maxDiscount.replace(/[^\d.]/g, '') })}
                  keyboardType="decimal-pad"
                />
              ) : null}
              {d.kind === 'subscription' ? (
                <>
                  <Text style={styles.label}>{t.form.rewardProducts}</Text>
                  <MultiOptionChips
                    options={rewardOptions}
                    values={d.rewardProducts.map((r) => r.productId)}
                    labelFor={productName}
                    onToggle={(id) =>
                      update({
                        rewardProducts: d.rewardProducts.some((r) => r.productId === id)
                          ? d.rewardProducts.filter((r) => r.productId !== id)
                          : [...d.rewardProducts, { productId: id, productName: productName(id) }],
                      })
                    }
                  />
                  <Text style={styles.hint}>{t.form.rewardProductsHint}</Text>
                  <ProfileField
                    label={t.form.minPacks}
                    value={d.minPacksPerDay}
                    onChangeText={(minPacksPerDay) => update({ minPacksPerDay: minPacksPerDay.replace(/[^\d]/g, '') })}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.hint}>{t.form.minPacksHint}</Text>
                </>
              ) : null}
              <OfferProblems messages={messagesFor('kind')} />
            </CustomerCard>
          ) : null}
        </>
      )}

      {showErrors && problems.length ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {t.form.fixProblems(problems.length)}
        </Text>
      ) : null}
      {saveError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
      <CustomerPrimaryButton
        label={t.form.save}
        icon="content-save-outline"
        onPress={() => void save()}
        busy={offers.save.isPending}
        disabled={posterBusy}
      />
      <CustomerSecondaryButton label={tc.actions.cancel} onPress={goBack} />

      <OfferPackPickerSheet
        visible={pickerFor !== null}
        products={productItems}
        takenPackIds={(pickerFor === 'combo' ? d.comboRows : d.priceRows).map((r) => r.packId)}
        onClose={() => setPickerFor(null)}
        onPick={(product, pack) => {
          const list = pickerFor === 'combo' ? 'comboRows' : 'priceRows';
          setDraft((prev) => (prev ? { ...prev, [list]: [...prev[list], packRowFrom(product, pack)] } : prev));
          setPickerFor(null);
        }}
      />
    </CustomerScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 10 },
  hint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hintFlex: { flex: 1, minWidth: 0 },
  link: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },
  label: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.textMuted },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  normalPrice: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  total: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  saves: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: '#15803D' },
  error: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.error },
});
