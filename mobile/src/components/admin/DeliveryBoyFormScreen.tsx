import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { DateInput } from '@/src/components/DateInput';
import {
  applySalaryTypeSwitch,
  daysThisMonth,
  parseMonthlyRupees,
  parsePerDayAmount,
  validateSimpleDeliveryBoyForm,
  type SimpleDeliveryBoyForm,
} from '@/src/components/admin/deliveryBoyFormShared';
import {
  FieldError,
  FieldLabel,
  FormSection,
  formInputStyles,
  OptionChips,
  ToggleCard,
} from '@/src/components/shared/formFields';
import { ResponsiveContainer, useResponsiveContainerStyle } from '@/src/components/shared/ResponsiveContainer';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { roundMoney2 } from '@/src/domain/deliveryBoys/salary';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
/** The form's sections — also the values of the `section` route param the Details screen's Edit links pass. */
export type DeliveryBoyFormSection = 'basic' | 'salary';
type FormSectionKey = DeliveryBoyFormSection;

export type DeliveryBoyFormScreenProps = {
  title: string;
  saveLabel: string;
  initialForm: SimpleDeliveryBoyForm;
  /** Scroll to this section on open (the Details screen's per-section Edit links). */
  initialSection?: DeliveryBoyFormSection;
  isPending?: boolean;
  onSave: (form: SimpleDeliveryBoyForm) => Promise<void>;
  onCancel: () => void;
};

/** Sections in screen order, so a failed save scrolls to the first one with a problem. */
const SECTION_ORDER: FormSectionKey[] = ['basic', 'salary'];

const FIELD_SECTION: Record<string, FormSectionKey> = {
  fullName: 'basic',
  mobileNumber: 'basic',
  primaryRouteName: 'basic',
  joiningDate: 'basic',
  status: 'basic',
  salaryType: 'salary',
  monthlySalary: 'salary',
  perDaySalary: 'salary',
};

const SALARY_TYPES = ['Fixed Monthly Salary', 'Attendance Based Salary'] as const;

