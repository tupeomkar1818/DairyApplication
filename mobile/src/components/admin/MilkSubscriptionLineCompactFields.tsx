import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { planLineTotal } from '@/src/components/admin/customerSubscriptionMonthUtils';
import type { CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import type { Product } from '@/src/domain/products/entities';

import {
  defaultPackLabelWhenNoOptions,
  isMilkCatalogProduct,
  moneyInr,
  packSizeOptionsForProduct,
} from '@/src/components/admin/milkSubscriptionLineUi';
import { formFieldAttrs } from '@/src/theme/platformStyles';

const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  text: '#1E293B',
};

export type MilkSubscriptionLineCompactFieldsProps = {
  products: Product[];
  draft: CustomerSubscriptionPlanDto;
  onPatch: (patch: Partial<CustomerSubscriptionPlanDto>) => void;
  /** When true, opens the product picker dialog automatically. */
  autoOpenProductPicker?: boolean;
  /** Optional filter for which products appear in the picker. Default: milk catalog products only. */
  productFilter?: (p: Product) => boolean;
  /** Optional label override for the product field / picker. */
  productFieldLabel?: string;
  /** Optional title override for the picker dialog. */
  productPickerTitle?: string;
  scheme: 'light' | 'dark' | null | undefined;
  textMain: object;
  textSub: object;
};

