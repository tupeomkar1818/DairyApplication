import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  chipLabel,
  quantityOptionsForUnit,
  type ProductFormState,
  unitSuffix,
} from '@/src/components/admin/productFormShared';
import { UnitTypePickerSheet } from '@/src/components/admin/UnitTypePickerSheet';
import { UpdateProductDetailsRequestSchema } from '@/src/domain/products/validations';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export type ProductFormScreenProps = {
  title: string;
  saveLabel: string;
  initialForm: ProductFormState;
  initialCustomQuantity?: boolean;
  isPending?: boolean;
  onSave: (form: ProductFormState) => Promise<void>;
  onCancel: () => void;
};

export function ProductFormScreen({
  title,
  saveLabel,
  initialForm,
  initialCustomQuantity = false,
  isPending = false,
  onSave,
  onCancel,
}: ProductFormScreenProps) {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [customQuantity, setCustomQuantity] = useState(initialCustomQuantity);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setCustomQuantity(initialCustomQuantity);
    setTouched(false);
    setError(null);
    setImageFailed(false);
  }, [initialForm, initialCustomQuantity]);

  function closeTopmostOverlay(): boolean {
    if (unitOpen) {
      setUnitOpen(false);
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => closeTopmostOverlay());
    return () => sub.remove();
  }, [unitOpen]);

  const parsed = useMemo(() => {
    return UpdateProductDetailsRequestSchema.safeParse({
      name: form.name,
      price: Number(form.price),
      unit: form.unit,
      isActive: true,
    });
  }, [form]);

  const qtyError = useMemo(() => {
    const raw = form.unitQuantity.trim();
    if (!raw) return 'Select or enter a quantity';
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) return 'Quantity must be greater than 0';
    if (customQuantity) return null;
    const allowed = quantityOptionsForUnit(form.unit);
    if (!allowed.includes(qty as (typeof allowed)[number])) return 'Select a common quantity or use Custom +';
    return null;
  }, [customQuantity, form.unit, form.unitQuantity]);

  const previewUri = useMemo(() => {
    const u = form.imageUrl.trim();
    if (!u || imageFailed) return null;
    return u;
  }, [form.imageUrl, imageFailed]);

  async function onPickPreview() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add a product preview.');
        return;
      }
    }

    setPickingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setImageFailed(false);
        setForm((s) => ({ ...s, imageUrl: result.assets[0].uri }));
      }
    } finally {
      setPickingImage(false);
    }
  }

  async function handleSave() {
    setTouched(true);
    setError(null);
    if (qtyError) {
      setError(qtyError);
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Unable to save product. Please try again.');
    }
  }

  function handleCancel() {
    if (closeTopmostOverlay()) return;
    onCancel();
  }

  const quantityOptions = quantityOptionsForUnit(form.unit);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <Pressable onPress={handleCancel} style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <View style={styles.headerDivider} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom(100) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.previewCard}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="bottle-tonic-outline" size={56} color={amraleColors.textSubtle} />
              </View>
            )}
            <Pressable
              onPress={onPickPreview}
              disabled={pickingImage}
              style={({ pressed }) => [styles.addPreviewBtn, pressed && styles.pressed, pickingImage && styles.disabled]}
            >
              {pickingImage ? (
                <ActivityIndicator size="small" color={amraleColors.blue} />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera-plus-outline" size={18} color={amraleColors.blue} />
                  <Text style={styles.addPreviewText}>ADD PREVIEW</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Product Name</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="package-variant-closed" size={20} color={amraleColors.blue} />
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
                placeholder="Enter product name"
                placeholderTextColor={amraleColors.textSubtle}
                style={styles.inputText}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={[styles.fieldBlock, styles.flex]}>
              <Text style={styles.label}>Price</Text>
              <View style={styles.inputRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  value={form.price}
                  onChangeText={(t) => setForm((s) => ({ ...s, price: t.replace(/[^\d.]/g, '') }))}
                  placeholder="0.00"
                  placeholderTextColor={amraleColors.textSubtle}
                  keyboardType="decimal-pad"
                  style={styles.inputText}
                />
              </View>
            </View>

            <View style={[styles.fieldBlock, styles.flex]}>
              <Text style={styles.label}>Unit Type</Text>
              <Pressable onPress={() => setUnitOpen(true)} style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="scale-balance" size={20} color={amraleColors.blue} />
                <Text style={styles.unitValue}>{form.unit}</Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={amraleColors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Common Quantities</Text>
            <View style={styles.chipGrid}>
              {quantityOptions.map((n) => {
                const active = !customQuantity && Number(form.unitQuantity) === n;
                return (
                  <Pressable
                    key={`${form.unit}_${n}`}
                    onPress={() => {
                      setCustomQuantity(false);
                      setForm((s) => ({ ...s, unitQuantity: String(n) }));
                    }}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{chipLabel(form.unit, n)}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setCustomQuantity(true);
                  setForm((s) => ({ ...s, unitQuantity: '' }));
                }}
                style={({ pressed }) => [styles.chip, styles.chipCustom, customQuantity && styles.chipCustomActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipText, customQuantity && styles.chipTextActive]}>Custom +</Text>
              </Pressable>
            </View>
            {customQuantity ? (
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <MaterialCommunityIcons name="ruler" size={20} color={amraleColors.blue} />
                <TextInput
                  value={form.unitQuantity}
                  onChangeText={(t) => setForm((s) => ({ ...s, unitQuantity: t.replace(/[^\d.]/g, '') }))}
                  placeholder={`Enter ${unitSuffix(form.unit)}`}
                  placeholderTextColor={amraleColors.textSubtle}
                  keyboardType="decimal-pad"
                  style={styles.inputText}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.sectionLabel}>AVAILABLE FOR</Text>
            <Pressable
              onPress={() => setForm((s) => ({ ...s, availableForOnline: !s.availableForOnline }))}
              style={({ pressed }) => [styles.availCard, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="account-outline" size={22} color={amraleColors.blue} />
              <Text style={styles.availLabel}>Online Customer</Text>
              <MaterialCommunityIcons
                name={form.availableForOnline ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={24}
                color={form.availableForOnline ? amraleColors.blue : amraleColors.textSubtle}
              />
            </Pressable>
            <Pressable
              onPress={() => setForm((s) => ({ ...s, availableForOffline: !s.availableForOffline }))}
              style={({ pressed }) => [styles.availCard, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="storefront-outline" size={22} color={amraleColors.blue} />
              <Text style={styles.availLabel}>Offline Counter</Text>
              <MaterialCommunityIcons
                name={form.availableForOffline ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={24}
                color={form.availableForOffline ? amraleColors.blue : amraleColors.textSubtle}
              />
            </Pressable>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Image Source (URL)</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="link-variant" size={20} color={amraleColors.blue} />
              <TextInput
                value={form.imageUrl}
                onChangeText={(t) => {
                  setImageFailed(false);
                  setForm((s) => ({ ...s, imageUrl: t }));
                }}
                placeholder="https://image-url.com/milk.jpg"
                placeholderTextColor={amraleColors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.inputText}
              />
              <MaterialCommunityIcons name="image-outline" size={22} color={amraleColors.textMuted} />
            </View>
          </View>

          {touched && !qtyError && !parsed.success ? (
            <Text style={styles.errorText}>{parsed.error.issues[0]?.message}</Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: scrollPaddingBottom(amraleSpacing.md) }]}>
          <Pressable onPress={handleCancel} disabled={isPending} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, isPending && styles.disabled]}
          >
            {isPending ? (
              <ActivityIndicator color={amraleColors.white} />
            ) : (
              <>
                <Text style={styles.saveText}>{saveLabel}</Text>
                <View style={styles.saveIconCircle}>
                  <MaterialCommunityIcons name="check" size={18} color={amraleColors.blue} />
                </View>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <UnitTypePickerSheet
        visible={unitOpen}
        selectedUnit={form.unit}
        onDismiss={() => setUnitOpen(false)}
        onConfirm={(unit) => {
          const allowed = quantityOptionsForUnit(unit);
          setCustomQuantity(false);
          setForm((s) => ({
            ...s,
            unit,
            unitQuantity: String(allowed[0] ?? 1),
          }));
          setUnitOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.sm,
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  headerDivider: {
    height: 1,
    backgroundColor: amraleColors.inputBorderLight,
  },
  scroll: {
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
  },
  previewCard: {
    height: 168,
    borderRadius: amraleRadius.lg,
    overflow: 'hidden',
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { ...StyleSheet.absoluteFillObject },
  previewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.inputBgLight,
  },
  addPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.2)',
    zIndex: 1,
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  addPreviewText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    color: amraleColors.blue,
    letterSpacing: 0.6,
  },
  fieldBlock: { gap: 8 },
  label: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
  },
  sectionLabel: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    color: amraleColors.textMuted,
    letterSpacing: 0.8,
  },
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
  inputText: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  rupee: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.blue,
  },
  unitValue: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 15,
    color: amraleColors.text,
  },
  row2: { flexDirection: 'row', gap: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: amraleColors.blue,
    borderColor: amraleColors.blue,
  },
  chipCustom: {
    borderStyle: 'dashed',
    borderColor: amraleColors.textSubtle,
  },
  chipCustomActive: {
    borderStyle: 'solid',
    backgroundColor: amraleColors.blue,
    borderColor: amraleColors.blue,
  },
  chipText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.text,
  },
  chipTextActive: { color: amraleColors.white },
  availCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.06)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  availLabel: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.md,
    backgroundColor: amraleColors.white,
    borderTopWidth: 1,
    borderTopColor: amraleColors.inputBorderLight,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  cancelText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.blue,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  saveText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.white,
  },
  saveIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: amraleColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.error,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.6 },
});