export function DeliveryBoyFormScreen({
  title,
  saveLabel,
  initialForm,
  initialSection,
  isPending = false,
  onSave,
  onCancel,
}: DeliveryBoyFormScreenProps) {
  const t = useStrings('deliveryBoys').form;
  const c = useStrings('common');
  const lang = useLanguage();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  // Phones: full width. Tablets/desktops: header, fields and footer share one centered 720px column.
  const formContainerStyle = useResponsiveContainerStyle('form');
  // Phone held sideways: a slimmer footer leaves more of the ~360px height for the fields.
  const compactFooter = useWindowDimensions().height < 520;

  const [form, setForm] = useState<SimpleDeliveryBoyForm>(initialForm);
  const [touched, setTouched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  /** Section top offsets inside the scroll content (for initialSection and for scrolling to errors). */
  const sectionY = useRef<Partial<Record<FormSectionKey, number>>>({});
  const initialScrollDone = useRef(false);

  useEffect(() => {
    setForm(initialForm);
    setTouched(false);
    setSaveError(null);
  }, [initialForm]);

  // Problems only show once the user has tried to save.
  const fieldErrors = useMemo(
    () => (touched ? validateSimpleDeliveryBoyForm(form) : {}),
    // `lang`: the messages follow the app language.
    [form, touched, lang],
  );

  const monthlyEditable = form.salaryType === 'Fixed Monthly Salary';
  const perDayEditable = form.salaryType === 'Attendance Based Salary';

  const onSectionLayout = (key: FormSectionKey) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
    if (!initialScrollDone.current && initialSection && initialSection !== 'basic' && key === initialSection) {
      initialScrollDone.current = true;
      scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - amraleSpacing.sm), animated: false });
    }
  };

  function scrollToSection(section: FormSectionKey) {
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[section] ?? 0) - amraleSpacing.sm), animated: true });
  }

  function setMonthly(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 9);
    setForm((s) => {
      const m = parseMonthlyRupees(digits);
      // Clearing the monthly amount clears the derived per-day preview as well.
      if (!digits.trim() || m <= 0) return { ...s, monthlySalary: digits, perDaySalary: '' };
      return { ...s, monthlySalary: digits, perDaySalary: String(roundMoney2(m / daysThisMonth())) };
    });
  }

  function setPerDay(text: string) {
    setForm((s) => {
      const p = parsePerDayAmount(text);
      if (!text.trim() || p === undefined || p <= 0) return { ...s, perDaySalary: text, monthlySalary: '' };
      return { ...s, perDaySalary: text, monthlySalary: String(Math.round(p * daysThisMonth())) };
    });
  }

  async function handleSave() {
    setTouched(true);
    setSaveError(null);
    const errs = validateSimpleDeliveryBoyForm(form);
    const keys = Object.keys(errs);
    if (keys.length) {
      const sections = keys.map((k) => FIELD_SECTION[k] ?? 'basic');
      scrollToSection(SECTION_ORDER.find((s) => sections.includes(s)) ?? 'basic');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : t.saveFailed);
    }
  }

  function textField(
    key: 'fullName' | 'mobileNumber' | 'primaryRouteName',
    label: string,
    icon: IconName,
    input: Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'style'> & { sanitize?: (t: string) => string },
  ) {
    const { sanitize, ...textInputProps } = input;
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel>{label}</FieldLabel>
        <View style={[formInputStyles.inputRow, fieldErrors[key] && formInputStyles.inputRowError]}>
          <MaterialCommunityIcons name={icon} size={20} color={amraleColors.blue} />
          <TextInput
            placeholderTextColor={amraleColors.textSubtle}
            {...textInputProps}
            value={form[key]}
            onChangeText={(t) => setForm((s) => ({ ...s, [key]: sanitize ? sanitize(t) : t }))}
            style={formInputStyles.inputText}
          />
        </View>
        <FieldError message={fieldErrors[key]} />
      </View>
    );
  }

  /** Monthly / per-day amount. Only the field the salary type uses is editable; the other previews the conversion. */
  function salaryField(
    key: 'monthlySalary' | 'perDaySalary',
    label: string,
    icon: IconName,
    editable: boolean,
    hint: string,
    onChangeText: (t: string) => void,
  ) {
    return (
      <View style={styles.fieldBlock}>
        <FieldLabel>{label}</FieldLabel>
        <View
          style={[
            formInputStyles.inputRow,
            !editable && formInputStyles.inputRowReadonly,
            fieldErrors[key] && formInputStyles.inputRowError,
          ]}
        >
          <MaterialCommunityIcons name={icon} size={20} color={editable ? amraleColors.blue : amraleColors.textMuted} />
          <TextInput
            {...formFieldAttrs(`delivery-boy-${key}`)}
            value={form[key]}
            onChangeText={onChangeText}
            editable={editable}
            placeholder={editable ? label : t.calculatedAutomatically}
            placeholderTextColor={amraleColors.textSubtle}
            keyboardType={key === 'monthlySalary' ? 'number-pad' : 'decimal-pad'}
            style={[formInputStyles.inputText, !editable && styles.readonlyText]}
          />
        </View>
        <Text style={styles.fieldHint}>{hint}</Text>
        <FieldError message={fieldErrors[key]} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={[styles.headerRow, formContainerStyle]}>
          <Pressable
            onPress={onCancel}
            hitSlop={4}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
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
          <FormSection title={t.basicSection} icon="account-outline" onLayout={onSectionLayout('basic')}>
            {textField('fullName', t.fullName, 'account-outline', {
              ...formFieldAttrs('delivery-boy-full-name', { autoComplete: 'name' }),
              placeholder: t.fullNamePlaceholder,
            })}

            <View style={styles.row2}>
              <View style={styles.fieldCell}>
                {textField('mobileNumber', t.mobile, 'cellphone', {
                  ...formFieldAttrs('delivery-boy-mobile', { autoComplete: 'tel' }),
                  placeholder: t.mobilePlaceholder,
                  keyboardType: 'number-pad',
                  maxLength: 10,
                  sanitize: (t) => t.replace(/\D/g, '').slice(0, 10),
                })}
              </View>
              <View style={styles.fieldCell}>
                {textField('primaryRouteName', t.route, 'routes', {
                  ...formFieldAttrs('delivery-boy-route'),
                  placeholder: t.routePlaceholder,
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>{t.joiningDate}</FieldLabel>
              <DateInput
                label={t.joiningDateInput}
                variant="plain"
                icon="calendar-account-outline"
                fieldName="delivery-boy-joining-date"
                value={form.joiningDate}
                onChange={(next) => setForm((s) => ({ ...s, joiningDate: next }))}
                hasError={!!fieldErrors.joiningDate}
              />
              <FieldError message={fieldErrors.joiningDate} />
            </View>

            <ToggleCard
              icon="account-check-outline"
              label={t.activeLabel}
              hint={t.activeHint}
              value={form.status === 'Active'}
              onChange={(v) => setForm((s) => ({ ...s, status: v ? 'Active' : 'Inactive' }))}
            />
          </FormSection>

          <FormSection title={t.salarySection} icon="cash-multiple" onLayout={onSectionLayout('salary')}>
            <View style={styles.fieldBlock}>
              <FieldLabel>{t.salaryType}</FieldLabel>
              <OptionChips
                options={SALARY_TYPES}
                value={form.salaryType}
                onChange={(next) => setForm((s) => applySalaryTypeSwitch(s, next))}
                // Same wording as the Details screen's "Salary type" value.
                labelFor={(o) => (o === 'Fixed Monthly Salary' ? t.fixedMonthly : t.attendanceBased)}
              />
              <FieldError message={fieldErrors.salaryType} />
            </View>

            {/* Side by side when the form is wide enough; each wraps to its own row on phones. */}
            <View style={styles.row2}>
              <View style={styles.fieldCell}>
                {salaryField(
                  'monthlySalary',
                  t.monthlySalary,
                  'currency-inr',
                  monthlyEditable,
                  monthlyEditable ? t.monthlyHint : t.monthlyEstimated(daysThisMonth()),
                  setMonthly,
                )}
              </View>
              <View style={styles.fieldCell}>
                {salaryField(
                  'perDaySalary',
                  t.perDaySalary,
                  'calendar-clock-outline',
                  perDayEditable,
                  perDayEditable ? t.perDayHint : t.perDayEstimated(daysThisMonth()),
                  setPerDay,
                )}
              </View>
            </View>
          </FormSection>

          {fieldErrors._form ? <Text style={styles.errorText}>{fieldErrors._form}</Text> : null}
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            compactFooter && styles.footerCompact,
            { paddingBottom: scrollPaddingBottom(compactFooter ? amraleSpacing.sm : amraleSpacing.md) },
          ]}
        >
          <ResponsiveContainer variant="form" style={styles.footerRow}>
            <Pressable onPress={onCancel} disabled={isPending} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>{c.actions.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isPending}
              style={({ pressed }) => [
                styles.saveBtn,
                compactFooter && styles.saveBtnCompact,
                pressed && styles.pressed,
                isPending && styles.disabled,
              ]}
              accessibilityRole="button"
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: amraleSpacing.sm, paddingHorizontal: amraleSpacing.md },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: amraleColors.blue,
  },
  scroll: { padding: amraleSpacing.md, gap: amraleSpacing.md },
  fieldBlock: { gap: 8 },
  /** Side-by-side fields that wrap to one column on narrow phones. */
  row2: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: amraleSpacing.md },
  fieldCell: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  readonlyText: { color: amraleColors.textMuted },
  fieldHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  footer: {
    paddingTop: amraleSpacing.md,
    backgroundColor: amraleColors.white,
    borderTopWidth: 1,
    borderTopColor: amraleColors.inputBorderLight,
  },
  footerCompact: { paddingTop: amraleSpacing.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: amraleSpacing.md },
  cancelBtn: { minHeight: 44, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  cancelText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.blue },
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
  saveBtnCompact: { minHeight: 44 },
  saveText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.white },
  saveIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: amraleColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
});