export function MilkSubscriptionLineCompactFields({
  products,
  draft,
  onPatch,
  autoOpenProductPicker,
  productFilter,
  productFieldLabel,
  productPickerTitle,
  scheme,
  textMain,
  textSub,
}: MilkSubscriptionLineCompactFieldsProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const pickerDialogMaxW = Math.max(260, Math.min(winW - 24, 520));
  const productListScrollMaxH = Math.max(160, Math.min(Math.round(winH * 0.52), winH - 200));
  const packListScrollMaxH = Math.max(140, Math.min(Math.round(winH * 0.42), winH - 220));

  const [choiceDialog, setChoiceDialog] = useState<null | 'product' | 'pack'>(null);
  const [productQuery, setProductQuery] = useState('');

  React.useEffect(() => {
    if (!autoOpenProductPicker) return;
    setChoiceDialog((cur) => cur ?? 'product');
  }, [autoOpenProductPicker]);

  const applyProductSelection = useCallback(
    (prod: Product) => {
      const unitPrice = Number(prod.price ?? 0);
      const opts = packSizeOptionsForProduct(prod);
      const ql = opts.length > 0 ? '' : defaultPackLabelWhenNoOptions(prod);
      onPatch({
        productName: prod.name,
        unitType: prod.unit,
        numberOfItems: 1,
        quantityLabel: ql,
        originalPrice: unitPrice,
        discountedPrice: 0,
        effectiveFinalPrice: unitPrice,
      });
      setChoiceDialog(null);
    },
    [onPatch],
  );

  const selectedProduct = useMemo(() => {
    if (!draft.productName) return undefined;
    return products.find((p) => p.name === draft.productName);
  }, [draft.productName, products]);

  const packOptions = useMemo(() => packSizeOptionsForProduct(selectedProduct), [selectedProduct]);

  const needsPackStep = packOptions.length > 0;
  const hasProduct = !!draft.productName?.trim();
  const hasPack = hasProduct && (!needsPackStep || !!draft.quantityLabel?.trim());

  const lineForTotal = draft as CustomerSubscriptionPlanDto;

  return (
    <>
      <View style={styles.block}>
        <Pressable onPress={() => setChoiceDialog('product')} style={({ pressed }) => [styles.pickerFieldCompact, pressed && styles.pressed]}>
          <Text variant="labelLarge" style={styles.pickerLabel}>
            {productFieldLabel ?? 'Milk product'}
          </Text>
          <Text variant="bodyMedium" numberOfLines={2} style={[textMain, styles.compactValue]}>
            {draft.productName.trim() ? draft.productName : 'Select'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
        </Pressable>

        {hasProduct && needsPackStep ? (
          <Pressable onPress={() => setChoiceDialog('pack')} style={({ pressed }) => [styles.pickerFieldCompact, pressed && styles.pressed]}>
            <Text variant="labelLarge" style={styles.pickerLabel}>
              Pack / size
            </Text>
            <Text variant="bodyMedium" numberOfLines={2} style={[textMain, styles.compactValue]}>
              {draft.quantityLabel.trim() ? draft.quantityLabel : 'Select'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
          </Pressable>
        ) : null}

        {hasPack ? (
          <>
            <View style={[styles.pickerFieldCompact, styles.quantityRow]}>
              <Text variant="labelLarge" style={styles.pickerLabel}>
                Quantity
              </Text>
              <View style={styles.stepperRowInline}>
                <Pressable
                  onPress={() => onPatch({ numberOfItems: Math.max(1, Number(draft.numberOfItems ?? 1) - 1) })}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
                <Text variant="titleSmall" style={[textMain, styles.bold]}>
                  {Math.max(1, Number(draft.numberOfItems ?? 1))}
                </Text>
                <Pressable
                  onPress={() => onPatch({ numberOfItems: Math.min(99, Number(draft.numberOfItems ?? 1) + 1) })}
                  style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                  hitSlop={6}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                </Pressable>
              </View>
            </View>

            <View style={[styles.pickerFieldCompact, styles.readonlyCompactRow]}>
              <Text variant="labelLarge" style={styles.pickerLabel}>
                Price
              </Text>
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                <Text variant="bodyLarge" style={[textMain, styles.bold]}>
                  {moneyInr(planLineTotal(lineForTotal))}
                </Text>
                <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                  {moneyInr(Number(selectedProduct?.price ?? 0))} × {Math.max(1, Number(draft.numberOfItems ?? 1))}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      <Portal>
        <Dialog
          visible={choiceDialog === 'product'}
          onDismiss={() => {
            setChoiceDialog(null);
            setProductQuery('');
          }}
          style={[
            scheme === 'dark' ? styles.dialogDark : styles.dialogLight,
            styles.pickerDialogSurface,
            { maxWidth: pickerDialogMaxW, width: pickerDialogMaxW },
          ]}
        >
          <Dialog.Title>{productPickerTitle ?? 'Select milk product'}</Dialog.Title>
          <Dialog.Content style={[styles.pickerDialogContent, { maxHeight: productListScrollMaxH + 120 }]}>
            <View style={styles.pickerDialogInner}>
              <TextInput
                {...formFieldAttrs('subscription-product-search', { autoComplete: 'off' })}
                mode="outlined"
                dense
                label="Search product"
                value={productQuery}
                onChangeText={setProductQuery}
                autoCapitalize="none"
                autoCorrect={false}
                left={<TextInput.Icon icon="magnify" />}
                style={{ marginBottom: 10 }}
              />
              <ScrollView
                style={{ maxHeight: productListScrollMaxH }}
                contentContainerStyle={{ paddingBottom: 12 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                {...(Platform.OS === 'android' ? { persistentScrollbar: true } : {})}
              >
                {products
                  .filter(productFilter ?? isMilkCatalogProduct)
                  .filter((p) => {
                    const q = productQuery.trim().toLowerCase();
                    if (!q) return true;
                    const name = String(p.name ?? '').toLowerCase();
                    const unit = String(p.unit ?? '').toLowerCase();
                    const cat = String(p.category ?? '').toLowerCase();
                    return name.includes(q) || unit.includes(q) || cat.includes(q);
                  })
                  .map((prod) => {
                const selected = draft.productName === prod.name;
                return (
                  <Pressable
                    key={prod.id}
                    onPress={() => applyProductSelection(prod)}
                    style={({ pressed }) => [styles.pickItem, pressed && styles.pressed, selected && styles.pickItemSelected]}
                  >
                    <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: '900' }} numberOfLines={2}>
                        {prod.name}
                      </Text>
                      <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                        {prod.unit} • {prod.category}
                      </Text>
                    </View>
                    {selected ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                  </Pressable>
                );
                })}
              </ScrollView>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChoiceDialog(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={choiceDialog === 'pack'}
          onDismiss={() => setChoiceDialog(null)}
          style={[
            scheme === 'dark' ? styles.dialogDark : styles.dialogLight,
            styles.pickerDialogSurface,
            { maxWidth: pickerDialogMaxW, width: pickerDialogMaxW },
          ]}
        >
          <Dialog.Title>Pack / size</Dialog.Title>
          <Dialog.Content style={[styles.pickerDialogContent, { maxHeight: packListScrollMaxH + 40 }]}>
            <ScrollView
              style={{ maxHeight: packListScrollMaxH }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'android' ? { persistentScrollbar: true } : {})}
            >
              {packOptions.map((q) => {
                const selected = draft.quantityLabel === q;
                return (
                  <Pressable
                    key={q}
                    onPress={() => {
                      onPatch({ quantityLabel: q });
                      setChoiceDialog(null);
                    }}
                    style={({ pressed }) => [styles.pickItem, pressed && styles.pressed, selected && styles.pickItemSelected]}
                  >
                    <Text variant="bodyMedium">{q}</Text>
                    {selected ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChoiceDialog(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '900' },
  block: { gap: 10 },
  dialogLight: { backgroundColor: 'white' },
  dialogDark: { backgroundColor: '#0F172A' },
  pickerDialogSurface: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  pickerDialogContent: {
    paddingHorizontal: 0,
  },
  pickerDialogInner: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  pickItemSelected: { borderWidth: 1, borderColor: 'rgba(37,99,235,0.45)', backgroundColor: 'rgba(37,99,235,0.08)' },
  pickerFieldCompact: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(148,163,184,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickerLabel: { opacity: 0.75, flexShrink: 0, maxWidth: '38%' },
  compactValue: { flex: 1, minWidth: 0, textAlign: 'right' },
  quantityRow: { alignItems: 'center' },
  stepperRowInline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readonlyCompactRow: { alignItems: 'center' },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  pickItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(148,163,184,0.12)',
    marginBottom: 8,
  },
});
