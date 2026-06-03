import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Dialog, Portal, Text as PaperText } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';

import type { AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import {
  dateToDob,
  dobToDate,
  dobToIsoDate,
  isoDateToDob,
} from '@/src/components/admin/customerFormDates';
import type { CustomerFormState, CustomerFormTab } from '@/src/components/admin/customerFormShared';
import { validateCustomerForm } from '@/src/components/admin/customerFormShared';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useProducts } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyTactileColors,
  primaryButtonElevation,
  tactileCardElevation,
} from '@/src/theme/dairyTactile';
import { formFieldAttrs } from '@/src/theme/platformStyles';

export type CustomerFormScreenProps = {
  title: string;
  saveLabel: string;
  initialForm: CustomerFormState;
  isPending?: boolean;
  onSave: (form: CustomerFormState) => Promise<void>;
  onCancel: () => void;
};

const TABS: { key: CustomerFormTab; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'address', label: 'Address' },
  { key: 'billing', label: 'Billing' },
];

function monthLabel(monthIndex0: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex0] ?? '';
}

export function CustomerFormScreen({
  title,
  saveLabel,
  initialForm,
  isPending = false,
  onSave,
  onCancel,
}: CustomerFormScreenProps) {
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const products = useProducts();
  const deliveryBoys = useDeliveryBoys();

  const [form, setForm] = useState<CustomerFormState>(initialForm);
  const [formTab, setFormTab] = useState<CustomerFormTab>('basic');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobPickerStep, setDobPickerStep] = useState<'calendar' | 'year' | 'month'>('calendar');
  const [dobCursor, setDobCursor] = useState(() => new Date());
  const [dateTarget, setDateTarget] = useState<{ field: keyof CustomerFormState } | null>(null);
  const [deliveryBoyOpen, setDeliveryBoyOpen] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setFormTab('basic');
    setTouched(false);
    setError(null);
  }, [initialForm]);

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.filter((p) => p.isActive) as AdminProductLite[];
  }, [products.data?.items]);

  const autoAddress = useMemo(() => {
    const parts = [form.houseFlatNumber, form.societyName, form.streetArea, form.city, form.pincode]
      .map((x) => (x ?? '').trim())
      .filter(Boolean);
    return parts.join(', ');
  }, [form.city, form.houseFlatNumber, form.pincode, form.societyName, form.streetArea]);

  useEffect(() => {
    setForm((s) => (s.address === autoAddress ? s : { ...s, address: autoAddress }));
  }, [autoAddress]);

  const deferredForm = useDeferredValue(form);
  const deferredAdminProducts = useDeferredValue(adminProducts);

  const parsed = useMemo(
    () => validateCustomerForm(deferredForm, deferredAdminProducts),
    [deferredAdminProducts, deferredForm],
  );

  function closeTopmostOverlay(): boolean {
    if (dobPickerOpen) {
      setDobPickerOpen(false);
      setDateTarget(null);
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
    const v = String(form[field] ?? '').trim();
    const asDate = dobToDate(v) ?? (isoDateToDob(v) ? dobToDate(isoDateToDob(v) as string) : null);
    setDobCursor(asDate ?? new Date());
    setDobPickerStep('calendar');
    setDobPickerOpen(true);
  }

  function openDobPicker() {
    setDateTarget(null);
    const fromForm = dobToDate(form.dateOfBirth);
    setDobCursor(fromForm ?? new Date(1995, 0, 1));
    setDobPickerStep('calendar');
    setDobPickerOpen(true);
  }

  function applyPickedDate(ddmmyyyy: string) {
    if (!dateTarget) {
      setForm((s) => ({ ...s, dateOfBirth: ddmmyyyy }));
    } else {
      setForm((s) => ({ ...s, [dateTarget.field]: ddmmyyyy }));
    }
    setDateTarget(null);
    setDobPickerOpen(false);
  }

  async function handleSave() {
    setTouched(true);
    setError(null);
    const current = validateCustomerForm(form, adminProducts);
    if (!current.success) {
      setError(current.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Unable to save customer. Please try again.');
    }
  }

  function handleCancel() {
    if (closeTopmostOverlay()) return;
    onCancel();
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <Pressable onPress={handleCancel} style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]} accessibilityLabel="Go back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={dairyTactileColors.primaryContainer} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerIconBtn} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = formTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFormTab(tab.key)}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom(120) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formTab === 'basic' ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <MaterialCommunityIcons name="account-plus-outline" size={20} color={dairyTactileColors.primaryContainer} />
                  <Text style={styles.cardHeadingText}>Basic Information</Text>
                </View>

                <LabeledField label="Customer Full Name">
                  <TextInput
                    {...formFieldAttrs('customer-full-name', { autoComplete: 'name' })}
                    value={form.name}
                    onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
                    placeholder="e.g. Rahul Amrale"
                    placeholderTextColor={dairyTactileColors.outline}
                    style={styles.input}
                  />
                </LabeledField>

                <LabeledField label="Mobile Number">
                  <TextInput
                    {...formFieldAttrs('customer-mobile', { autoComplete: 'tel' })}
                    value={form.mobile}
                    onChangeText={(t) => setForm((s) => ({ ...s, mobile: t.replace(/[^\d]/g, '').slice(0, 10) }))}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={dairyTactileColors.outline}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </LabeledField>

                <LabeledField label="Alternate Mobile Number">
                  <TextInput
                    {...formFieldAttrs('customer-alternate-mobile', { autoComplete: 'tel' })}
                    value={form.alternateMobile}
                    onChangeText={(t) => setForm((s) => ({ ...s, alternateMobile: t.replace(/[^\d]/g, '').slice(0, 10) }))}
                    placeholder="Optional"
                    placeholderTextColor={dairyTactileColors.outline}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </LabeledField>

                <LabeledField label="Date of Birth">
                  <Pressable onPress={openDobPicker} style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}>
                    <Text style={[styles.inputValue, !form.dateOfBirth && styles.placeholder]}>
                      {form.dateOfBirth || 'dd / mm / yyyy'}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={22} color={dairyTactileColors.outline} />
                  </Pressable>
                </LabeledField>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color={dairyTactileColors.primaryContainer} />
                  <Text style={styles.cardHeadingText}>Access & Status</Text>
                </View>

                <ToggleRow
                  icon="cellphone"
                  label="App Access"
                  chipLabel={form.appAccessEnabled ? 'ENABLED' : 'DISABLED'}
                  chipTone={form.appAccessEnabled ? 'blue' : 'neutral'}
                  value={form.appAccessEnabled}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, appAccessEnabled: v, status: v ? 'Active' : 'Inactive' }))
                  }
                />

                <ToggleRow
                  icon="shield-check"
                  label="Customer Status"
                  chipLabel={form.status === 'Active' ? 'ACTIVE' : 'INACTIVE'}
                  chipTone={form.status === 'Active' ? 'green' : 'neutral'}
                  value={form.status === 'Active'}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, status: v ? 'Active' : 'Inactive', appAccessEnabled: v }))
                  }
                  statusSwitch
                />
              </View>

              <Text style={styles.hint}>
                Subscription products and delivery plans are managed from the customer&apos;s Subscription tab after you save.
              </Text>
            </>
          ) : null}

          {formTab === 'address' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={dairyTactileColors.primaryContainer} />
                <Text style={styles.cardHeadingText}>Address Information</Text>
              </View>

              <LabeledField label="House / Flat Number">
                <TextInput
                  {...formFieldAttrs('customer-house-flat', { autoComplete: 'address-line1' })}
                  value={form.houseFlatNumber}
                  onChangeText={(t) => setForm((s) => ({ ...s, houseFlatNumber: t }))}
                  placeholder="e.g. A-402"
                  placeholderTextColor={dairyTactileColors.outline}
                  style={styles.input}
                />
              </LabeledField>

              <LabeledField label="Building / Society Name">
                <TextInput
                  {...formFieldAttrs('customer-society', { autoComplete: 'organization' })}
                  value={form.societyName}
                  onChangeText={(t) => setForm((s) => ({ ...s, societyName: t }))}
                  placeholder="Society or building"
                  placeholderTextColor={dairyTactileColors.outline}
                  style={styles.input}
                />
              </LabeledField>

              <LabeledField label="Street / Area">
                <TextInput
                  {...formFieldAttrs('customer-street', { autoComplete: 'street-address' })}
                  value={form.streetArea}
                  onChangeText={(t) => setForm((s) => ({ ...s, streetArea: t }))}
                  placeholder="Street or area"
                  placeholderTextColor={dairyTactileColors.outline}
                  style={styles.input}
                />
              </LabeledField>

              <View style={styles.row2}>
                <View style={styles.flex}>
                  <LabeledField label="City">
                    <TextInput
                      {...formFieldAttrs('customer-city', { autoComplete: 'address-level2' })}
                      value={form.city}
                      onChangeText={(t) => setForm((s) => ({ ...s, city: t }))}
                      placeholder="City"
                      placeholderTextColor={dairyTactileColors.outline}
                      style={styles.input}
                    />
                  </LabeledField>
                </View>
                <View style={styles.flex}>
                  <LabeledField label="Pincode">
                    <TextInput
                      {...formFieldAttrs('customer-pincode', { autoComplete: 'postal-code' })}
                      value={form.pincode}
                      onChangeText={(t) => setForm((s) => ({ ...s, pincode: t.replace(/[^\d]/g, '').slice(0, 6) }))}
                      placeholder="Pincode"
                      placeholderTextColor={dairyTactileColors.outline}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </LabeledField>
                </View>
              </View>

              <LabeledField label="Assigned Delivery Boy">
                <Pressable
                  onPress={() => setDeliveryBoyOpen(true)}
                  style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}
                >
                  <Text style={[styles.inputValue, !form.assignedDeliveryBoyName && styles.placeholder]}>
                    {form.assignedDeliveryBoyName || 'Select delivery boy'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={22} color={dairyTactileColors.outline} />
                </Pressable>
              </LabeledField>

              <LabeledField label="Delivery Route">
                <TextInput
                  {...formFieldAttrs('customer-route')}
                  value={form.routeName}
                  editable={false}
                  placeholder="Auto-filled from delivery boy"
                  placeholderTextColor={dairyTactileColors.outline}
                  style={[styles.input, styles.inputDisabled]}
                />
              </LabeledField>

              <LabeledField label="Full Address">
                <TextInput
                  {...formFieldAttrs('customer-full-address', { autoComplete: 'street-address' })}
                  value={form.address}
                  editable={false}
                  multiline
                  placeholder="Auto-generated from fields above"
                  placeholderTextColor={dairyTactileColors.outline}
                  style={[styles.input, styles.inputMultiline, styles.inputDisabled]}
                />
              </LabeledField>
            </View>
          ) : null}

          {formTab === 'billing' ? (
            <View style={styles.card}>
              <View style={styles.cardHeading}>
                <MaterialCommunityIcons name="credit-card-outline" size={20} color={dairyTactileColors.primaryContainer} />
                <Text style={styles.cardHeadingText}>Billing Information</Text>
              </View>

              <LabeledField label="Billing Type">
                <Pressable
                  onPress={() =>
                    setForm((s) => ({ ...s, billingType: s.billingType === 'Postpaid' ? 'Prepaid' : 'Postpaid' }))
                  }
                  style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}
                >
                  <Text style={styles.inputValue}>{form.billingType}</Text>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color={dairyTactileColors.outline} />
                </Pressable>
              </LabeledField>

              {form.billingType === 'Postpaid' ? (
                <LabeledField label="Billing Date">
                  <Pressable
                    onPress={() => openDatePicker('billingDate')}
                    style={({ pressed }) => [styles.inputRow, pressed && styles.pressed]}
                  >
                    <Text style={[styles.inputValue, !form.billingDate && styles.placeholder]}>
                      {form.billingDate || 'DD/MM/YYYY'}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={22} color={dairyTactileColors.outline} />
                  </Pressable>
                </LabeledField>
              ) : null}
            </View>
          ) : null}

          {touched && !parsed.success ? (
            <Text style={styles.errorText}>{parsed.error.issues[0]?.message}</Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: scrollPaddingBottom(amraleSpacing.md) }]}>
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, isPending && styles.disabled]}
          >
            {isPending ? (
              <ActivityIndicator color={dairyTactileColors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={20} color={dairyTactileColors.onPrimary} />
                <Text style={styles.saveText}>{saveLabel}</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={handleCancel} disabled={isPending} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {dobPickerOpen && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={dobCursor}
          mode="date"
          display={Platform.OS === 'android' ? 'default' : 'calendar'}
          onChange={(_event, selected) => {
            setDobPickerOpen(false);
            if (!selected) return;
            applyPickedDate(dateToDob(selected));
          }}
          maximumDate={new Date(2100, 11, 31)}
        />
      ) : null}

      <Portal>
        <Dialog visible={dobPickerOpen && Platform.OS === 'web'} onDismiss={() => setDobPickerOpen(false)} style={styles.dialog}>
          <Dialog.Title>Select Date</Dialog.Title>
          <Dialog.Content>
            {dobPickerStep === 'calendar' ? (
              <Calendar
                current={`${dobCursor.getFullYear()}-${String(dobCursor.getMonth() + 1).padStart(2, '0')}-01`}
                markedDates={(() => {
                  const current = dateTarget
                    ? String(form[dateTarget.field] ?? '')
                    : form.dateOfBirth;
                  const iso = dobToIsoDate(String(current ?? '').trim());
                  return iso ? { [iso]: { selected: true, selectedColor: dairyTactileColors.primaryContainer } } : undefined;
                })()}
                renderHeader={() => (
                  <Pressable onPress={() => setDobPickerStep('year')} style={styles.webCalHeaderPress}>
                    <PaperText variant="titleSmall">
                      {monthLabel(dobCursor.getMonth())} {dobCursor.getFullYear()}
                    </PaperText>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={dairyTactileColors.onSurface} />
                  </Pressable>
                )}
                onMonthChange={(m) => setDobCursor(new Date(m.year, m.month - 1, 1))}
                onDayPress={(day) => {
                  const dob = isoDateToDob(day.dateString);
                  if (dob) applyPickedDate(dob);
                }}
                theme={{
                  todayTextColor: dairyTactileColors.primaryContainer,
                  selectedDayBackgroundColor: dairyTactileColors.primaryContainer,
                  arrowColor: dairyTactileColors.primaryContainer,
                }}
              />
            ) : null}
            {dobPickerStep === 'year' ? (
              <ScrollView style={{ maxHeight: 360 }}>
                {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => new Date().getFullYear() - i).map(
                  (y) => (
                    <Pressable
                      key={y}
                      onPress={() => {
                        setDobCursor((d) => new Date(y, d.getMonth(), 1));
                        setDobPickerStep('month');
                      }}
                      style={styles.pickItem}
                    >
                      <PaperText>{String(y)}</PaperText>
                    </Pressable>
                  ),
                )}
              </ScrollView>
            ) : null}
            {dobPickerStep === 'month' ? (
              <View style={styles.monthGrid}>
                {Array.from({ length: 12 }, (_, i) => i).map((mi) => (
                  <Pressable
                    key={mi}
                    onPress={() => {
                      setDobCursor((d) => new Date(d.getFullYear(), mi, 1));
                      setDobPickerStep('calendar');
                    }}
                    style={[styles.monthCell, dobCursor.getMonth() === mi && styles.monthCellActive]}
                  >
                    <PaperText>{monthLabel(mi)}</PaperText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            {dobPickerStep !== 'calendar' ? (
              <Button onPress={() => setDobPickerStep(dobPickerStep === 'month' ? 'year' : 'calendar')}>Back</Button>
            ) : null}
            <Button onPress={() => setDobPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Modal visible={deliveryBoyOpen} transparent animationType="fade" onRequestClose={() => setDeliveryBoyOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeliveryBoyOpen(false)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Select Delivery Boy</Text>
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
                  <Text style={styles.pickItemTitle}>{b.fullName}</Text>
                  <Text style={styles.pickItemSub}>{b.primaryRouteName}</Text>
                </View>
                {form.assignedDeliveryBoyId === b.id ? (
                  <MaterialCommunityIcons name="check" size={18} color={dairyTactileColors.primaryContainer} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => setDeliveryBoyOpen(false)} style={styles.modalCloseBtn}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  chipLabel,
  chipTone,
  value,
  onValueChange,
  statusSwitch,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  chipLabel: string;
  chipTone: 'blue' | 'green' | 'neutral';
  value: boolean;
  onValueChange: (v: boolean) => void;
  statusSwitch?: boolean;
}) {
  const chipStyle =
    chipTone === 'green' ? styles.chipGreen : chipTone === 'blue' ? styles.chipBlue : styles.chipNeutral;

  return (
    <View style={styles.toggleRow}>
      <MaterialCommunityIcons name={icon} size={22} color={dairyTactileColors.primaryContainer} />
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.chip, chipStyle]}>
        <Text style={[styles.chipText, chipTone === 'green' && styles.chipTextGreen]}>{chipLabel}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: dairyTactileColors.outlineVariant,
          true: statusSwitch ? '#22C55E' : dairyTactileColors.primaryContainer,
        }}
        thumbColor={dairyTactileColors.surfaceContainerLowest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dairyTactileColors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: dairyTactileColors.outlineVariant,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    color: dairyTactileColors.primaryContainer,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: amraleSpacing.md,
    marginTop: amraleSpacing.sm,
    marginBottom: amraleSpacing.sm,
    padding: 4,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: amraleRadius.md,
  },
  tabActive: {
    backgroundColor: dairyTactileColors.primaryContainer,
    ...primaryButtonElevation(),
  },
  tabText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: dairyTactileColors.onSurfaceVariant,
  },
  tabTextActive: {
    color: dairyTactileColors.onPrimary,
  },
  scroll: {
    paddingHorizontal: amraleSpacing.md,
    gap: amraleSpacing.md,
  },
  card: {
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderRadius: amraleRadius.lg,
    padding: amraleSpacing.md,
    gap: amraleSpacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 85, 199, 0.06)',
    ...tactileCardElevation(),
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardHeadingText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 12,
    letterSpacing: 1,
    color: dairyTactileColors.primaryContainer,
    textTransform: 'uppercase',
  },
  fieldBlock: { gap: 6 },
  label: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: dairyTactileColors.onSurfaceVariant,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: amraleRadius.sm,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: dairyTactileColors.onSurface,
  },
  inputRow: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: amraleRadius.sm,
    backgroundColor: dairyTactileColors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
  },
  inputValue: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 15,
    color: dairyTactileColors.onSurface,
  },
  placeholder: { color: dairyTactileColors.outline },
  inputDisabled: { opacity: 0.85 },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 6,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: dairyTactileColors.onSurface,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: amraleRadius.pill,
    borderWidth: 1,
  },
  chipBlue: {
    backgroundColor: dairyTactileColors.surfaceTintBlue,
    borderColor: 'rgba(0, 85, 199, 0.2)',
  },
  chipGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  chipNeutral: {
    backgroundColor: dairyTactileColors.secondaryContainer,
    borderColor: dairyTactileColors.outlineVariant,
  },
  chipText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: dairyTactileColors.primaryContainer,
  },
  chipTextGreen: { color: '#16A34A' },
  hint: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: dairyTactileColors.onSurfaceVariant,
    paddingHorizontal: 4,
  },
  footer: {
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.md,
    gap: amraleSpacing.sm,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: amraleRadius.lg,
    backgroundColor: dairyTactileColors.primaryContainer,
    ...primaryButtonElevation(),
  },
  saveText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 15,
    letterSpacing: 0.6,
    color: dairyTactileColors.onPrimary,
    textTransform: 'uppercase',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    color: dairyTactileColors.primaryContainer,
  },
  errorText: {
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    color: dairyTactileColors.error,
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  dialog: { backgroundColor: dairyTactileColors.surfaceContainerLowest },
  webCalHeaderPress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: {
    width: '30%',
    minWidth: 92,
    height: 44,
    borderRadius: amraleRadius.md,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellActive: {
    borderColor: dairyTactileColors.primaryContainer,
    backgroundColor: dairyTactileColors.surfaceTintBlue,
  },
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 29, 45, 0.45)',
  },
  modalSheet: {
    marginHorizontal: amraleSpacing.md,
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
  modalCloseBtn: { alignItems: 'center', marginTop: amraleSpacing.sm },
});
