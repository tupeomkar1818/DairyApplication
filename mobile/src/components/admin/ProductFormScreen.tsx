import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { DeferredTextInput, type DeferredTextInputHandle } from '@/src/components/DeferredTextInput';
import {
  FieldError,
  FieldLabel,
  FormSection,
  MultiOptionChips,
  OptionChips,
  ToggleCard,
} from '@/src/components/admin/productFormFields';
import {
  AVAILABILITY_OPTIONS,
  chipLabel,
  DELIVERY_SLOT_OPTIONS,
  DESCRIPTION_MAX_LENGTH,
  FEATURE_OPTIONS,
  parsePriceInput,
  PRODUCT_TYPE_OPTIONS,
  productFormExtraPackErrors,
  productFormFieldErrors,
  quantityOptionsForUnit,
  TAX_OPTIONS,
  toggleInOrder,
  unitSuffix,
  WEEK_DAYS,
  type ProductFormFieldKey,
  type ProductFormState,
} from '@/src/components/admin/productFormShared';
import {
  deliverySlotName,
  productAvailabilityName,
  productDayShort,
  productFeatureName,
  productTypeName,
  productUnitName,
} from '@/src/components/admin/productDisplay';
import { ProductExtraPacksEditor } from '@/src/components/admin/ProductExtraPacksEditor';
import { UnitTypePickerSheet } from '@/src/components/admin/UnitTypePickerSheet';
import { persistableImageUriFromAsset } from '@/src/components/dashboard/persistablePickedImage';
import {
  ResponsiveContainer,
  useResponsiveContainerMaxWidth,
  useResponsiveContainerStyle,
} from '@/src/components/shared/ResponsiveContainer';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

export type ProductFormScreenProps = {
  title: string;
  saveLabel: string;
  initialForm: ProductFormState;
  initialCustomQuantity?: boolean;
  /** Scroll to this section on open (the Details screen's per-section Edit links). */
  initialSection?: ProductFormSection;
  isPending?: boolean;
  onSave: (form: ProductFormState) => Promise<void>;
  onCancel: () => void;
};

/** Form sections, in screen order (they mirror the Product Details screen). */
export type ProductFormSection = 'basics' | 'pricing' | 'pack' | 'availability' | 'channels' | 'features' | 'description';
type SectionKey = ProductFormSection;
const SECTION_ORDER: SectionKey[] = ['basics', 'pricing', 'pack', 'availability', 'channels', 'features', 'description'];
const FIELD_SECTION: Record<ProductFormFieldKey, SectionKey> = {
  name: 'basics',
  category: 'basics',
  other: 'basics',
  price: 'pricing',
  discountPrice: 'pricing',
  taxPercentage: 'pricing',
  quantity: 'pack',
  sku: 'pack',
  packs: 'pack',
  availableDays: 'availability',
  deliveryTimeSlots: 'availability',
  description: 'description',
};

const sanitizeMoney = (t: string) => t.replace(/[^\d.]/g, '');

