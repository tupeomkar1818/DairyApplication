import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CustomerSheet } from '@/src/components/customer/customerUi';
import type { ProductResponse } from '@/src/domain/products/dtos';
import type { ProductPack } from '@/src/domain/products/entities';
import { orderablePacks, packPrice } from '@/src/domain/products/packs';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleTypography } from '@/src/theme/dairyTactile';
import { formatMoney } from '@/src/utils/format';

/**
 * Picks one catalog pack for a price offer or a combo: active products with their active packs and normal prices.
 * Packs already on the offer are shown as added and cannot be picked twice.
 */
export function OfferPackPickerSheet({
  visible,
  products,
  takenPackIds,
  onPick,
  onClose,
}: {
  visible: boolean;
  products: readonly ProductResponse[];
  takenPackIds: readonly string[];
  onPick: (product: ProductResponse, pack: ProductPack) => void;
  onClose: () => void;
}) {
  const t = useStrings('offerAdmin').form;
  const listed = products
    .filter((p) => p.isActive !== false)
    .map((p) => ({ product: p, packs: orderablePacks(p) }))
    .filter((x) => x.packs.length > 0)
    .sort((a, b) => a.product.name.localeCompare(b.product.name));

  return (
    <CustomerSheet visible={visible} title={t.pickPackTitle} subtitle={t.pickPackHint} onClose={onClose}>
      {listed.length === 0 ? <Text style={styles.empty}>{t.noProducts}</Text> : null}
      {listed.map(({ product, packs }) => (
        <View key={product.id} style={styles.product}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.packRow}>
            {packs.map((pack) => {
              const taken = takenPackIds.includes(pack.id);
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => onPick(product, pack)}
                  disabled={taken}
                  style={({ pressed }) => [styles.pack, taken && styles.packTaken, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: taken }}
                  accessibilityLabel={`${product.name} ${pack.label} ${formatMoney(packPrice(pack))}`}
                >
                  {taken ? <MaterialCommunityIcons name="check" size={14} color={amraleColors.textMuted} /> : null}
                  <Text style={styles.packLabel}>{pack.label}</Text>
                  <Text style={styles.packPrice}>{taken ? t.added : formatMoney(packPrice(pack))}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </CustomerSheet>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },
  product: { gap: 8 },
  productName: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  packTaken: { backgroundColor: amraleColors.inputBgLight, opacity: 0.7 },
  packLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.text },
  packPrice: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 13, color: amraleColors.blue },
  pressed: { opacity: 0.85 },
});
