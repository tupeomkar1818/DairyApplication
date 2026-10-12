import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { FieldError, FieldLabel } from '@/src/components/admin/productFormFields';
import {
  emptyExtraPack,
  type ExtraPackDraft,
  type ExtraPackFieldErrors,
} from '@/src/components/admin/productFormShared';
import type { ProductUnit } from '@/src/domain/products/enums';
import { packUnitRateLabel, parsePackQuantity } from '@/src/domain/products/packs';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/**
 * The product's other pack sizes, under its first pack: one row per size, each with its own price.
 *
 * This is how the admin lists "Taaza Milk" once with 500 ml at ₹27 and 1 L at ₹59, instead of two products.
 */
export function ProductExtraPacksEditor({
  rows,
  unit,
  firstPackLabel,
  errors,
  listError,
  onChange,
}: {
  rows: readonly ExtraPackDraft[];
  /** The product's unit, used to read a size typed without one ("2" on a Litre product). */
  unit: ProductUnit;
  /** Shown on the "Pack 1" line so the admin sees what the rows sit next to. */
  firstPackLabel: string;
  errors: Record<number, ExtraPackFieldErrors>;
  listError?: string;
  onChange: (next: ExtraPackDraft[]) => void;
}) {
  const t = useStrings('products');
  const update = (index: number, patch: Partial<ExtraPackDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch, needsPricing: patch.price !== undefined ? false : row.needsPricing } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, emptyExtraPack()]);

  return (
    <View style={styles.block}>
      <View style={styles.headRow}>
        <FieldLabel>{t.packs.title}</FieldLabel>
        <Text style={styles.headHint} numberOfLines={1}>
          {firstPackLabel ? t.packs.firstIs(firstPackLabel) : t.packs.firstIsAbove}
        </Text>
      </View>
      <Text style={styles.help}>{t.packs.help}</Text>

      {rows.map((row, index) => {
        const rowErrors = errors[index] ?? {};
        const price = Number(row.price);
        const discount = Number(row.discountPrice);
        const size = parsePackQuantity(row.label, unit);
        const rate =
          row.label.trim() && price > 0
            ? packUnitRateLabel({ price, discountPrice: discount > 0 ? discount : undefined, ...size })
            : '';

        return (
          <View key={row.id || `new_${index}`} style={[styles.row, !row.isActive && styles.rowOff]}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{t.packs.packTitle(index + 2)}</Text>
              <View style={styles.rowActions}>
                <Text style={styles.onSaleText}>{row.isActive ? t.packs.onSale : t.packs.hidden}</Text>
                <Switch
                  value={row.isActive}
                  onValueChange={(isActive) => update(index, { isActive })}
                  trackColor={{ true: amraleColors.blue, false: amraleColors.inputBorderLight }}
                  accessibilityLabel={t.packs.onSaleLabel(index + 2)}
                />
                <Pressable
                  onPress={() => remove(index)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.packs.removeLabel(index + 2)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={amraleColors.error} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.packs.sizeLabel}</FieldLabel>
              <View style={[styles.inputRow, rowErrors.label && styles.inputRowError]}>
                <MaterialCommunityIcons name="package-variant-closed" size={20} color={amraleColors.blue} />
                <TextInput
                  value={row.label}
                  onChangeText={(label) => update(index, { label })}
                  placeholder={t.packs.sizePlaceholder}
                  placeholderTextColor={amraleColors.textSubtle}
                  maxLength={30}
                  style={styles.inputText}
                />
              </View>
              <FieldError message={rowErrors.label} />
            </View>

            <View style={styles.row2}>
              <View style={[styles.fieldBlock, styles.fieldCell]}>
                <FieldLabel>{t.packs.price}</FieldLabel>
                <View style={[styles.inputRow, rowErrors.price && styles.inputRowError]}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    value={row.price}
                    onChangeText={(t) => update(index, { price: t.replace(/[^\d.]/g, '') })}
                    placeholder="0.00"
                    placeholderTextColor={amraleColors.textSubtle}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                  />
                </View>
                <FieldError message={rowErrors.price} />
              </View>

              <View style={[styles.fieldBlock, styles.fieldCell]}>
                <FieldLabel>{t.packs.discountOptional}</FieldLabel>
                <View style={[styles.inputRow, rowErrors.discountPrice && styles.inputRowError]}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    value={row.discountPrice}
                    onChangeText={(t) => update(index, { discountPrice: t.replace(/[^\d.]/g, '') })}
                    placeholder={t.packs.noDiscount}
                    placeholderTextColor={amraleColors.textSubtle}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                  />
                </View>
                <FieldError message={rowErrors.discountPrice} />
              </View>
            </View>

            {row.needsPricing ? (
              <Text style={styles.warn}>{t.packs.needsPricing}</Text>
            ) : rate ? (
              <Text style={styles.rate}>{rate}</Text>
            ) : null}
          </View>
        );
      })}

      <FieldError message={listError} />

      <Pressable
        onPress={add}
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.packs.add}
      >
        <MaterialCommunityIcons name="plus" size={18} color={amraleColors.blue} />
        <Text style={styles.addText}>{t.packs.add}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headHint: { flexShrink: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  help: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textSubtle },

  row: {
    gap: amraleSpacing.sm,
    padding: 12,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    backgroundColor: amraleColors.white,
  },
  rowOff: { opacity: 0.7 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 14, color: amraleColors.text },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onSaleText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: amraleColors.textMuted },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  fieldBlock: { gap: 8 },
  row2: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: amraleSpacing.sm },
  fieldCell: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
  },
  inputRowError: { borderColor: amraleColors.error },
  inputText: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
    // Web-only: native outlineStyle accepts solid/dotted/dashed, not 'none'.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  } as never,
  rupee: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.blue },

  rate: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  warn: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, lineHeight: 17, color: '#B45309' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: amraleColors.blue,
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  addText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.blue },
  pressed: { opacity: 0.88 },
});
