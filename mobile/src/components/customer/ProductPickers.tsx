import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { productPriceHint, searchProducts } from '@/src/components/customer/productPicking';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, packDiscountPercent, packPrice, packUnitRateLabel } from '@/src/domain/products/packs';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';

/** Step one of adding something: pick a product. Search appears once the list is long enough to need it. */
export function ProductList({
  products,
  onPick,
  emptyText,
}: {
  products: readonly ProductResponse[];
  onPick: (product: ProductResponse) => void;
  emptyText: string;
}) {
  const t = useStrings('customer').productPicker;
  const [query, setQuery] = useState('');
  const shown = useMemo(() => searchProducts(products, query), [products, query]);

  if (products.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.list}>
      {products.length > 6 ? (
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={amraleColors.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.search}
            placeholderTextColor={amraleColors.textSubtle}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </View>
      ) : null}

      {shown.length === 0 ? <Text style={styles.empty}>{t.noMatch}</Text> : null}

      {shown.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPick(p)}
          style={({ pressed }) => [styles.productRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${productPriceHint(p)}`}
        >
          <ProductThumb uri={p.imageUri} />
          <View style={styles.productText}>
            <Text style={styles.productName} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.productMeta} numberOfLines={1}>
              {[p.category, orderablePacks(p).map((pk) => pk.label).join(' · ')].filter(Boolean).join(' • ')}
            </Text>
          </View>
          <Text style={styles.productPrice}>{productPriceHint(p)}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={amraleColors.textSubtle} />
        </Pressable>
      ))}
    </View>
  );
}

function ProductThumb({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.thumb, styles.thumbPlaceholder]}>
        <MaterialCommunityIcons name="bottle-soda-classic-outline" size={20} color={amraleColors.textSubtle} />
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" onError={() => setFailed(true)} />;
}

/** The chosen product at the top of step two, with a way back to the list. */
export function ChosenProduct({ product, onChange }: { product: ProductResponse; onChange?: () => void }) {
  const t = useStrings('customer').productPicker;
  return (
    <View style={styles.chosen}>
      <ProductThumb uri={product.imageUri} />
      <View style={styles.productText}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productMeta}>{product.category}</Text>
      </View>
      {onChange ? (
        <Pressable onPress={onChange} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.changeA11y}>
          <Text style={styles.changeText}>{t.change}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Step two: the pack sizes, each with its own price. A single pack is shown, not offered as a choice. With
 * `offerPrice`, a pack on offer for the day being ordered shows its offer price, the normal price struck through and
 * an offer tag.
 */
export function PackOptions({
  product,
  value,
  onChange,
  offerPrice,
}: {
  product: ProductResponse;
  value: ProductPack | null;
  onChange: (pack: ProductPack) => void;
  /** A pack's offer price for the day being ordered, or null when it has none. */
  offerPrice?: (pack: ProductPack) => number | null;
}) {
  const t = useStrings('customer').productPicker;
  const offerWords = useStrings('offers');
  const packs = orderablePacks(product);
  return (
    <View style={styles.packs}>
      <Text style={styles.label}>{packs.length > 1 ? t.packSize : t.pack}</Text>
      {packs.map((pack) => {
        const selected = pack.id === value?.id;
        const off = packDiscountPercent(pack);
        const rate = packUnitRateLabel(pack);
        const offered = offerPrice?.(pack) ?? null;
        const deal = offered != null && offered < packPrice(pack) ? Math.round(offered) : null;
        return (
          <Pressable
            key={pack.id}
            onPress={() => onChange(pack)}
            disabled={packs.length === 1}
            style={({ pressed }) => [styles.packRow, selected && styles.packRowSelected, pressed && styles.pressed]}
            accessibilityRole={packs.length > 1 ? 'button' : undefined}
            accessibilityState={{ selected }}
            accessibilityLabel={`${pack.label}, ₹${deal ?? packPrice(pack)}${deal != null ? `, ${offerWords.offer}` : ''}`}
          >
            <View style={styles.productText}>
              <Text style={styles.packLabel}>{pack.label}</Text>
              {rate ? <Text style={styles.packRate}>{rate}</Text> : null}
              {deal != null ? <Text style={styles.offerTag}>{offerWords.offer}</Text> : null}
            </View>
            <View style={styles.packPrices}>
              <Text style={styles.packPrice}>{`₹${deal ?? packPrice(pack)}`}</Text>
              {deal != null ? (
                <Text style={styles.packMrp}>{`₹${packPrice(pack)}`}</Text>
              ) : off > 0 ? (
                <Text style={styles.packMrp}>{`₹${Math.round(pack.price)}`}</Text>
              ) : null}
            </View>
            {packs.length > 1 ? (
              <MaterialCommunityIcons
                name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                size={20}
                color={selected ? '#15803D' : amraleColors.textSubtle}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: amraleColors.textMuted,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.text,
    // Web-only: native outlineStyle accepts solid/dotted/dashed, not 'none'.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  } as never,

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  thumb: { width: 44, height: 44, borderRadius: amraleRadius.md },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: amraleColors.inputBgLight },
  productText: { flex: 1, minWidth: 0 },
  productName: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  productMeta: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  productPrice: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.blue },

  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
  },
  changeText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },

  label: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  packs: { gap: 8 },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  packRowSelected: { borderColor: '#15803D', backgroundColor: 'rgba(22, 163, 74, 0.05)' },
  packLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  packRate: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  packPrices: { alignItems: 'flex-end' },
  offerTag: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: '#a3246b',
    backgroundColor: '#fbe3f0',
  },
  packPrice: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  packMrp: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textSubtle,
    textDecorationLine: 'line-through',
  },
  pressed: { opacity: 0.88 },
});