export function ProductFormScreen({
  title,
  saveLabel,
  initialForm,
  initialCustomQuantity = false,
  initialSection,
  isPending = false,
  onSave,
  onCancel,
}: ProductFormScreenProps) {
  const t = useStrings('products');
  const tc = useStrings('common');
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();

  // Phones: full width. Tablets/desktops: body and footer row share one centered 720px column.
  const formContainerStyle = useResponsiveContainerStyle('form');
  const formMaxWidth = useResponsiveContainerMaxWidth('form');
  const { width: windowWidth } = useResponsiveLayout();
  // 16:9 preview of the (capped) column width, clamped so it is never a thin strip nor a giant block.
  // Computed here rather than via `aspectRatio` because Yoga shrinks the width when maxHeight clamps an aspect box.
  const previewHeight = Math.round(
    Math.min(280, Math.max(150, ((Math.min(windowWidth, formMaxWidth) - amraleSpacing.md * 2) * 9) / 16)),
  );

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [customQuantity, setCustomQuantity] = useState(initialCustomQuantity);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  // Text fields debounce into `form`; Save flushes them first so a value typed just before tapping Save is kept.
  const nameInputRef = useRef<DeferredTextInputHandle>(null);
  const categoryInputRef = useRef<DeferredTextInputHandle>(null);
  const priceInputRef = useRef<DeferredTextInputHandle>(null);
  const discountInputRef = useRef<DeferredTextInputHandle>(null);
  const quantityInputRef = useRef<DeferredTextInputHandle>(null);
  const skuInputRef = useRef<DeferredTextInputHandle>(null);
  const descriptionInputRef = useRef<DeferredTextInputHandle>(null);
  const imageUrlInputRef = useRef<DeferredTextInputHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** Section top offsets inside the scroll content, to scroll a failed Save to the first problem. */
  /** Section top offsets inside the scroll content (for initialSection and for scrolling to errors). */
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});
  const initialScrollDone = useRef(false);

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

  function quantityErrorFor(f: ProductFormState): string | null {
    const raw = f.unitQuantity.trim();
    if (!raw) return t.form.quantityRequired;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) return t.form.quantityPositive;
    if (customQuantity) return null;
    const allowed = quantityOptionsForUnit(f.unit);
    if (!allowed.includes(qty)) return t.form.quantityCommon;
    return null;
  }

  /** Every problem, keyed by form field (schema rules + the quantity picker rule). */
  function collectErrors(f: ProductFormState): Partial<Record<ProductFormFieldKey, string>> {
    const out = productFormFieldErrors(f);
    const qty = quantityErrorFor(f);
    if (qty) out.quantity = qty;
    return out;
  }

  // Once the user has tried to save, each problem is shown under its own field (re-worded when the language changes).
  const fieldErrors = useMemo(() => (touched ? collectErrors(form) : {}), [touched, form, customQuantity, t]);
  const packErrors = useMemo(
    () => (touched ? productFormExtraPackErrors(form) : { rows: {}, list: undefined }),
    [touched, form, t],
  );
  /** Name of the first pack, as the other sizes are described against it. */
  const firstPackLabel =
    form.firstPackLabel.trim() || (Number(form.unitQuantity) > 0 ? `${form.unitQuantity} ${unitSuffix(form.unit)}` : '');

  const customerPaysHint = useMemo(() => {
    const price = parsePriceInput(form.price);
    const disc = parsePriceInput(form.discountPrice);
    if (price === undefined || disc === undefined || !(disc > 0) || !(disc < price)) return null;
    return t.form.customerPays(`₹${disc}`, `₹${Math.round((price - disc) * 100) / 100}`);
  }, [form.price, form.discountPrice, t]);

  const onSectionLayout = (key: SectionKey) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
    if (!initialScrollDone.current && initialSection && initialSection !== 'basics' && key === initialSection) {
      initialScrollDone.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - amraleSpacing.sm), animated: false });
    }
  };

  const previewUri = useMemo(() => {
    const u = form.imageUrl.trim();
    if (!u || imageFailed) return null;
    return u;
  }, [form.imageUrl, imageFailed]);

  async function onPickPreview() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t.form.permissionTitle, t.form.permissionText);
        return;
      }
    }

    setPickingImage(true);
    try {
      const isWeb = Platform.OS === 'web';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: isWeb ? 0.5 : 0.85,
        // Web returns a blob: URL that dies on reload; request base64 so a data: URI can be persisted.
        base64: isWeb,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) {
        const picked = persistableImageUriFromAsset(asset, Platform.OS);
        if (!picked.ok) {
          setError(picked.message);
          return;
        }
        setError(null);
        setImageFailed(false);
        setForm((s) => ({ ...s, imageUrl: picked.uri }));
      }
    } catch {
      setError(t.form.pickerFailed);
    } finally {
      setPickingImage(false);
    }
  }

  async function handleSave() {
    setTouched(true);
    setError(null);
    // Validate what is on screen, not the last debounced commit (tapping Save on native does not blur the field).
    const current: ProductFormState = {
      ...form,
      name: nameInputRef.current?.flush() ?? form.name,
      category: categoryInputRef.current?.flush() ?? form.category,
      price: sanitizeMoney(priceInputRef.current?.flush() ?? form.price),
      discountPrice: sanitizeMoney(discountInputRef.current?.flush() ?? form.discountPrice),
      unitQuantity: sanitizeMoney(quantityInputRef.current?.flush() ?? form.unitQuantity),
      sku: skuInputRef.current?.flush() ?? form.sku,
      description: descriptionInputRef.current?.flush() ?? form.description,
      imageUrl: imageUrlInputRef.current?.flush() ?? form.imageUrl,
    };
    const errors = collectErrors(current);
    const keys = Object.keys(errors) as ProductFormFieldKey[];
    const firstSection = SECTION_ORDER.find((s) => keys.some((k) => FIELD_SECTION[k] === s));
    if (firstSection) {
      // Messages render under each field (see `fieldErrors`); bring the first section with a problem into view.
      scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[firstSection] ?? 0) - amraleSpacing.sm), animated: true });
      return;
    }
    try {
      await onSave(current);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.form.saveFailed);
    }
  }

  function handleCancel() {
    if (closeTopmostOverlay()) return;
    onCancel();
  }

  const quantityOptions = quantityOptionsForUnit(form.unit);
  const allDays = form.availableDays.length === WEEK_DAYS.length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        {/* Title row shares the form's centered column so it lines up with the fields on tablets/laptops. */}
        <View style={[styles.headerRow, formContainerStyle]}>
          <Pressable
            onPress={handleCancel}
            hitSlop={4}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            accessibilityLabel={t.form.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      <View style={styles.headerDivider} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, formContainerStyle, { paddingBottom: scrollPaddingBottom(100) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Photo ── */}
          <View style={[styles.previewCard, { height: previewHeight }]}>
            {previewUri ? (
              <>
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                  onError={() => setImageFailed(true)}
                />
                {/* Photo set: compact actions in the corner so they don't cover the picture. */}
                <View style={styles.previewActions}>
                  <Pressable
                    onPress={onPickPreview}
                    disabled={pickingImage}
                    hitSlop={6}
                    style={({ pressed }) => [styles.previewChip, pressed && styles.pressed, pickingImage && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t.form.changePhoto}
                  >
                    {pickingImage ? (
                      <ActivityIndicator size="small" color={amraleColors.blue} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="camera-outline" size={16} color={amraleColors.blue} />
                        <Text style={styles.previewChipText}>{t.form.change}</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setImageFailed(false);
                      setForm((s) => ({ ...s, imageUrl: '' }));
                    }}
                    hitSlop={6}
                    style={({ pressed }) => [styles.previewChip, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t.form.removePhoto}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={amraleColors.error} />
                    <Text style={[styles.previewChipText, styles.previewChipTextDanger]}>{t.form.remove}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              // Empty state: icon, hint and button stacked (the icon used to sit hidden behind the button).
              <View style={styles.previewEmpty}>
                <MaterialCommunityIcons
                  name={imageFailed ? 'image-broken-variant' : 'bottle-tonic-outline'}
                  size={40}
                  color={amraleColors.textSubtle}
                />
                <Text style={styles.previewHint}>
                  {imageFailed ? t.form.imageLoadFailed : t.form.noPhoto}
                </Text>
                <Pressable
                  onPress={onPickPreview}
                  disabled={pickingImage}
                  hitSlop={6}
                  style={({ pressed }) => [styles.addPreviewBtn, pressed && styles.pressed, pickingImage && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel={t.form.addPhoto}
                >
                  {pickingImage ? (
                    <ActivityIndicator size="small" color={amraleColors.blue} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="camera-plus-outline" size={18} color={amraleColors.blue} />
                      <Text style={styles.addPreviewText}>{t.form.addPhotoButton}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel>{t.form.imageSource}</FieldLabel>
            {form.imageUrl.startsWith('data:') ? (
              // A photo picked on web is stored as a data: URI — never dump that base64 blob into a text field.
              <View style={styles.inputRow}>
                <MaterialCommunityIcons name="image-check-outline" size={20} color={amraleColors.blue} />
                <Text style={styles.uploadedText} numberOfLines={1}>
                  {t.form.photoFromDevice}
                </Text>
                <Pressable
                  onPress={() => {
                    setImageFailed(false);
                    setForm((s) => ({ ...s, imageUrl: '' }));
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.form.removePhoto}
                >
                  <Text style={styles.removeLink}>{t.form.remove}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <MaterialCommunityIcons name="link-variant" size={20} color={amraleColors.blue} />
                <DeferredTextInput
                  ref={imageUrlInputRef}
                  {...plainInputProps}
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
            )}
          </View>

          {/* ── Basic details ── */}
          <FormSection title={t.form.basicsTitle} icon="information-outline" onLayout={onSectionLayout('basics')}>
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.productName}</FieldLabel>
              <View style={[styles.inputRow, fieldErrors.name && styles.inputRowError]}>
                <MaterialCommunityIcons name="package-variant-closed" size={20} color={amraleColors.blue} />
                <DeferredTextInput
                  ref={nameInputRef}
                  {...plainInputProps}
                  value={form.name}
                  onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
                  placeholder={t.form.productNamePlaceholder}
                  placeholderTextColor={amraleColors.textSubtle}
                  style={styles.inputText}
                />
              </View>
              <FieldError message={fieldErrors.name} />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.productType}</FieldLabel>
              <OptionChips
                options={PRODUCT_TYPE_OPTIONS}
                labelFor={productTypeName}
                value={form.productType}
                onChange={(productType) => setForm((s) => ({ ...s, productType }))}
              />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.categoryOptional}</FieldLabel>
              <View style={[styles.inputRow, fieldErrors.category && styles.inputRowError]}>
                <MaterialCommunityIcons name="shape-outline" size={20} color={amraleColors.blue} />
                <DeferredTextInput
                  ref={categoryInputRef}
                  {...plainInputProps}
                  value={form.category}
                  onChangeText={(t) => setForm((s) => ({ ...s, category: t }))}
                  placeholder={t.form.categoryPlaceholder(productTypeName(form.productType))}
                  placeholderTextColor={amraleColors.textSubtle}
                  maxLength={50}
                  style={styles.inputText}
                />
              </View>
              <FieldError message={fieldErrors.category} />
            </View>
          </FormSection>

          {/* ── Pricing & tax ── */}
          <FormSection title={t.form.pricingTitle} icon="currency-inr" onLayout={onSectionLayout('pricing')}>
            <View style={styles.row2}>
              <View style={[styles.fieldBlock, styles.fieldCell]}>
                <FieldLabel>{t.form.price}</FieldLabel>
                <View style={[styles.inputRow, fieldErrors.price && styles.inputRowError]}>
                  <Text style={styles.rupee}>₹</Text>
                  <DeferredTextInput
                    ref={priceInputRef}
                    {...plainInputProps}
                    value={form.price}
                    onChangeText={(t) => setForm((s) => ({ ...s, price: sanitizeMoney(t) }))}
                    placeholder="0.00"
                    placeholderTextColor={amraleColors.textSubtle}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                  />
                </View>
                <FieldError message={fieldErrors.price} />
              </View>

              <View style={[styles.fieldBlock, styles.fieldCell]}>
                <FieldLabel>{t.form.discountOptional}</FieldLabel>
                <View style={[styles.inputRow, fieldErrors.discountPrice && styles.inputRowError]}>
                  <Text style={styles.rupee}>₹</Text>
                  <DeferredTextInput
                    ref={discountInputRef}
                    {...plainInputProps}
                    value={form.discountPrice}
                    onChangeText={(t) => setForm((s) => ({ ...s, discountPrice: sanitizeMoney(t) }))}
                    placeholder={t.form.noDiscount}
                    placeholderTextColor={amraleColors.textSubtle}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                  />
                </View>
                <FieldError message={fieldErrors.discountPrice} />
              </View>
            </View>
            {customerPaysHint ? <Text style={styles.hint}>{customerPaysHint}</Text> : null}
            {form.extraPacks.length ? (
              <Text style={styles.hint}>
                {t.form.firstPackPrice(firstPackLabel || t.form.theFirstPack)}
              </Text>
            ) : null}

            <ToggleCard
              icon="percent-outline"
              label={t.form.taxApplicable}
              hint={t.form.taxHint}
              value={form.taxApplicable}
              onChange={(taxApplicable) => setForm((s) => ({ ...s, taxApplicable }))}
            />
            {form.taxApplicable ? (
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.form.taxRate}</FieldLabel>
                <OptionChips
                  options={TAX_OPTIONS}
                  value={form.taxPercentage}
                  onChange={(taxPercentage) => setForm((s) => ({ ...s, taxPercentage }))}
                />
                <FieldError message={fieldErrors.taxPercentage} />
              </View>
            ) : null}
          </FormSection>

          {/* ── Pack & unit ── */}
          <FormSection title={t.form.packTitle} icon="scale-balance" onLayout={onSectionLayout('pack')}>
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.unitType}</FieldLabel>
              <Pressable onPress={() => setUnitOpen(true)} style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="scale-balance" size={20} color={amraleColors.blue} />
                <Text style={styles.unitValue} numberOfLines={1}>
                  {productUnitName(form.unit)}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={amraleColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.packSize}</FieldLabel>
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
                  <Text style={[styles.chipText, customQuantity && styles.chipTextActive]}>{t.form.custom}</Text>
                </Pressable>
              </View>
              {customQuantity ? (
                <View style={[styles.inputRow, fieldErrors.quantity && styles.inputRowError]}>
                  <MaterialCommunityIcons name="ruler" size={20} color={amraleColors.blue} />
                  <DeferredTextInput
                    ref={quantityInputRef}
                    {...plainInputProps}
                    value={form.unitQuantity}
                    onChangeText={(t) => setForm((s) => ({ ...s, unitQuantity: sanitizeMoney(t) }))}
                    placeholder={t.form.enterQuantity(t.quantityUnits[form.unit])}
                    placeholderTextColor={amraleColors.textSubtle}
                    keyboardType="decimal-pad"
                    style={styles.inputText}
                  />
                </View>
              ) : null}
              <FieldError message={fieldErrors.quantity} />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.skuOptional}</FieldLabel>
              <View style={[styles.inputRow, fieldErrors.sku && styles.inputRowError]}>
                <MaterialCommunityIcons name="barcode" size={20} color={amraleColors.blue} />
                <DeferredTextInput
                  ref={skuInputRef}
                  {...plainInputProps}
                  value={form.sku}
                  onChangeText={(t) => setForm((s) => ({ ...s, sku: t }))}
                  placeholder={t.form.skuPlaceholder}
                  placeholderTextColor={amraleColors.textSubtle}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={24}
                  style={styles.inputText}
                />
              </View>
              <FieldError message={fieldErrors.sku} />
            </View>

            <ProductExtraPacksEditor
              rows={form.extraPacks}
              unit={form.unit}
              firstPackLabel={firstPackLabel}
              errors={packErrors.rows}
              listError={packErrors.list}
              onChange={(extraPacks) => setForm((st) => ({ ...st, extraPacks }))}
            />
          </FormSection>

          {/* ── Availability & delivery ── */}
          <FormSection title={t.form.availabilityTitle} icon="truck-delivery-outline" onLayout={onSectionLayout('availability')}>
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.availability}</FieldLabel>
              <OptionChips
                options={AVAILABILITY_OPTIONS}
                labelFor={productAvailabilityName}
                value={form.availability}
                onChange={(availability) => setForm((s) => ({ ...s, availability }))}
              />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel
                right={
                  <Pressable
                    onPress={() => setForm((s) => ({ ...s, availableDays: allDays ? [] : [...WEEK_DAYS] }))}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={styles.linkText}>{allDays ? t.form.clearAll : t.form.everyDay}</Text>
                  </Pressable>
                }
              >
                {t.form.deliveryDays}
              </FieldLabel>
              <MultiOptionChips
                options={WEEK_DAYS}
                values={form.availableDays}
                onToggle={(day) => setForm((s) => ({ ...s, availableDays: toggleInOrder(s.availableDays, day, WEEK_DAYS) }))}
                labelFor={productDayShort}
              />
              <FieldError message={fieldErrors.availableDays} />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.form.deliverySlots}</FieldLabel>
              <MultiOptionChips
                options={DELIVERY_SLOT_OPTIONS}
                labelFor={deliverySlotName}
                values={form.deliveryTimeSlots}
                onToggle={(slot) =>
                  setForm((s) => ({ ...s, deliveryTimeSlots: toggleInOrder(s.deliveryTimeSlots, slot, DELIVERY_SLOT_OPTIONS) }))
                }
              />
              <FieldError message={fieldErrors.deliveryTimeSlots} />
            </View>
          </FormSection>

          {/* ── Sales channels ── */}
          <FormSection title={t.form.channelsTitle} icon="storefront-outline" onLayout={onSectionLayout('channels')}>
            <ToggleCard
              icon="account-outline"
              label={t.form.onlineCustomers}
              hint={t.form.onlineHint}
              value={form.availableForOnline}
              onChange={(availableForOnline) => setForm((s) => ({ ...s, availableForOnline }))}
            />
            <ToggleCard
              icon="storefront-outline"
              label={t.form.offlineCounter}
              hint={t.form.offlineHint}
              value={form.availableForOffline}
              onChange={(availableForOffline) => setForm((s) => ({ ...s, availableForOffline }))}
            />
            <ToggleCard
              icon="check-decagram-outline"
              label={t.form.active}
              hint={t.form.activeHint}
              value={form.isActive}
              onChange={(isActive) => setForm((s) => ({ ...s, isActive }))}
            />
          </FormSection>

          {/* ── Features ── */}
          <FormSection title={t.form.featuresTitle} icon="star-outline" onLayout={onSectionLayout('features')}>
            <MultiOptionChips
              options={FEATURE_OPTIONS}
              labelFor={productFeatureName}
              values={form.features}
              onToggle={(feature) => setForm((s) => ({ ...s, features: toggleInOrder(s.features, feature, FEATURE_OPTIONS) }))}
            />
          </FormSection>

          {/* ── Description ── */}
          <FormSection title={t.form.descriptionTitle} icon="text-box-outline" onLayout={onSectionLayout('description')}>
            <View style={styles.fieldBlock}>
              <View style={[styles.inputRow, styles.inputRowMultiline, fieldErrors.description && styles.inputRowError]}>
                <DeferredTextInput
                  ref={descriptionInputRef}
                  {...plainInputProps}
                  value={form.description}
                  onChangeText={(t) => setForm((s) => ({ ...s, description: t }))}
                  placeholder={t.form.descriptionPlaceholder}
                  placeholderTextColor={amraleColors.textSubtle}
                  multiline
                  numberOfLines={4}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  style={[styles.inputText, styles.inputTextMultiline]}
                />
              </View>
              <View style={styles.labelRowEnd}>
                <FieldError message={fieldErrors.description} />
                <Text style={styles.counter}>
                  {form.description.length}/{DESCRIPTION_MAX_LENGTH}
                </Text>
              </View>
            </View>
          </FormSection>

          {/* Field problems show under their fields; this is for form-wide issues and save failures only. */}
          {fieldErrors.other ? <Text style={styles.errorText}>{fieldErrors.other}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: scrollPaddingBottom(amraleSpacing.md) }]}>
          <ResponsiveContainer variant="form" style={styles.footerRow}>
            <Pressable onPress={handleCancel} disabled={isPending} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{tc.actions.cancel}</Text>
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
                  <Text style={styles.saveText} numberOfLines={1}>
                    {saveLabel}
                  </Text>
                  <View style={styles.saveIconCircle}>
                    <MaterialCommunityIcons name="check" size={18} color={amraleColors.blue} />
                  </View>
                </>
              )}
            </Pressable>
          </ResponsiveContainer>
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

