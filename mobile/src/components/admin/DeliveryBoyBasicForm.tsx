import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { daysInMonth, roundMoney2 } from '@/src/domain/deliveryBoys/salary';
import { CreateDeliveryBoyRequestSchema } from '@/src/domain/deliveryBoys/validations';
import { DateInput } from '@/src/components/DateInput';
import { RESPONSIVE } from '@/src/utils/responsiveLayout';

export const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
  muted: '#64748B',
};

const INPUT_MIN_HEIGHT = 48;
const CARD_RADIUS = 12;

export type SimpleDeliveryBoyForm = {
  fullName: string;
  mobileNumber: string;
  primaryRouteName: string;
  joiningDate: string;
  monthlySalary: string;
  perDaySalary: string;
  salaryType: 'Fixed Monthly Salary' | 'Attendance Based Salary';
  status: 'Active' | 'Inactive';
};

export function emptySimpleDeliveryBoyForm(): SimpleDeliveryBoyForm {
  return {
    fullName: '',
    mobileNumber: '',
    primaryRouteName: '',
    joiningDate: '',
    monthlySalary: '',
    perDaySalary: '',
    salaryType: 'Fixed Monthly Salary',
    status: 'Active',
  };
}

function isoToDdMmYyyy(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function calendarMonthKeyNow(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function daysThisMonth(): number {
  return daysInMonth(calendarMonthKeyNow());
}

function applySalaryTypeSwitch(s: SimpleDeliveryBoyForm, nextType: SimpleDeliveryBoyForm['salaryType']): SimpleDeliveryBoyForm {
  if (nextType === s.salaryType) return s;
  const days = daysThisMonth();
  const m = parseMonthlyRupees(s.monthlySalary);
  const p = parsePerDayAmount(s.perDaySalary);

  if (nextType === 'Fixed Monthly Salary') {
    if (m > 0) {
      return { ...s, salaryType: nextType, perDaySalary: String(roundMoney2(m / days)) };
    }
    if (p !== undefined && p > 0) {
      return { ...s, salaryType: nextType, monthlySalary: String(Math.round(p * days)) };
    }
    return { ...s, salaryType: nextType };
  }

  if (p !== undefined && p > 0) {
    return { ...s, salaryType: nextType, monthlySalary: String(Math.round(p * days)) };
  }
  if (m > 0) {
    return { ...s, salaryType: nextType, perDaySalary: String(roundMoney2(m / days)) };
  }
  return { ...s, salaryType: nextType };
}

export function simpleFormFromDeliveryBoy(b: DeliveryBoyResponse): SimpleDeliveryBoyForm {
  const type = b.salaryType ?? 'Fixed Monthly Salary';
  const days = daysThisMonth();
  let monthlySalary = String(b.monthlySalary ?? '');
  let perDaySalary = b.perDaySalary != null ? String(b.perDaySalary) : '';

  if (type === 'Attendance Based Salary') {
    const pd = b.perDaySalary != null && Number(b.perDaySalary) > 0 ? Number(b.perDaySalary) : undefined;
    if (pd !== undefined) {
      perDaySalary = String(roundMoney2(pd));
      monthlySalary = String(Math.round(pd * days));
    }
  } else if (type === 'Fixed Monthly Salary') {
    const m = Number(b.monthlySalary ?? 0);
    if (m > 0 && b.perDaySalary == null) {
      perDaySalary = String(roundMoney2(m / days));
    }
  }

  return {
    fullName: b.fullName ?? '',
    mobileNumber: b.mobileNumber ?? '',
    primaryRouteName: b.primaryRouteName ?? '',
    joiningDate: isoToDdMmYyyy(b.joiningDate),
    monthlySalary,
    perDaySalary,
    salaryType: type,
    status: b.status ?? 'Active',
  };
}

export function ddmmyyyyToIso(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${String(yyyy)}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function parseMonthlyRupees(s: string): number {
  const t = s.replace(/\D/g, '');
  if (!t) return 0;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : 0;
}

function parsePerDayAmount(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function buildCreatePayloadFromSimpleForm(form: SimpleDeliveryBoyForm, joiningIso: string) {
  const monthly = parseMonthlyRupees(form.monthlySalary);
  const manualPerDay = parsePerDayAmount(form.perDaySalary);
  let perDaySalary: number | undefined;
  if (form.salaryType === 'Attendance Based Salary') {
    perDaySalary = manualPerDay;
  } else {
    if (manualPerDay !== undefined) perDaySalary = manualPerDay;
    else if (monthly > 0) perDaySalary = roundMoney2(monthly / daysInMonth(calendarMonthKeyNow()));
  }
  return {
    fullName: form.fullName.trim(),
    mobileNumber: form.mobileNumber.trim(),
    primaryRouteName: form.primaryRouteName.trim(),
    joiningDate: joiningIso,
    monthlySalary: form.salaryType === 'Attendance Based Salary' ? 0 : monthly,
    salaryType: form.salaryType,
    perDaySalary,
    status: form.status,
    appAccessEnabled: true as const,
  };
}

export function buildUpdatePayloadFromSimpleForm(form: SimpleDeliveryBoyForm, joiningIso: string) {
  const p = buildCreatePayloadFromSimpleForm(form, joiningIso);
  return {
    fullName: p.fullName,
    mobileNumber: p.mobileNumber,
    primaryRouteName: p.primaryRouteName,
    joiningDate: p.joiningDate,
    monthlySalary: p.monthlySalary,
    salaryType: p.salaryType,
    perDaySalary: p.perDaySalary,
    status: p.status,
  };
}

export function validateSimpleDeliveryBoyForm(form: SimpleDeliveryBoyForm): Record<string, string> {
  const errs: Record<string, string> = {};
  const joiningIso = ddmmyyyyToIso(form.joiningDate.trim());
  if (!form.joiningDate.trim()) errs.joiningDate = 'Joining date is required';
  else if (!joiningIso) errs.joiningDate = 'Use a valid date (DD/MM/YYYY)';

  const monthly = parseMonthlyRupees(form.monthlySalary);
  if (form.salaryType === 'Fixed Monthly Salary') {
    if (!monthly || monthly <= 0) errs.monthlySalary = 'Monthly salary is required';
  }

  if (form.salaryType === 'Attendance Based Salary') {
    const pd = parsePerDayAmount(form.perDaySalary);
    if (pd === undefined || pd <= 0) errs.perDaySalary = 'Per day salary is required';
  }

  const payload = buildCreatePayloadFromSimpleForm(form, joiningIso ?? '');
  const parsed = CreateDeliveryBoyRequestSchema.safeParse(payload);
  if (!parsed.success) {
    for (const iss of parsed.error.issues) {
      const key = String(iss.path[0] ?? '_form');
      if (!errs[key]) errs[key] = iss.message;
    }
  }

  return errs;
}

type Scheme = 'light' | 'dark';

type DeliveryBoyBasicFormFieldsProps = {
  form: SimpleDeliveryBoyForm;
  setForm: React.Dispatch<React.SetStateAction<SimpleDeliveryBoyForm>>;
  fieldErrors: Record<string, string>;
  scheme: Scheme | null | undefined;
};

export function DeliveryBoyBasicFormFields({ form, setForm, fieldErrors, scheme }: DeliveryBoyBasicFormFieldsProps) {
  const { width } = useWindowDimensions();
  const isDark = scheme === 'dark';

  const isMobile = width < RESPONSIVE.tabletMin;
  const isTablet = width >= RESPONSIVE.tabletMin && width < RESPONSIVE.desktopMin;
  const horizontalPad = isMobile ? 10 : isTablet ? 14 : 20;
  const availableWidth = Math.max(0, width - horizontalPad * 2);

  const cardWidth = isMobile
    ? availableWidth
    : isTablet
      ? Math.min(availableWidth, Math.round(width * 0.78))
      : Math.min(availableWidth, Math.max(420, Math.min(500, Math.round(width * 0.34))));

  const [salaryTypeOpen, setSalaryTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const textMain = isDark ? styles.textOnDark : styles.textOnLight;
  const textSub = isDark ? styles.subtleOnDark : styles.subtleOnLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const outlineIdle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(226,232,240,0.98)';

  const highlightMonthly = form.salaryType === 'Fixed Monthly Salary';
  const highlightPerDay = form.salaryType === 'Attendance Based Salary';
  const monthlyEditable = highlightMonthly;
  const perDayEditable = highlightPerDay;

  function wrapSalaryHighlight(active: boolean, child: React.ReactNode) {
    if (!active) return <>{child}</>;
    return <View style={[styles.salaryFieldWrap, isDark ? styles.highlightDark : styles.highlightLight]}>{child}</View>;
  }

  function fieldOutline(fieldKey: string) {
    return focusedField === fieldKey ? COLORS.primary : outlineIdle;
  }

  return (
    <View style={[styles.card, cardStyle, { padding: 10, borderRadius: CARD_RADIUS, width: cardWidth }]}>
      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Delivery boy name
        </Text>
        <TextInput
          mode="outlined"
          placeholder="Full name"
          value={form.fullName}
          onChangeText={(t) => setForm((s) => ({ ...s, fullName: t }))}
          onFocus={() => setFocusedField('fullName')}
          onBlur={() => setFocusedField(null)}
          left={<TextInput.Icon icon="account-outline" />}
          style={styles.input}
          contentStyle={styles.inputContent}
          outlineStyle={styles.inputOutline}
          outlineColor={fieldOutline('fullName')}
          activeOutlineColor={COLORS.primary}
          error={!!fieldErrors.fullName}
        />
        {fieldErrors.fullName ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.fullName}
          </HelperText>
        ) : null}
      </View>

      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Mobile number
        </Text>
        <TextInput
          mode="outlined"
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          value={form.mobileNumber}
          onChangeText={(t) => setForm((s) => ({ ...s, mobileNumber: t.replace(/[^\d]/g, '').slice(0, 10) }))}
          onFocus={() => setFocusedField('mobile')}
          onBlur={() => setFocusedField(null)}
          left={<TextInput.Icon icon="phone-outline" />}
          style={styles.input}
          contentStyle={styles.inputContent}
          outlineStyle={styles.inputOutline}
          outlineColor={fieldOutline('mobile')}
          activeOutlineColor={COLORS.primary}
          error={!!fieldErrors.mobileNumber}
        />
        {fieldErrors.mobileNumber ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.mobileNumber}
          </HelperText>
        ) : null}
      </View>

      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Assigned route
        </Text>
        <TextInput
          mode="outlined"
          placeholder="Route or zone"
          value={form.primaryRouteName}
          onChangeText={(t) => setForm((s) => ({ ...s, primaryRouteName: t }))}
          onFocus={() => setFocusedField('route')}
          onBlur={() => setFocusedField(null)}
          left={<TextInput.Icon icon="map-marker-outline" />}
          style={styles.input}
          contentStyle={styles.inputContent}
          outlineStyle={styles.inputOutline}
          outlineColor={fieldOutline('route')}
          activeOutlineColor={COLORS.primary}
          error={!!fieldErrors.primaryRouteName}
        />
        {fieldErrors.primaryRouteName ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.primaryRouteName}
          </HelperText>
        ) : null}
      </View>

      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Salary type
        </Text>
        <Pressable
          onPress={() => setSalaryTypeOpen(true)}
          style={({ pressed }) => [
            styles.selectRow,
            isDark ? styles.selectRowDark : styles.selectRowLight,
            pressed && styles.selectPressed,
          ]}
        >
          <MaterialCommunityIcons name="cash-multiple" size={18} color={isDark ? 'rgba(255,255,255,0.8)' : COLORS.primary} />
          <Text variant="bodyMedium" style={[textMain, { flex: 1, marginLeft: 8 }]} numberOfLines={2}>
            {form.salaryType}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={isDark ? 'rgba(255,255,255,0.65)' : COLORS.muted} />
        </Pressable>
        {fieldErrors.salaryType ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.salaryType}
          </HelperText>
        ) : null}
      </View>

      <View>
        {wrapSalaryHighlight(
          highlightMonthly,
          <>
            <Text variant="labelSmall" style={[styles.fieldLabel, textMain, !monthlyEditable && textSub]}>
              Monthly salary amount
            </Text>
            <TextInput
              mode="outlined"
              placeholder="₹ per month"
              keyboardType="number-pad"
              value={form.monthlySalary}
              editable={monthlyEditable}
              onChangeText={(t) => {
                if (!monthlyEditable) return;
                const digits = t.replace(/\D/g, '').slice(0, 9);
                setForm((s) => {
                  const m = parseMonthlyRupees(digits);
                  if (!digits.trim() || m <= 0) {
                    return { ...s, monthlySalary: digits, perDaySalary: '' };
                  }
                  const per = String(roundMoney2(m / daysThisMonth()));
                  return { ...s, monthlySalary: digits, perDaySalary: per };
                });
              }}
              onFocus={() => monthlyEditable && setFocusedField('monthly')}
              onBlur={() => setFocusedField(null)}
              left={<TextInput.Icon icon="currency-inr" />}
              style={[styles.input, !monthlyEditable && (isDark ? styles.inputReadonlyDark : styles.inputReadonlyLight)]}
              contentStyle={[styles.inputContent, !monthlyEditable && (isDark ? styles.readonlyTextDark : styles.readonlyTextLight)]}
              outlineStyle={styles.inputOutline}
              outlineColor={monthlyEditable ? fieldOutline('monthly') : outlineIdle}
              activeOutlineColor={COLORS.primary}
              error={!!fieldErrors.monthlySalary}
            />
            {fieldErrors.monthlySalary ? (
              <HelperText type="error" padding="none" style={styles.helperError}>
                {fieldErrors.monthlySalary}
              </HelperText>
            ) : null}
          </>,
        )}
      </View>

      <View>
        {wrapSalaryHighlight(
          highlightPerDay,
          <>
            <Text variant="labelSmall" style={[styles.fieldLabel, textMain, !perDayEditable && textSub]}>
              Per day salary amount
            </Text>
            <TextInput
              mode="outlined"
              placeholder="₹ per day"
              keyboardType="decimal-pad"
              value={form.perDaySalary}
              editable={perDayEditable}
              onChangeText={(t) => {
                if (!perDayEditable) return;
                setForm((s) => {
                  const p = parsePerDayAmount(t);
                  if (!t.trim() || p === undefined || p <= 0) {
                    return { ...s, perDaySalary: t, monthlySalary: '' };
                  }
                  const mo = String(Math.round(p * daysThisMonth()));
                  return { ...s, perDaySalary: t, monthlySalary: mo };
                });
              }}
              onFocus={() => perDayEditable && setFocusedField('perDay')}
              onBlur={() => setFocusedField(null)}
              left={<TextInput.Icon icon="calendar-clock-outline" />}
              style={[styles.input, !perDayEditable && (isDark ? styles.inputReadonlyDark : styles.inputReadonlyLight)]}
              contentStyle={[styles.inputContent, !perDayEditable && (isDark ? styles.readonlyTextDark : styles.readonlyTextLight)]}
              outlineStyle={styles.inputOutline}
              outlineColor={perDayEditable ? fieldOutline('perDay') : outlineIdle}
              activeOutlineColor={COLORS.primary}
              error={!!fieldErrors.perDaySalary}
            />
            {fieldErrors.perDaySalary ? (
              <HelperText type="error" padding="none" style={styles.helperError}>
                {fieldErrors.perDaySalary}
              </HelperText>
            ) : null}
          </>,
        )}
      </View>

      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Joining date
        </Text>
        <DateInput
          label=""
          value={form.joiningDate}
          onChange={(next) => setForm((s) => ({ ...s, joiningDate: next }))}
          mode="outlined"
          dense
          activeOutlineColor={COLORS.primary}
          outlineStyle={styles.inputOutline}
        />
        {fieldErrors.joiningDate ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.joiningDate}
          </HelperText>
        ) : null}
      </View>

      <View>
        <Text variant="labelSmall" style={[styles.fieldLabel, textMain]}>
          Status
        </Text>
        <Pressable
          onPress={() => setStatusOpen(true)}
          style={({ pressed }) => [
            styles.selectRow,
            isDark ? styles.selectRowDark : styles.selectRowLight,
            pressed && styles.selectPressed,
          ]}
        >
          <MaterialCommunityIcons name="toggle-switch-outline" size={18} color={isDark ? 'rgba(255,255,255,0.8)' : COLORS.primary} />
          <Text variant="bodyMedium" style={[textMain, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>
            {form.status}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={isDark ? 'rgba(255,255,255,0.65)' : COLORS.muted} />
        </Pressable>
        {fieldErrors.status ? (
          <HelperText type="error" padding="none" style={styles.helperError}>
            {fieldErrors.status}
          </HelperText>
        ) : null}
      </View>

      <Portal>
        <Dialog visible={salaryTypeOpen} onDismiss={() => setSalaryTypeOpen(false)} style={isDark ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Salary type</Dialog.Title>
          <Dialog.Content>
            {(['Fixed Monthly Salary', 'Attendance Based Salary'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setForm((s) => applySalaryTypeSwitch(s, t));
                  setSalaryTypeOpen(false);
                }}
                style={({ pressed }) => [styles.pickItem, pressed && styles.pickPressed]}
              >
                <Text variant="bodyLarge" style={textMain}>
                  {t}
                </Text>
                {form.salaryType === t ? <MaterialCommunityIcons name="check" size={22} color={COLORS.accent} /> : null}
              </Pressable>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSalaryTypeOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={statusOpen} onDismiss={() => setStatusOpen(false)} style={isDark ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Status</Dialog.Title>
          <Dialog.Content>
            {(['Active', 'Inactive'] as const).map((st) => (
              <Pressable
                key={st}
                onPress={() => {
                  setForm((s) => ({ ...s, status: st }));
                  setStatusOpen(false);
                }}
                style={({ pressed }) => [styles.pickItem, pressed && styles.pickPressed]}
              >
                <Text variant="bodyLarge" style={textMain}>
                  {st}
                </Text>
                {form.status === st ? <MaterialCommunityIcons name="check" size={22} color={COLORS.accent} /> : null}
              </Pressable>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStatusOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: 'rgba(15,23,42,0.08)' },
  cardDark: { backgroundColor: 'rgba(22,30,50,0.94)', borderColor: 'rgba(255,255,255,0.1)' },
  fieldLabel: { fontWeight: '600', marginBottom: 2, fontSize: 12, letterSpacing: 0.15 },

  helperError: { marginTop: 0, marginBottom: 0, minHeight: 0 },
  salaryFieldWrap: { borderRadius: 10, padding: 4 },
  highlightLight: {
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.28)',
  },
  highlightDark: {
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
  },
  input: { minHeight: INPUT_MIN_HEIGHT, backgroundColor: 'transparent' },
  inputContent: { minHeight: INPUT_MIN_HEIGHT - 8, paddingVertical: 8 },
  inputOutline: { borderRadius: 12 },
  inputReadonlyLight: { backgroundColor: 'rgba(248,250,252,0.98)' },
  inputReadonlyDark: { backgroundColor: 'rgba(30,41,59,0.55)' },
  readonlyTextLight: { color: 'rgba(100,116,139,0.95)' },
  readonlyTextDark: { color: 'rgba(203,213,225,0.82)' },
  selectRow: {
    minHeight: INPUT_MIN_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectRowLight: { borderColor: 'rgba(226,232,240,0.98)', backgroundColor: 'rgba(248,250,252,0.96)' },
  selectRowDark: { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)' },
  selectPressed: { opacity: 0.92 },
  pickItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  pickPressed: { opacity: 0.85 },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(248,250,252,0.98)' },
  subtleOnLight: { color: 'rgba(71,85,105,0.82)' },
  subtleOnDark: { color: 'rgba(148,163,184,0.88)' },
  dialogLight: { backgroundColor: '#fff', borderRadius: 16 },
  dialogDark: { backgroundColor: '#0F172A', borderRadius: 16 },
});
