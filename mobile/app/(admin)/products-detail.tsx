import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DeleteProductConfirmDialog } from '@/src/components/admin/DeleteProductConfirmDialog';
import {
  countCustomersUsingProduct,
  deliverySlotName,
  productAvailabilityName,
  productDaysLabel,
  productFeatureName,
  productPackSizes,
  productSpecsLabel,
  productStatus,
  productStatusColors,
  productTypeName,
  productUnitName,
} from '@/src/components/admin/productDisplay';
import { ScreenHeader } from '@/src/components/shared';
import { DetailCardAction, DetailInfo, DetailInfoGrid, DetailSectionCard } from '@/src/components/shared/detailUi';
import type { ProductFormSection } from '@/src/components/admin/ProductFormScreen';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { packPrice, productPacks } from '@/src/domain/products/packs';
import { effectiveUnitPrice } from '@/src/domain/products/pricing';
import { useCustomers } from '@/src/hooks/customers';
import { useDeleteProduct, useProducts } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

/** Details read comfortably up to this width; wider screens center the column. */
const DETAIL_MAX_WIDTH = 960;

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function money(v: number | undefined): string {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${Math.round(n * 100) / 100}` : '—';
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return formatDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, { year: true });
}

function goBackToProducts() {
  if (router.canGoBack()) router.back();
  else router.replace('/(admin)/products');
}

function DetailSection({
  title,
  icon,
  full,
  productId,
  section,
  children,
}: {
  title: string;
  icon: IconName;
  full?: boolean;
  productId?: string;
  /** Form section this card's fields live in, so Edit opens the form there. Omit for read-only cards. */
  section?: ProductFormSection;
  children: ReactNode;
}) {
  // Grid sizing only in the wide (row-wrap) layout; in the phone column `flexBasis` would set a height instead.
  const { isMobile } = useResponsiveLayout();
  const tc = useStrings('common');
  return (
    <DetailSectionCard
      title={title}
      icon={icon}
      style={!isMobile && (full ? styles.sectionFull : styles.sectionHalf)}
      right={
        productId && section ? (
          <DetailCardAction
            label={tc.actions.edit}
            icon="pencil-outline"
            onPress={() => router.push({ pathname: '/(admin)/products-edit', params: { id: productId, section } })}
          />
        ) : undefined
      }
    >
      {children}
    </DetailSectionCard>
  );
}

function ProductHeroImage({ uri, style }: { uri?: string; style: object }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <MaterialCommunityIcons
          name={uri ? 'image-broken-variant' : 'bottle-tonic-outline'}
          size={56}
          color={amraleColors.textSubtle}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

export default function AdminProductDetailScreen() {
  const t = useStrings('products');
  const tc = useStrings('common');
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const products = useProducts();
  const customers = useCustomers();
  const del = useDeleteProduct();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, isMobile } = useResponsiveLayout();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // After a successful delete the product leaves the list; don't flash "not found" while navigating back.
  const deletedRef = useRef(false);

  const product = useMemo<ProductResponse | null>(
    () => (products.data?.items ?? []).find((p) => p.id === id) ?? null,
    [id, products.data?.items],
  );

  const customersUsing = useMemo(
    () => (product ? countCustomersUsingProduct(product.name, customers.data?.items) : 0),
    [product, customers.data?.items],
  );

  const isWide = !isMobile;
  const columnWidth = Math.min(width, DETAIL_MAX_WIDTH) - amraleSpacing.md * 2;
  // Phones: full-width 16:10 photo (capped). Wider screens: a fixed photo beside the summary.
  const imageStyle = isWide
    ? { width: 280, height: 220 }
    : { width: '100%' as const, height: Math.round(Math.min(280, Math.max(180, (columnWidth * 10) / 16))) };

  async function onConfirmDelete() {
    if (!product) return;
    setDeleteError(null);
    try {
      await del.mutateAsync({ id: product.id });
      deletedRef.current = true;
      setConfirmOpen(false);
      goBackToProducts();
    } catch (err) {
      // e.g. still used by customer subscriptions — keep the dialog open and say why
      setDeleteError(err instanceof Error && err.message ? err.message : t.list.deleteFailed);
    }
  }

  const header = (
    <ScreenHeader
      title={t.detail.title}
      onBack={goBackToProducts}
      paddingTop={headerPaddingTop}
      contentMaxWidth={DETAIL_MAX_WIDTH}
    />
  );

  if (!product) {
    const notFound = !products.isLoading && !deletedRef.current;
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerState}>
          {notFound ? (
            <>
              <MaterialCommunityIcons name="package-variant-remove" size={48} color={amraleColors.textSubtle} />
              <Text style={styles.stateTitle}>{t.notFound.title}</Text>
              <Text style={styles.stateHint}>
                {products.isError ? t.notFound.loadFailed : t.notFound.maybeDeleted}
              </Text>
              <Pressable
                onPress={goBackToProducts}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>{t.notFound.backToProducts}</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={amraleColors.blue} size="large" />
          )}
        </View>
      </View>
    );
  }

  const status = productStatus(product);
  const statusColors = productStatusColors(status.tone);
  const finalPrice = effectiveUnitPrice(product);
  const hasDiscount = finalPrice < product.price;
  const packSizes = productPackSizes(product);
  // Each size with its own price; sizes carried over from before packs were priced are flagged for the admin.
  const packs = productPacks(product);
  const packsNeedingPrice = packs.filter((pk) => pk.needsPricing);
  const slots = product.deliveryTimeSlots?.length ? product.deliveryTimeSlots.map(deliverySlotName).join(', ') : t.detail.notSet;
  const taxLabel = product.taxApplicable ? product.taxPercentage ?? t.detail.taxApplicable : t.detail.taxNotApplicable;

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingBottom(amraleSpacing.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={[styles.heroCard, isWide && styles.heroCardWide]}>
            <ProductHeroImage key={product.imageUri ?? 'none'} uri={product.imageUri} style={[styles.heroImage, imageStyle]} />

            <View style={styles.heroInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.specs}>{productSpecsLabel(product)}</Text>

              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
                  <Text style={[styles.badgeText, { color: statusColors.fg }]}>{status.label}</Text>
                </View>
                {product.category && product.category !== product.productType ? (
                  <View style={[styles.badge, styles.badgeNeutral]}>
                    <Text style={[styles.badgeText, styles.badgeNeutralText]}>{product.category.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(finalPrice)}</Text>
                {hasDiscount ? (
                  <>
                    <Text style={styles.priceOriginal}>{money(product.price)}</Text>
                    <Text style={styles.priceSave}>{t.detail.save(money(product.price - finalPrice))}</Text>
                  </>
                ) : null}
              </View>
              <Text style={styles.priceUnit}>{t.detail.perPack(packSizes[0] ?? '')}</Text>

              <View style={styles.usageRow}>
                <MaterialCommunityIcons name="account-group-outline" size={16} color={amraleColors.textMuted} />
                <Text style={styles.usageText}>
                  {customersUsing === 0 ? t.detail.notUsed : t.detail.usedIn(customersUsing)}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => router.push({ pathname: '/(admin)/products-edit', params: { id: product.id } })}
                  style={({ pressed }) => [styles.primaryBtn, styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.list.editItem(product.name)}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={amraleColors.white} />
                  <Text style={styles.primaryBtnText}>{tc.actions.edit}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setDeleteError(null);
                    setConfirmOpen(true);
                  }}
                  style={({ pressed }) => [styles.dangerBtn, styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.list.deleteItem(product.name)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={amraleColors.error} />
                  <Text style={styles.dangerBtnText}>{tc.actions.delete}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[styles.sections, isWide && styles.sectionsWide]}>
            <DetailSection productId={product.id} section="pricing" title={t.detail.pricingTitle} icon="currency-inr">
              <DetailInfo label={t.detail.price} value={money(product.price)} wide={false} />
              <DetailInfo label={t.detail.discountPrice} value={hasDiscount ? money(finalPrice) : t.detail.none} wide={false} />
              <DetailInfo label={t.detail.customerPays} value={money(finalPrice)} wide={false} />
              <DetailInfo label={t.detail.tax} value={taxLabel} wide={false} />
            </DetailSection>

            <DetailSection productId={product.id} section="pack" title={t.detail.packTitle} icon="scale-balance">
              <DetailInfo label={t.detail.productType} value={product.productType ? productTypeName(product.productType) : '—'} wide={false} />
              <DetailInfo label={t.detail.unit} value={productUnitName(product.unit)} wide={false} />
              <DetailInfo
                label={packs.length > 1 ? t.detail.packSizes(packs.length) : t.detail.packSize}
                value={packs.length ? packs.map((pk) => `${pk.label} ${money(packPrice(pk))}`).join(' · ') : packSizes.join(', ')}
                wide={false}
                full
              />
              {packsNeedingPrice.length ? (
                <DetailInfo
                  label={t.detail.needsPricing}
                  value={t.detail.needsPricingText(
                    packsNeedingPrice.map((pk) => pk.label).join(', '),
                    packsNeedingPrice.length,
                  )}
                  wide={false}
                full
                />
              ) : null}
              <DetailInfo label={t.detail.sku} value={product.sku?.trim() || '—'} wide={false} />
            </DetailSection>

            <DetailSection productId={product.id} section="availability" title={t.detail.availabilityTitle} icon="truck-delivery-outline">
              <DetailInfo label={t.detail.availability} value={productAvailabilityName(product.availability)} wide={false} />
              <DetailInfo label={t.detail.deliveryDays} value={productDaysLabel(product.availableDays)} wide={false} />
              <DetailInfo label={t.detail.deliverySlots} value={slots} wide={false} />
            </DetailSection>

            <DetailSection productId={product.id} section="channels" title={t.detail.channelsTitle} icon="storefront-outline">
              <DetailInfo label={t.detail.onlineCustomers} value={product.isVisibleToCustomer ? t.detail.visible : t.detail.hidden} wide={false} />
              <DetailInfo label={t.detail.offlineCounter} value={product.isVisibleOfflineCounter ? t.detail.available : t.detail.notAvailable} wide={false} />
              <DetailInfo label={t.detail.status} value={product.isActive ? t.detail.active : t.detail.inactive} wide={false} />
            </DetailSection>

            <DetailSection productId={product.id} section="features" title={t.detail.featuresTitle} icon="star-outline" full>
              {product.features?.length ? (
                <View style={styles.chipWrap}>
                  {product.features.map((f) => (
                    <View key={f} style={styles.chip}>
                      <Text style={styles.chipText}>{productFeatureName(f)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>{t.detail.noFeatures}</Text>
              )}
            </DetailSection>

            <DetailSection productId={product.id} section="description" title={t.detail.descriptionTitle} icon="text-box-outline" full>
              <Text style={product.description?.trim() ? styles.description : styles.muted}>
                {product.description?.trim() || t.detail.noDescription}
              </Text>
            </DetailSection>

            <DetailSection title={t.detail.recordTitle} icon="clock-outline" full>
              <DetailInfo label={t.detail.addedOn} value={fmtDate(product.createdAt)} wide={false} />
              <DetailInfo label={t.detail.lastUpdated} value={fmtDate(product.updatedAt)} wide={false} />
            </DetailSection>
          </View>
        </View>
      </ScrollView>

      <DeleteProductConfirmDialog
        visible={confirmOpen}
        productName={product.name}
        loading={del.isPending}
        errorMessage={deleteError}
        onDismiss={() => {
          if (del.isPending) return;
          setConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md },
  column: { width: '100%', maxWidth: DETAIL_MAX_WIDTH, alignSelf: 'center', gap: amraleSpacing.md },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: amraleSpacing.lg },
  stateTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.text },
  stateHint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },

  heroCard: {
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  heroCardWide: { flexDirection: 'row', alignItems: 'flex-start' },
  heroImage: { borderRadius: amraleRadius.md, overflow: 'hidden', backgroundColor: amraleColors.inputBgLight },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1, minWidth: 0, gap: 6 },
  productName: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 22, color: amraleColors.text },
  specs: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: amraleRadius.pill },
  badgeText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 10, letterSpacing: 0.5 },
  badgeNeutral: { backgroundColor: amraleColors.inputBgLight },
  badgeNeutralText: { color: amraleColors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  price: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 28, color: amraleColors.blue },
  priceOriginal: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 16,
    color: amraleColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  priceSave: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: '#15803D' },
  priceUnit: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  usageText: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: amraleSpacing.sm },
  actionBtn: { flexGrow: 1, flexBasis: 120 },
  primaryBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
  },
  primaryBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.white },
  dangerBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.35)',
    backgroundColor: 'rgba(225, 29, 72, 0.06)',
  },
  dangerBtnText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.error },
  pressed: { opacity: 0.88 },

  sections: { gap: amraleSpacing.md },
  // Two columns from tablet up; "full" sections (features, description, record) span the row.
  sectionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  section: {
    minWidth: 0,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
  },
  // 340 basis → exactly two per row in the 960 column (and on 768 tablets), never an orphaned third.
  sectionHalf: { flexGrow: 1, flexBasis: 340 },
  sectionFull: { flexBasis: '100%' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: amraleColors.inputBorderLight,
  },
  detailLabel: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  detailValue: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: amraleRadius.pill,
    backgroundColor: 'rgba(53, 81, 161, 0.08)',
  },
  chipText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: amraleColors.blue },
  description: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 21, color: amraleColors.text },
  muted: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
});
