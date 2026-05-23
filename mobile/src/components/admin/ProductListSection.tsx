import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Menu } from 'react-native-paper';

import { DeleteProductConfirmDialog } from '@/src/components/admin/DeleteProductConfirmDialog';
import type { ProductResponse } from '@/src/domain/products/dtos';
import { useDeleteProduct, useProducts } from '@/src/hooks/products';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

type SortBy = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc';

function statusForProduct(p: ProductResponse): { label: string; tone: 'blue' | 'gray' | 'red' } {
  if (p.availableStock <= 0 || p.availability === 'Out of Stock') {
    return { label: 'OUT OF STOCK', tone: 'red' };
  }
  if (p.isActive) return { label: 'ACTIVE', tone: 'blue' };
  return { label: 'INACTIVE', tone: 'gray' };
}

function specsLabelForProduct(p: ProductResponse): string {
  const volume = (p.customVariantLabel ?? '').trim() || p.variants?.[0] || `1 ${p.unit}`;
  const type = p.productType || p.category;
  return `${volume} • ${type}`;
}

function badgeColors(tone: 'red' | 'blue' | 'gray') {
  switch (tone) {
    case 'red':
      return { bg: 'rgba(225, 29, 72, 0.1)', fg: amraleColors.error };
    case 'blue':
      return { bg: 'rgba(53, 81, 161, 0.12)', fg: amraleColors.blue };
    default:
      return { bg: 'rgba(100, 116, 139, 0.14)', fg: amraleColors.textMuted };
  }
}

function sortLabel(sortBy: SortBy): string {
  switch (sortBy) {
    case 'name_desc':
      return 'Z to A';
    case 'price_asc':
      return 'Price ↑';
    case 'price_desc':
      return 'Price ↓';
    default:
      return 'A to Z';
  }
}

type ProductListSectionProps = {
  bottomInset?: number;
};

export function ProductListSection({ bottomInset = 0 }: ProductListSectionProps) {
  const products = useProducts();
  const del = useDeleteProduct();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name_asc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const all = products.data?.items ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = all;

    if (q) {
      items = items.filter((p) => `${p.name} ${p.category} ${p.productType}`.toLowerCase().includes(q));
    }

    const priceValue = (p: ProductResponse) =>
      p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price;

    switch (sortBy) {
      case 'name_desc':
        items = [...items].sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price_asc':
        items = [...items].sort((a, b) => priceValue(a) - priceValue(b));
        break;
      case 'price_desc':
        items = [...items].sort((a, b) => priceValue(b) - priceValue(a));
        break;
      case 'name_asc':
      default:
        items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  }, [all, query, sortBy]);

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
    } catch {
      // keep dialog open
    }
  }

  if (products.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search dairy products..."
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.actionRow}>
          <Menu
            visible={sortMenuOpen}
            onDismiss={() => setSortMenuOpen(false)}
            anchor={
              <Pressable
                onPress={() => setSortMenuOpen(true)}
                style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="sort-alphabetical-ascending" size={18} color={amraleColors.blue} />
                <Text style={styles.pillBtnText}>{sortLabel(sortBy)}</Text>
              </Pressable>
            }
          >
            <Menu.Item title="A to Z" onPress={() => { setSortBy('name_asc'); setSortMenuOpen(false); }} />
            <Menu.Item title="Z to A" onPress={() => { setSortBy('name_desc'); setSortMenuOpen(false); }} />
            <Menu.Item title="Price (low to high)" onPress={() => { setSortBy('price_asc'); setSortMenuOpen(false); }} />
            <Menu.Item title="Price (high to low)" onPress={() => { setSortBy('price_desc'); setSortMenuOpen(false); }} />
          </Menu>

          <Pressable
            onPress={() => router.push('/(admin)/products-add')}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={amraleColors.white} />
            <Text style={styles.addBtnText}>Add Product</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: amraleSpacing.xl + bottomInset }]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No products match your search.</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const status = statusForProduct(p);
          const badge = badgeColors(status.tone);
          const showPrice = p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price;
          const isDimmed = status.label === 'INACTIVE';

          return (
            <View style={[styles.card, isDimmed && styles.cardDimmed]}>
              <View style={styles.imageWrap}>
                {p.imageUri ? (
                  <Image source={{ uri: p.imageUri }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialCommunityIcons name="image-outline" size={28} color={amraleColors.textSubtle} />
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.metaCol}>
                    <Text style={[styles.productName, isDimmed && styles.textDimmed]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.specs, isDimmed && styles.textDimmed]} numberOfLines={1}>
                      {specsLabelForProduct(p)}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>{status.label}</Text>
                    </View>
                  </View>

                  <View style={styles.sideCol}>
                    <View style={styles.iconRow}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/(admin)/products-edit', params: { id: p.id } })}
                        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                        hitSlop={8}
                        accessibilityLabel={`Edit ${p.name}`}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={20} color={amraleColors.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setDeleteTarget({ id: p.id, name: p.name });
                          setConfirmOpen(true);
                        }}
                        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                        hitSlop={8}
                        accessibilityLabel={`Delete ${p.name}`}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={amraleColors.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={[styles.price, isDimmed && styles.priceDimmed]}>
                      ₹{showPrice ? p.discountPrice : p.price}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      <DeleteProductConfirmDialog
        visible={confirmOpen && !!deleteTarget}
        productName={deleteTarget?.name ?? ''}
        loading={del.isPending}
        onDismiss={() => {
          if (del.isPending) return;
          setConfirmOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={onConfirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    gap: amraleSpacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  pillBtnText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.text,
  },
  addBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    color: amraleColors.white,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.xl,
    gap: 12,
  },
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
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flex: 1, flexDirection: 'row', gap: 8 },
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
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: amraleRadius.pill,
  },
  badgeText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sideCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingTop: 2,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 20,
    color: amraleColors.blue,
  },
  priceDimmed: { color: amraleColors.textMuted },
  textDimmed: { color: amraleColors.textSubtle },
  pressed: { opacity: 0.88 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.textMuted,
  },
});
