import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';

import { ADMIN_LIST_GAP, useAdminListGrid } from '@/src/components/admin/AdminListScreenLayout';
import {
  AdminListControls,
  AdminListEmptyState,
  AdminListErrorState,
  type AdminListSortOption,
} from '@/src/components/shared/adminListUi';
import { DeleteProductConfirmDialog } from '@/src/components/admin/DeleteProductConfirmDialog';
import { productSpecsLabel, productStatus, productStatusColors, productTypeName } from '@/src/components/admin/productDisplay';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { effectiveUnitPrice } from '@/src/domain/products/pricing';
import { useDeleteProduct, useProducts } from '@/src/hooks/products';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type SortBy = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';

const ALL_TYPES = 'all';
/** Filter key for products with neither a type nor a category. */
const OTHER_TYPE = 'Other';

/** Sort menu entries, worded in the current language (read at render). */
function sortOptions(): AdminListSortOption<SortBy>[] {
  const s = strings('products').list.sort;
  return [
    { key: 'name_asc', label: s.nameAsc, short: s.nameAscShort, icon: 'sort-alphabetical-ascending' },
    { key: 'name_desc', label: s.nameDesc, short: s.nameDescShort, icon: 'sort-alphabetical-descending' },
    { key: 'price_asc', label: s.priceAsc, short: s.priceAscShort, icon: 'sort-numeric-ascending' },
    { key: 'price_desc', label: s.priceDesc, short: s.priceDescShort, icon: 'sort-numeric-descending' },
  ];
}

function productTypeOf(p: ProductResponse): string {
  return (p.productType || p.category || OTHER_TYPE).trim();
}

function ProductTileImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={styles.imagePlaceholder}>
        <MaterialCommunityIcons name="image-broken-variant" size={28} color={amraleColors.textSubtle} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.productImage} resizeMode="cover" onError={() => setFailed(true)} />;
}

function ProductCard({
  product: p,
  cellStyle,
  onDelete,
}: {
  product: ProductResponse;
  cellStyle: ViewStyle | undefined;
  onDelete: (p: ProductResponse) => void;
}) {
  const t = useStrings('products');
  const status = productStatus(p);
  const badge = productStatusColors(status.tone);
  const isDimmed = status.tone === 'gray';
  const price = effectiveUnitPrice(p);
  const hasDiscount = price < p.price;

  return (
    // The whole card opens the product details; the edit/delete buttons inside handle their own taps.
    <Pressable
      onPress={() => router.push({ pathname: '/(admin)/products-detail', params: { id: p.id } })}
      style={({ pressed }) => [styles.card, cellStyle, isDimmed && styles.cardDimmed, pressed && styles.cardPressed]}
      // No `button` role: on web that renders a <button>, and the edit/delete buttons inside would be invalid nested buttons.
      accessibilityLabel={t.list.viewDetails(p.name)}
    >
      <View style={styles.imageWrap}>
        {p.imageUri ? (
          <ProductTileImage key={p.imageUri} uri={p.imageUri} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="image-outline" size={28} color={amraleColors.textSubtle} />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.metaCol}>
            <Text style={[styles.productName, isDimmed && styles.textDimmed]} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={[styles.specs, isDimmed && styles.textDimmed]} numberOfLines={2}>
              {productSpecsLabel(p)}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>{status.label}</Text>
            </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.iconRow}>
            <Pressable
              onPress={() => router.push({ pathname: '/(admin)/products-edit', params: { id: p.id } })}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.list.editItem(p.name)}
            >
              <View style={[styles.iconCircle, styles.iconCircleEdit]}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={amraleColors.blue} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => onDelete(p)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.list.deleteItem(p.name)}
            >
              <View style={[styles.iconCircle, styles.iconCircleDelete]}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={amraleColors.error} />
              </View>
            </Pressable>
          </View>

          <View style={styles.priceRow}>
            {hasDiscount ? <Text style={styles.priceOriginal}>₹{p.price}</Text> : null}
            <Text style={[styles.price, isDimmed && styles.priceDimmed]}>₹{price}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type ProductListSectionProps = {
  bottomInset?: number;
};

