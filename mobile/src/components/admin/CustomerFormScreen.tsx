import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { DeferredTextInput, type DeferredTextInputHandle } from '@/src/components/DeferredTextInput';
import { DatePickerModal } from '@/src/components/shared/DatePickerModal';

import type { AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import type { CustomerFormMode, CustomerFormState, CustomerFormTab } from '@/src/components/admin/customerFormShared';
import {
  buildAutoAddress,
  sanitizeMobileInput,
  sanitizePincodeInput,
  validateCustomerFormForMode,
} from '@/src/components/admin/customerFormShared';
import {
  FieldError,
  FieldLabel,
  FormSection,
  formInputStyles,
  OptionChips,
  plainTextInputProps,
  ToggleCard,
} from '@/src/components/shared/formFields';
import {
  RESPONSIVE_CONTAINER_MAX_WIDTH,
  ResponsiveContainer,
  useResponsiveContainerStyle,
} from '@/src/components/shared/ResponsiveContainer';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useProducts } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import {
  amraleColors,
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

export type CustomerFormScreenProps = {
  title: string;
  saveLabel: string;
  initialForm: CustomerFormState;
  /** `edit` validates only the profile/address/billing fields (no subscription lines required). Default `create`. */
  mode?: CustomerFormMode;
  /** Scroll to this section on open (the details screen's per-section Edit links). */
  initialSection?: CustomerFormTab;
  isPending?: boolean;
  onSave: (form: CustomerFormState) => Promise<void>;
  onCancel: () => void;
};

/** Sections, in screen order — the same three the Customer Details overview shows. */
const SECTION_ORDER: CustomerFormTab[] = ['basic', 'address', 'billing'];

/** Debounced text fields; flushed on Save so a tap that does not blur (native) never saves stale text. */
const TEXT_FIELDS = ['name', 'mobile', 'alternateMobile', 'houseFlatNumber', 'societyName', 'streetArea', 'landmark', 'mapLink', 'city', 'pincode'] as const;
type TextFieldKey = (typeof TEXT_FIELDS)[number];

/** Schema field → form section, to scroll a failed Save to the first problem. Unlisted fields fall back to Basic. */
const FIELD_SECTION: Partial<Record<string, CustomerFormTab>> = {
  houseFlatNumber: 'address',
  societyName: 'address',
  streetArea: 'address',
  landmark: 'address',
  mapLink: 'address',
  city: 'address',
  pincode: 'address',
  address: 'address',
  routeName: 'address',
  assignedDeliveryBoyId: 'address',
  assignedDeliveryBoyName: 'address',
  billingType: 'billing',
  billingCycleDate: 'billing',
  paymentType: 'billing',
};

/** Fields that show their message inline; anything else shows at the bottom of the form. */
const INLINE_ERROR_FIELDS = new Set([
  'name',
  'mobile',
  'alternateMobile',
  'dateOfBirth',
  'houseFlatNumber',
  'societyName',
  'streetArea',
  'landmark',
  'city',
  'pincode',
  'address',
  'billingCycleDate',
]);

/** Room for a pasted "+91 98765 43210"; `sanitizeMobileInput` reduces it to the 10-digit number. */
const MOBILE_INPUT_MAX_LENGTH = 16;

type IssueLike = { path: PropertyKey[]; message: string };

function errorsByField(issues: readonly IssueLike[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    const field = INLINE_ERROR_FIELDS.has(key) ? key : 'other';
    out[field] ??= issue.message;
  }
  return out;
}

export function CustomerFormScreen({
  title,
  saveLabel,
  initialForm,
  mode = 'create',
  initialSection,
  isPending = false,
  onSave,
  onCancel,
}: CustomerFormScreenProps) {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const customersText = useStrings('customers');
  const t = customersText.form;
  const lang = useLanguage();
  const products = useProducts();
  const deliveryBoys = useDeliveryBoys();

  // Phones: full width. Tablets/desktops: header row, form body and footer row share one centered 720px column.
  const formContainerStyle = useResponsiveContainerStyle('form');
  const { width: windowWidth } = useResponsiveLayout();
  const pickerSheetWidth = Math.min(windowWidth - amraleSpacing.md * 2, RESPONSIVE_CONTAINER_MAX_WIDTH.sheet);

  const [form, setForm] = useState<CustomerFormState>(initialForm);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dateTarget, setDateTarget] = useState<{ field: keyof CustomerFormState } | null>(null);
  const [deliveryBoyOpen, setDeliveryBoyOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  /** Section top offsets inside the scroll content (for initialSection and for scrolling to errors). */
  const sectionY = useRef<Partial<Record<CustomerFormTab, number>>>({});
  const initialScrollDone = useRef(false);

  const inputRefs = useRef<Partial<Record<TextFieldKey, DeferredTextInputHandle | null>>>({});
  // Stable callback refs (one per field) so React does not detach/re-attach them on every render.
  const inputRefBinders = useMemo(
    () =>
      Object.fromEntries(
        TEXT_FIELDS.map((key) => [
          key,
          (handle: DeferredTextInputHandle | null) => {
            inputRefs.current[key] = handle;
          },
        ]),
      ) as Record<TextFieldKey, (handle: DeferredTextInputHandle | null) => void>,
    [],
  );

  useEffect(() => {
    setForm(initialForm);
    setTouched(false);
    setError(null);
  }, [initialForm]);

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.filter((p) => p.isActive) as AdminProductLite[];
  }, [products.data?.items]);

  const autoAddress = useMemo(
    () =>
      buildAutoAddress({
        houseFlatNumber: form.houseFlatNumber,
        societyName: form.societyName,
        streetArea: form.streetArea,
        city: form.city,
        pincode: form.pincode,
      }),
    [form.city, form.houseFlatNumber, form.pincode, form.societyName, form.streetArea],
  );

  useEffect(() => {
    setForm((s) => (s.address === autoAddress ? s : { ...s, address: autoAddress }));
  }, [autoAddress]);

  const deferredForm = useDeferredValue(form);
  const deferredAdminProducts = useDeferredValue(adminProducts);

  // Validation messages are in the app language, so a language change re-validates.
  const parsed = useMemo(
    () => validateCustomerFormForMode(mode, deferredForm, deferredAdminProducts),
    [deferredAdminProducts, deferredForm, mode, lang],
  );

  // Once the user has tried to save, problems show under their own fields.
  const fieldErrors = useMemo(
    () => (touched && !parsed.success ? errorsByField(parsed.error.issues) : {}),
    [touched, parsed],
  );

  const onSectionLayout = (key: CustomerFormTab) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
    if (!initialScrollDone.current && initialSection && initialSection !== 'basic' && key === initialSection) {
      initialScrollDone.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - amraleSpacing.sm), animated: false });
    }
  };

  function scrollToSection(section: CustomerFormTab) {
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[section] ?? 0) - amraleSpacing.sm), animated: true });
  }

  function closeTopmostOverlay(): boolean {
    if (dobPickerOpen) {
      setDobPickerOpen(false);
      return true;
    }
    if (deliveryBoyOpen) {
      setDeliveryBoyOpen(false);
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (closeTopmostOverlay()) return true;
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [deliveryBoyOpen, dobPickerOpen, onCancel]);

  function openDatePicker(field: keyof CustomerFormState) {
    setDateTarget({ field });
    setDobPickerOpen(true);
  }

  function openDobPicker() {
    setDateTarget(null);
    setDobPickerOpen(true);
  }

  function applyPickedDate(ddmmyyyy: string) {
    if (!dateTarget) {
      setForm((s) => ({ ...s, dateOfBirth: ddmmyyyy }));
    } else {
      setForm((s) => ({ ...s, [dateTarget.field]: ddmmyyyy }));
    }
    // `dateTarget` stays until the next opening sets it, so the picker's title does not flip while it fades out.
    setDobPickerOpen(false);
  }

  /**
   * Form state with every mounted text field flushed. Tapping Save does not blur the focused input on native, so the
   * last keystrokes may still sit in a DeferredTextInput debounce; `flush()` also queues them into `form`.
   */
  function readLatestForm(): CustomerFormState {
    let latest = form;
    for (const key of TEXT_FIELDS) {
      const handle = inputRefs.current[key];
      if (!handle) continue;
      const text = handle.flush();
      if (latest[key] !== text) latest = { ...latest, [key]: text };
    }
    const address = buildAutoAddress(latest);
    return latest.address === address ? latest : { ...latest, address };
  }

  async function handleSave() {
    setTouched(true);
    setError(null);
    const latest = readLatestForm();
    const current = validateCustomerFormForMode(mode, latest, adminProducts);
    if (!current.success) {
      const sections = current.error.issues.map((i) => FIELD_SECTION[String(i.path[0] ?? '')] ?? 'basic');
      const first = SECTION_ORDER.find((s) => sections.includes(s)) ?? 'basic';
      scrollToSection(first);
      return;
    }
    try {
      await onSave(latest);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.saveFailed);
    }
  }

  function handleCancel() {
    if (closeTopmostOverlay()) return;
    onCancel();
  }

  /** Rounded text field: label, icon + input, inline error. */
  function textField(
    key: TextFieldKey,
    label: string,
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'],
    input: Omit<React.ComponentProps<typeof DeferredTextInput>, 'value' | 'onChangeText'>,
  ) {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel>{label}</FieldLabel>
        <View style={[formInputStyles.inputRow, fieldErrors[key] && formInputStyles.inputRowError]}>
          <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
          <DeferredTextInput
            ref={inputRefBinders[key]}
            {...plainTextInputProps}
            placeholderTextColor={amraleColors.textSubtle}
            {...input}
            value={form[key]}
            onChangeText={(t) => setForm((s) => ({ ...s, [key]: t }))}
            style={formInputStyles.inputText}
          />
        </View>
        <FieldError message={fieldErrors[key]} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        {/* Title row shares the form's centered column so it lines up with the fields on tablets/laptops. */}
        <View style={[styles.headerRow, formContainerStyle]}>
          <Pressable
            onPress={handleCancel}
            hitSlop={4}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            accessibilityLabel={t.goBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={amraleColors.blue} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, formContainerStyle, { paddingBottom: scrollPaddingBottom(120) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Basic information ── */}
          <FormSection title={t.sections.basic} icon="account-outline" onLayout={onSectionLayout('basic')}>
            {textField('name', t.fullName, 'account-outline', {
              ...formFieldAttrs('customer-full-name', { autoComplete: 'name' }),
              placeholder: t.fullNamePlaceholder,
            })}

            {/* Two columns once the card is wide enough (tablet/desktop); stacks on phones. */}
            <View style={styles.row2}>
              <View style={styles.fieldCellWide}>
                {textField('mobile', t.mobile, 'cellphone', {
                  ...formFieldAttrs('customer-mobile', { autoComplete: 'tel' }),
                  sanitize: sanitizeMobileInput,
                  maxLength: MOBILE_INPUT_MAX_LENGTH,
                  placeholder: t.mobilePlaceholder,
                  keyboardType: 'number-pad',
                })}
              </View>
              <View style={styles.fieldCellWide}>
                {textField('alternateMobile', t.alternateMobile, 'phone-outline', {
                  ...formFieldAttrs('customer-alternate-mobile', { autoComplete: 'tel' }),
                  sanitize: sanitizeMobileInput,
                  maxLength: MOBILE_INPUT_MAX_LENGTH,
                  placeholder: t.optional,
                  keyboardType: 'number-pad',
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.dateOfBirth}</FieldLabel>
              <Pressable
                onPress={openDobPicker}
                style={({ pressed }) => [
                  formInputStyles.inputRow,
                  fieldErrors.dateOfBirth && formInputStyles.inputRowError,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons name="cake-variant-outline" size={20} color={amraleColors.blue} />
                <Text style={[formInputStyles.inputValue, !form.dateOfBirth && formInputStyles.placeholder]}>
                  {form.dateOfBirth || t.dobPlaceholder}
                </Text>
                <MaterialCommunityIcons name="calendar" size={20} color={amraleColors.textMuted} />
              </Pressable>
              <FieldError message={fieldErrors.dateOfBirth} />
            </View>

            <ToggleCard
              icon="cellphone-key"
              label={t.appAccess}
              hint={t.appAccessHint}
              value={form.appAccessEnabled}
              onChange={(v) => setForm((s) => ({ ...s, appAccessEnabled: v, status: v ? 'Active' : 'Inactive' }))}
            />
            <ToggleCard
              icon="account-check-outline"
              label={t.activeCustomer}
              hint={t.activeCustomerHint}
              value={form.status === 'Active'}
              onChange={(v) => setForm((s) => ({ ...s, status: v ? 'Active' : 'Inactive', appAccessEnabled: v }))}
            />

            {mode === 'create' ? (
              <Text style={styles.hint}>{t.subscriptionHint}</Text>
            ) : null}
          </FormSection>

          {/* ── Address ── */}
          <FormSection title={t.sections.address} icon="map-marker-outline" onLayout={onSectionLayout('address')}>
            <View style={styles.row2}>
              <View style={styles.fieldCell}>
                {textField('houseFlatNumber', t.houseFlat, 'home-outline', {
                  ...formFieldAttrs('customer-house-flat', { autoComplete: 'address-line1' }),
                  placeholder: t.houseFlatPlaceholder,
                })}
              </View>
              <View style={styles.fieldCell}>
                {textField('societyName', t.society, 'office-building-outline', {
                  ...formFieldAttrs('customer-society', { autoComplete: 'organization' }),
                  placeholder: t.societyPlaceholder,
                })}
              </View>
            </View>

            {textField('streetArea', t.street, 'road-variant', {
              ...formFieldAttrs('customer-street', { autoComplete: 'street-address' }),
              placeholder: t.streetPlaceholder,
            })}

            {textField('landmark', t.landmark, 'map-marker-star-outline', {
              ...formFieldAttrs('customer-landmark'),
              placeholder: t.landmarkPlaceholder,
              maxLength: 80,
            })}

            {textField('mapLink', t.mapLink, 'map-marker-radius-outline', {
              ...formFieldAttrs('customer-map-link'),
              placeholder: t.mapLinkPlaceholder,
              autoCapitalize: 'none',
              autoCorrect: false,
              maxLength: 500,
            })}
            <Text style={styles.mapHint}>{t.mapHint}</Text>

            <View style={styles.row2}>
              <View style={styles.fieldCell}>
                {textField('city', t.city, 'city-variant-outline', {
                  ...formFieldAttrs('customer-city'),
                  placeholder: t.city,
                })}
              </View>
              <View style={styles.fieldCell}>
                {textField('pincode', t.pincode, 'mailbox-outline', {
                  ...formFieldAttrs('customer-pincode', { autoComplete: 'postal-code' }),
                  sanitize: sanitizePincodeInput,
                  placeholder: t.pincode,
                  keyboardType: 'number-pad',
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.fullAddress}</FieldLabel>
              <View
                style={[
                  formInputStyles.inputRow,
                  formInputStyles.inputRowMultiline,
                  formInputStyles.inputRowReadonly,
                  fieldErrors.address && formInputStyles.inputRowError,
                ]}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={amraleColors.textMuted} />
                <Text style={[formInputStyles.inputValue, !form.address && formInputStyles.placeholder]}>
                  {form.address || t.fullAddressPlaceholder}
                </Text>
              </View>
              <FieldError message={fieldErrors.address} />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.deliveryBoy}</FieldLabel>
              <Pressable
                onPress={() => setDeliveryBoyOpen(true)}
                style={({ pressed }) => [formInputStyles.inputRow, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="truck-outline" size={20} color={amraleColors.blue} />
                <Text style={[formInputStyles.inputValue, !form.assignedDeliveryBoyName && formInputStyles.placeholder]}>
                  {form.assignedDeliveryBoyName || t.deliveryBoyPlaceholder}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={amraleColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.route}</FieldLabel>
              <View style={[formInputStyles.inputRow, formInputStyles.inputRowReadonly]}>
                <MaterialCommunityIcons name="routes" size={20} color={amraleColors.textMuted} />
                <Text style={[formInputStyles.inputValue, !form.routeName && formInputStyles.placeholder]}>
                  {form.routeName || t.routePlaceholder}
                </Text>
              </View>
            </View>
          </FormSection>

          {/* ── Billing ── */}
          <FormSection title={t.sections.billing} icon="credit-card-outline" onLayout={onSectionLayout('billing')}>
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.billingType}</FieldLabel>
              <OptionChips
                options={['Postpaid', 'Prepaid'] as const}
                value={form.billingType}
                onChange={(billingType) => setForm((s) => ({ ...s, billingType }))}
                labelFor={(option) => customersText.billingTypes[option]}
              />
            </View>

            {form.billingType === 'Postpaid' ? (
              <View style={styles.fieldBlock}>
                <FieldLabel>{t.billingDate}</FieldLabel>
                <Pressable
                  onPress={() => openDatePicker('billingDate')}
                  style={({ pressed }) => [
                    formInputStyles.inputRow,
                    fieldErrors.billingCycleDate && formInputStyles.inputRowError,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialCommunityIcons name="calendar-month-outline" size={20} color={amraleColors.blue} />
                  <Text style={[formInputStyles.inputValue, !form.billingDate && formInputStyles.placeholder]}>
                    {form.billingDate || t.billingDatePlaceholder}
                  </Text>
                  <MaterialCommunityIcons name="calendar" size={20} color={amraleColors.textMuted} />
                </Pressable>
                <Text style={styles.fieldHint}>{t.billingDateHint}</Text>
                <FieldError message={fieldErrors.billingCycleDate} />
              </View>
            ) : (
              <Text style={styles.fieldHint}>{t.prepaidHint}</Text>
            )}
          </FormSection>

          {/* Field problems show under their fields; this is for form-wide issues and save failures only. */}
          {fieldErrors.other ? <Text style={styles.errorText}>{fieldErrors.other}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: scrollPaddingBottom(amraleSpacing.md) }]}>
          <ResponsiveContainer variant="form" style={styles.footerRow}>
            <Pressable onPress={handleCancel} disabled={isPending} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{t.cancel}</Text>
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

      {/* Shared JS picker on every platform: the native iOS picker crashed the app here (it aborts on display="calendar"). */}
      <DatePickerModal
        visible={dobPickerOpen}
        value={dateTarget ? String(form[dateTarget.field] ?? '') : form.dateOfBirth}
        // Date of birth opens on a typical adult birth year and stops at this year; other dates may be a few years ahead.
        fallbackDate={dateTarget ? undefined : new Date(1995, 0, 1)}
        yearsAhead={dateTarget ? 5 : 0}
        title={dateTarget ? t.selectDate : t.dateOfBirth}
        onSelect={applyPickedDate}
        onDismiss={() => setDobPickerOpen(false)}
      />

      <Modal visible={deliveryBoyOpen} transparent animationType="fade" onRequestClose={() => setDeliveryBoyOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeliveryBoyOpen(false)} />
        <View style={[styles.modalSheet, { width: pickerSheetWidth }]}>
          <Text style={styles.modalTitle}>{t.selectDeliveryBoy}</Text>
          <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
            {(deliveryBoys.data?.items ?? []).map((b) => (
              <Pressable
                key={b.id}
                onPress={() => {
                  setForm((s) => ({
                    ...s,
                    assignedDeliveryBoyId: b.id,
                    assignedDeliveryBoyName: b.fullName,
                    routeName: b.primaryRouteName,
                  }));
                  setDeliveryBoyOpen(false);
                }}
                style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={styles.pickItemTitle} numberOfLines={1}>
                    {b.fullName}
                  </Text>
                  <Text style={styles.pickItemSub} numberOfLines={1}>
                    {b.primaryRouteName}
                  </Text>
                </View>
                {form.assignedDeliveryBoyId === b.id ? (
                  <MaterialCommunityIcons name="check" size={18} color={dairyTactileColors.primaryContainer} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setDeliveryBoyOpen(false)} style={styles.modalCloseBtn}>
            <Text style={styles.cancelText}>{t.close}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  flex: { flex: 1 },
  header: {
    paddingBottom: amraleSpacing.sm,
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
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
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  scroll: {
    padding: amraleSpacing.md,
    gap: amraleSpacing.md,
  },
  fieldBlock: { gap: 8 },
  mapHint: { marginTop: -4, fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },
  /** Side-by-side fields that wrap to one column when the card is too narrow (e.g. 320px phones). */
  row2: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: amraleSpacing.md },
  /** Short fields (City / Pincode, House / Society): two columns from ~360px phones up. */
  fieldCell: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0 },
  /** Mobile numbers: two columns only on tablet/desktop-width cards, stacked on phones. */
  fieldCellWide: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: amraleColors.textMuted,
  },
  fieldHint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textMuted,
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
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: amraleRadius.md,
    marginBottom: 6,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
  },
  pickItemTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    color: dairyTactileColors.onSurface,
  },
  pickItemSub: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    color: dairyTactileColors.onSurfaceVariant,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 29, 45, 0.45)',
  },
  /** Width is set inline: window minus a 16px gutter on phones, capped at the 560px sheet width and centered. */
  modalSheet: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: amraleSpacing.xl,
    maxHeight: '70%',
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    ...tactileCardElevation(),
  },
  modalTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 17,
    color: dairyTactileColors.onSurface,
    marginBottom: amraleSpacing.sm,
  },
  modalList: { maxHeight: 320 },
  modalCloseBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: amraleSpacing.sm },
});
