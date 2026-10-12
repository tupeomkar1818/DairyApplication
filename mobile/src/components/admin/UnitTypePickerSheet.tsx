import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductUnit } from '@/src/domain/products/enums';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/** Units shown in the picker (matches product form options). */
export const PRODUCT_UNIT_PICKER_OPTIONS: ProductUnit[] = [
  'Gram',
  'ml',
  'Packet',
  'Piece',
  'Box',
  'Bottle',
  'Pouch',
];

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function unitIcon(unit: ProductUnit): IconName {
  switch (unit) {
    case 'Gram':
      return 'weight';
    case 'ml':
      return 'water';
    case 'Packet':
      return 'package-variant-closed';
    case 'Piece':
      return 'shape-outline';
    case 'Box':
      return 'cube-outline';
    case 'Bottle':
      return 'bottle-soda-outline';
    case 'Pouch':
      return 'bag-personal-outline';
    default:
      return 'scale-balance';
  }
}

export type UnitTypePickerSheetProps = {
  visible: boolean;
  selectedUnit: ProductUnit;
  onDismiss: () => void;
  onConfirm: (unit: ProductUnit) => void;
};

export function UnitTypePickerSheet({ visible, selectedUnit, onDismiss, onConfirm }: UnitTypePickerSheetProps) {
  const t = useStrings('products');
  const tc = useStrings('common');
  const insets = useSafeAreaInsets();
  const [pendingUnit, setPendingUnit] = useState<ProductUnit>(selectedUnit);

  useEffect(() => {
    if (visible) setPendingUnit(selectedUnit);
  }, [visible, selectedUnit]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
        <View style={[styles.overlay, Platform.OS === 'web' && styles.overlayWeb]}>
          <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel={t.unitPicker.close} />

          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.unitPicker.title}</Text>
              <Pressable
                onPress={onDismiss}
                hitSlop={4}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t.unitPicker.closeLabel}
              >
                <MaterialCommunityIcons name="close" size={22} color={amraleColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {PRODUCT_UNIT_PICKER_OPTIONS.map((unit) => {
                const selected = pendingUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setPendingUnit(unit)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.optionIconWrap, selected && styles.optionIconWrapSelected]}>
                      <MaterialCommunityIcons
                        name={unitIcon(unit)}
                        size={20}
                        color={selected ? amraleColors.white : amraleColors.blue}
                      />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{t.units[unit]}</Text>
                    {selected ? (
                      <MaterialCommunityIcons name="check-circle" size={22} color={amraleColors.blue} />
                    ) : (
                      <View style={styles.optionSpacer} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable onPress={onDismiss} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
                <Text style={styles.cancelText}>{tc.actions.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirm(pendingUnit)}
                style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
              >
                <Text style={styles.confirmText}>{t.unitPicker.confirm}</Text>
                <View style={styles.confirmIconCircle}>
                  <MaterialCommunityIcons name="check" size={16} color={amraleColors.blue} />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayWeb: {
    // RN Web: ensure the sheet stacks above the page (localhost:8081).
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
  } as const,
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 43, 75, 0.45)',
    zIndex: 0,
  },
  sheet: {
    backgroundColor: amraleColors.white,
    borderTopLeftRadius: amraleRadius.xl,
    borderTopRightRadius: amraleRadius.xl,
    maxHeight: '88%',
    paddingTop: 8,
    zIndex: 2,
    elevation: 8,
    // Full-width bottom sheet on phones; on tablets/desktops a centered 560px sheet instead of a window-wide bar.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: amraleColors.inputBorderLight,
    marginBottom: amraleSpacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
  },
  sheetTitle: {
    flexShrink: 1,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { maxHeight: 360 },
  listContent: {
    paddingHorizontal: amraleSpacing.md,
    gap: 10,
    paddingBottom: amraleSpacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: amraleColors.white,
    borderColor: amraleColors.blue,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.12)',
  },
  optionIconWrapSelected: {
    backgroundColor: amraleColors.blue,
    borderColor: amraleColors.blue,
  },
  optionLabel: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 16,
    color: amraleColors.text,
  },
  optionLabelSelected: {
    fontFamily: amraleTypography.fontFamily.bold,
    color: amraleColors.blue,
  },
  optionSpacer: { width: 22 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.sm,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.textMuted,
  },
  confirmBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: amraleColors.white,
  },
  confirmIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: amraleColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.88 },
});