export function ProductListSection({ bottomInset = 0 }: ProductListSectionProps) {
  const t = useStrings('products');
  const tc = useStrings('common');
  const products = useProducts();
  const del = useDeleteProduct();
  const grid = useAdminListGrid();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [sortBy, setSortBy] = useState<SortBy>('name_asc');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const all = products.data?.items ?? [];

  /** [type, count] for the filter chips, alphabetical. */
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of all) counts.set(productTypeOf(p), (counts.get(productTypeOf(p)) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [all]);

  const activeCount = useMemo(() => all.filter((p) => p.isActive).length, [all]);

  // A type that no longer exists (e.g. its last product was deleted) falls back to "All".
  const effectiveType = typeFilter === ALL_TYPES || typeCounts.some(([t]) => t === typeFilter) ? typeFilter : ALL_TYPES;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = all;

    if (effectiveType !== ALL_TYPES) {
      items = items.filter((p) => productTypeOf(p) === effectiveType);
    }
    if (q) {
      items = items.filter((p) => `${p.name} ${p.category} ${p.productType}`.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'name_desc':
        return [...items].sort((a, b) => b.name.localeCompare(a.name));
      case 'price_asc':
        return [...items].sort((a, b) => effectiveUnitPrice(a) - effectiveUnitPrice(b));
      case 'price_desc':
        return [...items].sort((a, b) => effectiveUnitPrice(b) - effectiveUnitPrice(a));
      case 'name_asc':
      default:
        return [...items].sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [all, query, sortBy, effectiveType]);

  const isFiltering = query.trim() !== '' || effectiveType !== ALL_TYPES;
  const summaryText = isFiltering
    ? t.list.showing(filtered.length, all.length)
    : t.list.summary(all.length, activeCount);

  function clearFilters() {
    setQuery('');
    setTypeFilter(ALL_TYPES);
  }

  function requestDelete(p: ProductResponse) {
    setDeleteError(null);
    setDeleteTarget({ id: p.id, name: p.name });
    setConfirmOpen(true);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      // keep dialog open and explain why (e.g. product still used by customer subscriptions)
      setDeleteError(err instanceof Error && err.message ? err.message : t.list.deleteFailed);
    }
  }

  if (products.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  if (products.isError && !all.length) {
    return <AdminListErrorState title={t.list.loadFailed} onRetry={() => void products.refetch()} />;
  }

  const chipItems = [
    { key: ALL_TYPES, label: tc.states.all, count: all.length },
    ...typeCounts.map(([type, count]) => ({
      key: type,
      label: type === OTHER_TYPE ? t.list.otherType : productTypeName(type),
      count,
    })),
  ];

  return (
    <View style={styles.wrap}>
      <AdminListControls
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={t.list.searchPlaceholder}
        searchFieldName="product-search"
        sortOptions={sortOptions()}
        sortBy={sortBy}
        onSortChange={setSortBy}
        chips={chipItems}
        activeChip={effectiveType}
        onChipChange={setTypeFilter}
        summaryText={summaryText}
        addLabel={t.list.add}
        onAdd={() => router.push('/(admin)/products-add')}
        isMobile={grid.isMobile}
        containerStyle={grid.containerStyle}
      />

      <FlatList
        data={filtered}
        key={grid.columns}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? styles.gridRow : undefined}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.listContent, grid.containerStyle, { paddingBottom: amraleSpacing.xl + bottomInset }]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <AdminListEmptyState
            icon={all.length ? 'filter-off-outline' : 'package-variant'}
            title={all.length ? t.list.noMatchTitle : t.list.emptyTitle}
            text={all.length ? t.list.noMatchText : t.list.emptyText}
            actionLabel={all.length ? t.list.clearFilters : t.list.add}
            onAction={all.length ? clearFilters : () => router.push('/(admin)/products-add')}
          />
        }
        renderItem={({ item }) => <ProductCard product={item} cellStyle={grid.cellStyle} onDelete={requestDelete} />}
      />

      <DeleteProductConfirmDialog
        visible={confirmOpen && !!deleteTarget}
        productName={deleteTarget?.name ?? ''}
        loading={del.isPending}
        errorMessage={deleteError}
        onDismiss={() => {
          if (del.isPending) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: amraleSpacing.lg },

  // Breathing room below the header (the search bar used to sit right on its border).

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.xl,
    gap: ADMIN_LIST_GAP,
  },
  gridRow: { gap: ADMIN_LIST_GAP },
  card: {
    flexDirection: 'row',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDimmed: { opacity: 0.72 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  imageWrap: {
    width: 72,
    height: 72,
    borderRadius: amraleRadius.md,
    overflow: 'hidden',
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 6 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaCol: { flex: 1, minWidth: 0, gap: 4 },
  productName: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.text,
  },
  specs: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
  },
  badgeText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // 44px tap targets around 34px tinted circles; the negative margin keeps the visible circles flush with the card padding.
  iconRow: { flexDirection: 'row', marginLeft: -5, marginBottom: -5 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconCircleEdit: { backgroundColor: 'rgba(53, 81, 161, 0.08)' },
  iconCircleDelete: { backgroundColor: 'rgba(225, 29, 72, 0.08)' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 },
  price: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 20,
    color: amraleColors.blue,
  },
  priceOriginal: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  priceDimmed: { color: amraleColors.textMuted },
  textDimmed: { color: amraleColors.textSubtle },
  pressed: { opacity: 0.88 },

});