/**
 * `DeferredTextInput` renders Paper's TextInput, whose flat mode adds a tinted fill and an underline and ignores
 * `style.color`/`fontFamily`. Strip that chrome so the field blends into the rounded `inputRow` like a plain input.
 */
const plainInputProps = {
  mode: 'flat',
  dense: true,
  underlineColor: 'transparent',
  activeUnderlineColor: 'transparent',
  textColor: amraleColors.text,
  selectionColor: amraleColors.blue,
  contentStyle: {
    paddingHorizontal: 0,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
  },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  flex: { flex: 1 },
  header: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
  },
  /** Same centered column + side padding as the form, so the title lines up with the fields. */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: amraleSpacing.sm,
    paddingHorizontal: amraleSpacing.md,
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
  /** Height is set inline (`previewHeight`): 16:9 of the column width, clamped to 150–280px. */
  previewCard: {
    borderRadius: amraleRadius.lg,
    overflow: 'hidden',
    backgroundColor: amraleColors.inputBgLight,
    borderWidth: 1,
    borderColor: amraleColors.inputBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { ...StyleSheet.absoluteFill },
  previewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: amraleSpacing.md,
  },
  previewHint: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: amraleColors.textMuted,
    textAlign: 'center',
  },
  previewActions: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 8,
  },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.18)',
  },
  previewChipText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 12,
    color: amraleColors.blue,
  },
  previewChipTextDanger: { color: amraleColors.error },
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
  inputRowMultiline: { alignItems: 'flex-start', paddingVertical: 4 },
  inputText: {
    flex: 1,
    minWidth: 0,
    height: 44,
    // Paper's flat TextInput reads its own 16px side padding from `style.paddingHorizontal` (not contentStyle);
    // zero it so the text starts right after the row's icon.
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: amraleColors.text,
  },
  inputTextMultiline: { height: undefined, minHeight: 96, textAlignVertical: 'top' },
  rupee: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    color: amraleColors.blue,
  },
  unitValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 15,
    color: amraleColors.text,
  },
  hint: {
    marginTop: -6,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 12,
    color: '#15803D',
  },
  linkText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 13,
    color: amraleColors.blue,
  },
  labelRowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  counter: {
    marginLeft: 'auto',
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textSubtle,
  },
  /** Price + Discount side by side; wraps to one column on 320px phones (2 × 140 + gap > available width). */
  row2: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: amraleSpacing.md },
  fieldCell: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
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
  uploadedText: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.text,
  },
  removeLink: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.error,
  },
  /** Full-bleed bar; Cancel + Save sit in `footerRow`, the same centered 720px column as the form. */
  footer: {
    paddingTop: amraleSpacing.md,
    backgroundColor: amraleColors.white,
    borderTopWidth: 1,
    borderTopColor: amraleColors.inputBorderLight,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: amraleSpacing.md,
  },
  cancelBtn: { minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  cancelText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: amraleColors.blue,
  },
  saveBtn: {
    flex: 1,
    minWidth: 0,
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
