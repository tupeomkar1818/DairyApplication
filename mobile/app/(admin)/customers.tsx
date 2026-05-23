import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';

import { buildSubscriptionPayloadFromPlans, type AdminProductLite } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import {
  dateToDob,
  dobToDate,
  dobToIsoDate,
  endOfMonthDdMmYyyy,
  fmtDdMmYyyy,
  isoDateToDob,
} from '@/src/components/admin/customerFormDates';
import type { CustomerSubscriptionItemDto, CustomerSubscriptionPlanDto, CustomerResponse } from '@/src/domain/customers/dtos';
import { CreateCustomerRequestSchema } from '@/src/domain/customers/validations';
import { CustomerListSection } from '@/src/components/admin/CustomerListSection';
import { DeleteCustomerConfirmDialog } from '@/src/components/admin/DeleteCustomerConfirmDialog';
import { ScreenHeader } from '@/src/components/shared';
import { useCreateCustomer, useCustomers, useDeleteCustomer, useUpdateCustomer } from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors } from '@/src/theme/dairyTactile';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

const DELIVERY_TIME_OPTIONS = ['Morning', 'Evening', 'Both'] as const;
const SUB_FREQUENCY_OPTIONS = [
  'Daily',
  'Alternate Day',
  'Weekly',
  'Specific Days',
  'Weekend Only',
  'Morning Only',
  'Evening Only',
  'Morning and Evening',
] as const;
const SUB_STATUS_OPTIONS = ['Active', 'Paused', 'Expired', 'Cancelled', 'Inactive'] as const;
const BILLING_TYPE_OPTIONS = ['Postpaid', 'Prepaid'] as const;
const PAYMENT_MODE_OPTIONS = ['Cash', 'UPI', 'Bank', 'Other'] as const;

type FormState = {
  name: string;
  mobile: string;
  dateOfBirth: string;
  alternateMobile: string;
  appAccessEnabled: boolean;

  houseFlatNumber: string;
  societyName: string;
  streetArea: string;
  landmark: string;
  city: string;
  pincode: string;
  routeName: string;
  assignedDeliveryBoyId: string;
  assignedDeliveryBoyName: string;
  address: string;

  subscriptionStartDate: string;
  subscriptionEndDate: string;
  deliveryTime: (typeof DELIVERY_TIME_OPTIONS)[number];
  subscriptionFrequency: (typeof SUB_FREQUENCY_OPTIONS)[number];
  subscriptionStatus: (typeof SUB_STATUS_OPTIONS)[number];
  preferredDeliveryNotes: string;

  subscriptionPlans: CustomerSubscriptionPlanDto[];

  billingType: (typeof BILLING_TYPE_OPTIONS)[number];
  billingDate: string; // DD/MM/YYYY (only for Postpaid)
  billingCycleDate: string; // derived day-of-month for storage
  advanceBalance: string;
  securityDeposit: string;
  pendingAmount: string;
  discountAmount: string;
  taxPercentage: string;
  lastPaymentDate: string;
  nextDueDate: string;
  preferredPaymentMode: (typeof PAYMENT_MODE_OPTIONS)[number];

  complaintNotes: string;
  internalAdminNotes: string;
  specialDeliveryInstructions: string;

  status: 'Active' | 'Inactive';
};

/** Same shape as a newly added plan in edit mode: pick product/quantity from admin catalog, dates as DD/MM/YYYY. */
function createEmptySubscriptionPlan(
  deliveryTime: FormState['deliveryTime'],
  subscriptionFrequency: FormState['subscriptionFrequency'],
): CustomerSubscriptionPlanDto {
  const startDate = fmtDdMmYyyy(new Date());
  return {
    productName: '',
    numberOfItems: 1,
    quantityLabel: '',
    unitType: undefined,
    subscriptionKind: 'Monthly',
    productAdditionTag: 'Regular',
    deliveryTime,
    frequency: subscriptionFrequency,
    startDate,
    endDate: endOfMonthDdMmYyyy(startDate) ?? undefined,
    deliveryDate: undefined,
    pauseStartDate: undefined,
    pauseEndDate: undefined,
    resumeDate: undefined,
    pauseReason: undefined,
    pauseStatus: undefined,
    notes: undefined,
    paymentStatus: undefined,
    dailyCost: undefined,
    addedDate: undefined,
    status: 'Active',
    originalPrice: 0,
    discountedPrice: 0,
    effectiveFinalPrice: 0,
  };
}

function emptyForm(): FormState {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endOfMonth = fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), lastDayOfMonth));
  const defaultPlanStart = fmtDdMmYyyy(now);
  return {
    name: '',
    mobile: '',
    dateOfBirth: '',
    alternateMobile: '',
    appAccessEnabled: true,

    houseFlatNumber: '',
    address: '',
    societyName: '',
    streetArea: '',
    landmark: '',
    city: '',
    pincode: '',
    routeName: '',
    assignedDeliveryBoyId: '',
    assignedDeliveryBoyName: '',

    subscriptionStartDate: '',
    subscriptionEndDate: '',
    deliveryTime: 'Morning',
    subscriptionFrequency: 'Daily',
    subscriptionStatus: 'Active',
    preferredDeliveryNotes: '',

    subscriptionPlans: [
      {
        productName: 'Cow Milk',
        numberOfItems: 1,
        quantityLabel: '500 ml',
        unitType: 'ml',
        subscriptionKind: 'Monthly',
        productAdditionTag: 'Regular',
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: defaultPlanStart,
        endDate: endOfMonthDdMmYyyy(defaultPlanStart) ?? undefined,
        deliveryDate: undefined,
        pauseStartDate: undefined,
        pauseEndDate: undefined,
        resumeDate: undefined,
        originalPrice: 32,
        discountedPrice: 0,
        effectiveFinalPrice: 32,
        status: 'Active',
      },
    ],

    billingType: 'Postpaid',
    billingDate: endOfMonth,
    billingCycleDate: String(lastDayOfMonth),
    advanceBalance: '0',
    securityDeposit: '0',
    pendingAmount: '0',
    discountAmount: '0',
    taxPercentage: '0',
    lastPaymentDate: '',
    nextDueDate: '',
    preferredPaymentMode: 'UPI',

    complaintNotes: '',
    internalAdminNotes: '',
    specialDeliveryInstructions: '',

    status: 'Active',
  };
}

function validateCustomerForm(form: FormState, adminProducts: AdminProductLite[]) {
  const built = buildSubscriptionPayloadFromPlans(form.subscriptionPlans ?? [], adminProducts);
  return CreateCustomerRequestSchema.safeParse({
    ...form,
    dateOfBirth: form.dateOfBirth.trim() ? form.dateOfBirth.trim() : undefined,
    alternateMobile: form.alternateMobile.trim() ? form.alternateMobile.trim() : undefined,
    appAccessEnabled: form.appAccessEnabled,
    status: form.appAccessEnabled ? 'Active' : 'Inactive',

    houseFlatNumber: form.houseFlatNumber.trim() ? form.houseFlatNumber.trim() : undefined,
    streetArea: form.streetArea.trim() ? form.streetArea.trim() : undefined,
    landmark: undefined,
    city: form.city.trim() ? form.city.trim() : undefined,
    pincode: form.pincode.trim() ? form.pincode.trim() : undefined,
    routeName: form.routeName.trim() ? form.routeName.trim() : undefined,
    assignedDeliveryBoyId: form.assignedDeliveryBoyId.trim() ? form.assignedDeliveryBoyId.trim() : undefined,
    assignedDeliveryBoyName: form.assignedDeliveryBoyName.trim() ? form.assignedDeliveryBoyName.trim() : undefined,

    subscriptionStartDate: form.subscriptionStartDate.trim() ? dobToIsoDate(form.subscriptionStartDate.trim()) ?? form.subscriptionStartDate.trim() : undefined,
    subscriptionEndDate: form.subscriptionEndDate.trim() ? dobToIsoDate(form.subscriptionEndDate.trim()) ?? form.subscriptionEndDate.trim() : undefined,
    subscriptionStatus: form.subscriptionStatus,
    subscriptionFrequency: form.subscriptionFrequency,
    preferredDeliveryNotes: form.preferredDeliveryNotes.trim() ? form.preferredDeliveryNotes.trim() : undefined,

    deliveryTime: form.deliveryTime,
    paymentType: 'Monthly',

    billingType: form.billingType,
    billingCycleDate:
      form.billingType === 'Postpaid'
        ? (() => {
            const ddmmyyyy = form.billingDate.trim();
            if (!ddmmyyyy) return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!m) return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            const day = Number(m[1]);
            if (!Number.isFinite(day) || day < 1 || day > 31) return form.billingCycleDate.trim() ? Number(form.billingCycleDate) : undefined;
            return day;
          })()
        : undefined,
    advanceBalance: form.advanceBalance.trim() ? Number(form.advanceBalance) : undefined,
    securityDeposit: form.securityDeposit.trim() ? Number(form.securityDeposit) : undefined,
    pendingAmount: form.pendingAmount.trim() ? Number(form.pendingAmount) : undefined,
    discountAmount: form.discountAmount.trim() ? Number(form.discountAmount) : undefined,
    taxPercentage: form.taxPercentage.trim() ? Number(form.taxPercentage) : undefined,
    lastPaymentDate: form.lastPaymentDate.trim() ? dobToIsoDate(form.lastPaymentDate.trim()) ?? form.lastPaymentDate.trim() : undefined,
    nextDueDate: form.nextDueDate.trim() ? dobToIsoDate(form.nextDueDate.trim()) ?? form.nextDueDate.trim() : undefined,
    preferredPaymentMode: form.preferredPaymentMode,

    complaintNotes: form.complaintNotes.trim() ? form.complaintNotes.trim() : undefined,
    internalAdminNotes: form.internalAdminNotes.trim() ? form.internalAdminNotes.trim() : undefined,
    specialDeliveryInstructions: form.specialDeliveryInstructions.trim() ? form.specialDeliveryInstructions.trim() : undefined,

    subscription: built.subscription as CustomerSubscriptionItemDto[],
    subscriptionPlans: built.subscriptionPlans as CustomerSubscriptionPlanDto[],
  });
}

function FormTabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.formTabPillBase, active ? styles.formTabPillActive : styles.formTabPillInactive, pressed && styles.pressed]}>
      <Text variant="labelLarge" style={active ? styles.formTabTextActive : styles.formTabTextInactive} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function FormRow({ isDesktop, children }: { isDesktop: boolean; children: React.ReactNode }) {
  return <View style={isDesktop ? styles.formRowDesktop : styles.formRowStack}>{children}</View>;
}

export default function AdminCustomersScreen() {
  const scheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ editId?: string }>();

  const customers = useCustomers();
  const products = useProducts();
  const deliveryBoys = useDeliveryBoys();
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const del = useDeleteCustomer();
  const { headerPaddingTop, bottom } = useScreenSafeInsets();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerResponse | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<CustomerResponse | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formTab, setFormTab] = useState<'basic' | 'address' | 'billing'>('basic');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobPickerStep, setDobPickerStep] = useState<'calendar' | 'year' | 'month'>('calendar');
  const [dobCursor, setDobCursor] = useState(() => new Date());
  const [dateTarget, setDateTarget] = useState<{ kind: 'field'; field: keyof FormState } | null>(null);

  const [picker, setPicker] = useState<{ kind: 'deliveryBoy' } | null>(null);

  function closeTopmostOverlay(): boolean {
    if (dobPickerOpen) {
      setDobPickerOpen(false);
      setDateTarget(null);
      return true;
    }

    if (picker) {
      setPicker(null);
      return true;
    }

    if (confirmOpen) {
      setConfirmOpen(false);
      setDeleteTarget(null);
      return true;
    }

    if (dialogOpen) {
      setDialogOpen(false);
      setTouched(false);
      setError(null);
      setEditing(null);
      setMode('create');
      setDobPickerOpen(false);
      setPicker(null);
      setDateTarget(null);
      setDobPickerStep('calendar');
      setForm(emptyForm());
      return true;
    }

    return false;
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      return closeTopmostOverlay();
    });
    return () => sub.remove();
  }, [confirmOpen, dialogOpen, dobPickerOpen, picker]);

  const isDesktopBp = width >= 1024;
  const isTabletBp = width >= 640 && width < 1024;
  const isMobileBp = width < 640;
  // Keep the whole dialog within viewport so header/footer never go off-screen.
  // Important: never exceed viewport height, especially on resize.
  const dialogMaxHeight = Math.max(320, Math.min(Math.round(height * 0.92), height - 16));
  const dialogW = isDesktopBp ? Math.min(Math.round(width * 0.9), 960) : isTabletBp ? Math.round(width * 0.9) : Math.max(320, width - 16);
  const inputDense = isMobileBp;
  const scrollBottomPad = isMobileBp ? 120 : 48;
  const headerApprox = 54 + 52; // title + tabs
  const footerApprox = 64; // actions
  const scrollAreaMaxHeight = Math.max(240, dialogMaxHeight - headerApprox - footerApprox);

  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    // In this app, Products are managed by Admin, so we show active products here.
    return items.filter((p) => p.isActive);
  }, [products.data?.items]);

  const autoAddress = useMemo(() => {
    const parts = [form.houseFlatNumber, form.societyName, form.streetArea, form.city, form.pincode]
      .map((x) => (x ?? '').trim())
      .filter(Boolean);
    return parts.join(', ');
  }, [form.houseFlatNumber, form.societyName, form.streetArea, form.city, form.pincode]);

  useEffect(() => {
    // Keep full address in sync with structured fields.
    setForm((s) => (s.address === autoAddress ? s : { ...s, address: autoAddress }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAddress]);

  useEffect(() => {
    const editId = (params.editId ?? '').trim();
    if (!editId) return;
    const items = customers.data?.items ?? [];
    const target = items.find((x) => x.id === editId);
    if (!target) return;
    openEdit(target);
    // Clear param so it doesn't reopen on rerender/navigation.
    router.setParams({ editId: undefined as unknown as string });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.data?.items, params.editId]);

  function openCreate() {
    setMode('create');
    setEditing(null);
    setForm(emptyForm());
    setFormTab('basic');
    setTouched(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(c: CustomerResponse) {
    setMode('edit');
    setEditing(c);
    setFormTab('basic');
    const toDob = (value: string | undefined | null) => {
      const v = (value ?? '').trim();
      if (!v) return '';
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
      return isoDateToDob(v) ?? '';
    };

    setForm({
      name: c.name,
      mobile: c.mobile,
      dateOfBirth: c.dateOfBirth ?? '',
      alternateMobile: c.alternateMobile ?? '',
      // App access is controlled by Active/Inactive customer status.
      appAccessEnabled: c.status === 'Active',

      houseFlatNumber: c.houseFlatNumber ?? '',
      societyName: c.societyName ?? '',
      streetArea: c.streetArea ?? '',
      landmark: c.landmark ?? '',
      city: c.city ?? '',
      pincode: c.pincode ?? '',
      routeName: c.routeName ?? '',
      assignedDeliveryBoyId: (c as any).assignedDeliveryBoyId ?? '',
      assignedDeliveryBoyName: c.assignedDeliveryBoyName ?? '',
      address: c.address ?? '',

      subscriptionStartDate: toDob(c.subscriptionStartDate),
      subscriptionEndDate: toDob(c.subscriptionEndDate),
      deliveryTime: c.deliveryTime ?? 'Morning',
      subscriptionFrequency: 'Daily',
      subscriptionStatus: c.subscriptionStatus ?? 'Active',
      preferredDeliveryNotes: c.preferredDeliveryNotes ?? '',

      subscriptionPlans: (c.subscriptionPlans ?? []).map((p) => ({
        productName: p.productName,
        numberOfItems: (p as any).numberOfItems ?? 1,
        quantityLabel: p.quantityLabel,
        unitType: p.unitType,
        subscriptionKind: p.subscriptionKind ?? 'Monthly',
        deliveryDate: p.deliveryDate ? toDob(p.deliveryDate) : undefined,
        deliveryTime: p.deliveryTime,
        frequency: p.frequency,
        startDate: toDob(p.startDate),
        endDate: (() => {
          const sd = toDob(p.startDate);
          if (sd && /^\d{2}\/\d{2}\/\d{4}$/.test(sd)) {
            const eom = endOfMonthDdMmYyyy(sd);
            if (eom) return eom;
          }
          return p.endDate ? toDob(p.endDate) : undefined;
        })(),
        pauseStartDate: p.pauseStartDate ? toDob(p.pauseStartDate) : undefined,
        pauseEndDate: p.pauseEndDate ? toDob(p.pauseEndDate) : undefined,
        resumeDate: p.resumeDate ? toDob(p.resumeDate) : undefined,
        pauseReason: p.pauseReason,
        pauseStatus: p.pauseStatus,
        productAdditionTag: p.productAdditionTag ?? 'Regular',
        notes: p.notes,
        originalPrice: p.originalPrice,
        discountedPrice: p.discountedPrice,
        effectiveFinalPrice: p.effectiveFinalPrice,
        paymentStatus: p.paymentStatus,
        dailyCost: p.dailyCost,
        addedDate: p.addedDate ? toDob(p.addedDate) : undefined,
        status: p.status,
      })) as unknown as CustomerSubscriptionPlanDto[],

      billingType: (c.billingType as any) ?? 'Postpaid',
      billingDate: (() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const day = Math.min(lastDay, Math.max(1, Number(c.billingCycleDate ?? lastDay)));
        return fmtDdMmYyyy(new Date(now.getFullYear(), now.getMonth(), day));
      })(),
      billingCycleDate: String(c.billingCycleDate ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()),
      advanceBalance: String(c.advanceBalance ?? 0),
      securityDeposit: String(c.securityDeposit ?? 0),
      pendingAmount: String(c.pendingAmount ?? 0),
      discountAmount: String(c.discountAmount ?? 0),
      taxPercentage: String(c.taxPercentage ?? 0),
      lastPaymentDate: toDob(c.lastPaymentDate),
      nextDueDate: toDob(c.nextDueDate),
      preferredPaymentMode: (c.preferredPaymentMode as any) ?? 'UPI',

      complaintNotes: c.complaintNotes ?? '',
      internalAdminNotes: c.internalAdminNotes ?? '',
      specialDeliveryInstructions: c.specialDeliveryInstructions ?? '',
      status: c.status,
    });
    setTouched(false);
    setError(null);
    setDialogOpen(true);
  }

  // Keep the customer form's heavy Zod validation off the keystroke path.
  // useDeferredValue lets React process input updates at high priority and
  // runs the safeParse pass only when the main thread is idle.
  const deferredForm = useDeferredValue(form);
  const deferredAdminProducts = useDeferredValue(adminProducts);

  const parsed = useMemo(
    () => validateCustomerForm(deferredForm, deferredAdminProducts),
    [deferredAdminProducts, deferredForm],
  );

  function openDatePickerForField(field: keyof FormState) {
    setDateTarget({ kind: 'field', field });
    const v = String((form as any)[field] ?? '').trim();
    const asDate = dobToDate(v) ?? (isoDateToDob(v) ? dobToDate(isoDateToDob(v) as string) : null);
    setDobCursor(asDate ?? new Date());
    setDobPickerStep('calendar');
    setDobPickerOpen(true);
  }

  function clampDobCursorFromForm() {
    const fromForm = dobToDate(form.dateOfBirth);
    if (fromForm) {
      setDobCursor(fromForm);
      return;
    }
    setDobCursor(new Date(1995, 0, 1));
  }

  function monthLabel(monthIndex0: number) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex0] ?? '';
  }

  async function onSave() {
    setTouched(true);
    setError(null);
    // Validate the current form synchronously — `parsed` is based on a deferred
    // form for render performance, so it may lag the last keystroke by a tick.
    const current = validateCustomerForm(form, adminProducts);
    if (!current.success) {
      setError(current.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    try {
      if (mode === 'create') {
        const created = await create.mutateAsync(current.data);
        setDialogOpen(false);
        router.replace({ pathname: '/(admin)/customers-detail', params: { id: created.id } });
      } else if (editing) {
        const updated = await update.mutateAsync({ id: editing.id, data: current.data });
        setDialogOpen(false);
        router.replace({ pathname: '/(admin)/customers-detail', params: { id: updated.id } });
      }
    } catch {
      setError('Unable to save customer. Please try again.');
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync({ id: deleteTarget.id });
      setConfirmOpen(false);
      setDeleteTarget(null);
      setDialogOpen(false);
      setEditing(null);
    } catch {
      // keep open
    }
  }

  function onCancelDialog() {
    setDialogOpen(false);
    setConfirmOpen(false);
    setDeleteTarget(null);
    setDobPickerOpen(false);
    setPicker(null);
    setDateTarget(null);
    setTouched(false);
    setError(null);

    if (mode === 'edit' && editing) {
      router.replace({ pathname: '/(admin)/customers-detail', params: { id: editing.id } });
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Customers"
        onBack={() => {
          if (closeTopmostOverlay()) return;
          router.back();
        }}
        paddingTop={headerPaddingTop}
      />

      <CustomerListSection bottomInset={bottom} onAddCustomer={openCreate} onEditCustomer={openEdit} />

      <Portal>
        {/** dialogs below */}

        <Dialog
          visible={dialogOpen}
          onDismiss={onCancelDialog}
          style={[
            scheme === 'dark' ? styles.dialogDark : styles.dialogLight,
            { alignSelf: 'center', width: dialogW, maxWidth: dialogW, maxHeight: dialogMaxHeight, overflow: 'hidden' },
          ]}
        >
          <Dialog.Title>{mode === 'create' ? 'Add Customer' : 'Update Customer'}</Dialog.Title>
          <View style={[styles.formTabsBar, scheme === 'dark' ? styles.formTabsBarDark : styles.formTabsBarLight]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formTabsRow}>
              <FormTabPill label="Basic" active={formTab === 'basic'} onPress={() => setFormTab('basic')} />
              <FormTabPill label="Address" active={formTab === 'address'} onPress={() => setFormTab('address')} />
              <FormTabPill label="Billing" active={formTab === 'billing'} onPress={() => setFormTab('billing')} />
            </ScrollView>
          </View>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0, maxHeight: scrollAreaMaxHeight }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: isMobileBp ? 12 : 16, paddingBottom: scrollBottomPad }} keyboardShouldPersistTaps="handled">
              <View style={styles.formGrid}>
                {formTab === 'basic' ? (
                  <>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                      Basic Information
                    </Text>
                    <FormRow isDesktop={isDesktopBp}>
                      <TextInput dense={inputDense} mode="outlined" label="Customer Full Name" value={form.name} onChangeText={(t) => setForm((s) => ({ ...s, name: t }))} style={styles.formCol} />
                      <TextInput dense={inputDense} mode="outlined" label="Mobile Number" keyboardType="number-pad" value={form.mobile} onChangeText={(t) => setForm((s) => ({ ...s, mobile: t.replace(/[^\d]/g, '').slice(0, 10) }))} style={styles.formCol} />
                    </FormRow>
                    <FormRow isDesktop={isDesktopBp}>
                      <TextInput
                        dense={inputDense}
                        mode="outlined"
                        label="Alternate Mobile Number"
                        keyboardType="number-pad"
                        value={form.alternateMobile}
                        onChangeText={(t) => setForm((s) => ({ ...s, alternateMobile: t.replace(/[^\d]/g, '').slice(0, 10) }))}
                        style={styles.formCol}
                      />
                      <TextInput
                        dense={inputDense}
                        mode="outlined"
                        label="Date of Birth"
                        placeholder="DD/MM/YYYY"
                        value={form.dateOfBirth}
                        onChangeText={(t) => setForm((s) => ({ ...s, dateOfBirth: t }))}
                        right={
                          <TextInput.Icon
                            icon="calendar"
                            onPress={() => {
                              setDateTarget(null);
                              clampDobCursorFromForm();
                              setDobPickerStep('calendar');
                              setDobPickerOpen(true);
                            }}
                            forceTextInputFocus={false}
                          />
                        }
                        style={styles.formCol}
                      />
                    </FormRow>

                    <Pressable
                      onPress={() =>
                        setForm((s) => {
                          const next = !s.appAccessEnabled;
                          return { ...s, appAccessEnabled: next, status: next ? 'Active' : 'Inactive' };
                        })
                      }
                      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
                    >
                      <Text variant="bodyMedium">App Access</Text>
                      <Text variant="labelLarge" style={{ color: form.appAccessEnabled ? COLORS.accent : 'rgba(148,163,184,0.95)', fontWeight: '900' }}>
                        {form.appAccessEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </Pressable>

                    <View style={styles.readonlyStatusRow}>
                      <Text variant="labelLarge" style={styles.pickerLabel}>
                        Status
                      </Text>
                      <View style={[styles.statusPill, form.status === 'Active' ? styles.statusPillActive : styles.statusPillInactive]}>
                        <Text variant="labelSmall" style={styles.statusPillText}>
                          {form.status}
                        </Text>
                      </View>
                    </View>

                    <HelperText type="info" visible>
                      Active customers can order products. Inactive customers are blocked from ordering until their bill is paid.
                    </HelperText>
                    <HelperText type="info" visible style={{ marginTop: 4 }}>
                      {`Subscription products and delivery plans are managed from the customer's Subscription tab after you save (open the customer from the list).`}
                    </HelperText>
                  </>
                ) : null}

                {formTab === 'address' ? (
                  <>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                      Address Information
                    </Text>
                    <FormRow isDesktop={isDesktopBp}>
                      <TextInput dense={inputDense} mode="outlined" label="House / Flat Number" value={form.houseFlatNumber} onChangeText={(t) => setForm((s) => ({ ...s, houseFlatNumber: t }))} style={styles.formCol} />
                      <TextInput dense={inputDense} mode="outlined" label="Building / Society Name" value={form.societyName} onChangeText={(t) => setForm((s) => ({ ...s, societyName: t }))} style={styles.formCol} />
                    </FormRow>
                    <FormRow isDesktop={isDesktopBp}>
                      <TextInput dense={inputDense} mode="outlined" label="Street / Area" value={form.streetArea} onChangeText={(t) => setForm((s) => ({ ...s, streetArea: t }))} style={styles.formCol} />
                      {isDesktopBp ? <View style={styles.formCol} /> : null}
                    </FormRow>
                    <FormRow isDesktop={isDesktopBp}>
                      <TextInput dense={inputDense} mode="outlined" label="City" value={form.city} onChangeText={(t) => setForm((s) => ({ ...s, city: t }))} style={styles.formCol} />
                      <TextInput dense={inputDense} mode="outlined" label="Pincode" keyboardType="number-pad" value={form.pincode} onChangeText={(t) => setForm((s) => ({ ...s, pincode: t.replace(/[^\d]/g, '').slice(0, 6) }))} style={styles.formCol} />
                    </FormRow>
                    <FormRow isDesktop={isDesktopBp}>
                      <Pressable onPress={() => setPicker({ kind: 'deliveryBoy' })} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed, styles.formCol]}>
                        <Text variant="labelLarge" style={styles.pickerLabel}>
                          Assigned Delivery Boy
                        </Text>
                        <Text variant="bodyMedium">{form.assignedDeliveryBoyName || 'Select'}</Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
                      </Pressable>
                      <TextInput dense={inputDense} mode="outlined" label="Delivery Route" value={form.routeName} editable={false} style={styles.formCol} />
                    </FormRow>
                    <TextInput dense={inputDense} mode="outlined" label="Full Address" value={form.address} editable={false} multiline />
                  </>
                ) : null}

                {formTab === 'billing' ? (
                  <>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                      Billing Information
                    </Text>
                    <Pressable onPress={() => setForm((s) => ({ ...s, billingType: s.billingType === 'Postpaid' ? 'Prepaid' : 'Postpaid' }))} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}>
                      <Text variant="labelLarge" style={styles.pickerLabel}>
                        Billing Type
                      </Text>
                      <View style={[styles.statusPill, form.billingType === 'Postpaid' ? styles.statusPillActive : styles.statusPillInactive]}>
                        <Text variant="labelSmall" style={styles.statusPillText}>
                          {form.billingType}
                        </Text>
                      </View>
                    </Pressable>

                    {form.billingType === 'Postpaid' ? (
                      <TextInput
                        dense={inputDense}
                        mode="outlined"
                        label="Billing Date"
                        placeholder="DD/MM/YYYY"
                        value={form.billingDate}
                        onChangeText={(t) => setForm((s) => ({ ...s, billingDate: t }))}
                        right={<TextInput.Icon icon="calendar" onPress={() => openDatePickerForField('billingDate')} forceTextInputFocus={false} />}
                      />
                    ) : null}
                  </>
                ) : null}

                <HelperText type="error" visible={!!(touched && !parsed.success)}>
                  {touched && !parsed.success ? parsed.error.issues[0]?.message : ' '}
                </HelperText>
                <HelperText type="error" visible={!!error}>
                  {error ?? ' '}
                </HelperText>
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <View style={styles.actionsBar}>
              {mode === 'edit' && editing ? (
                <Button
                  onPress={() => {
                    setDeleteTarget(editing);
                    setConfirmOpen(true);
                  }}
                  disabled={del.isPending || update.isPending}
                  textColor="#B91C1C"
                  style={styles.actionsLeft}
                >
                  Delete
                </Button>
              ) : (
                <View style={styles.actionsLeft} />
              )}

              <View style={styles.actionsRight}>
                <Button
                  mode={dialogW < 420 ? 'outlined' : 'text'}
                  onPress={onCancelDialog}
                  disabled={create.isPending || update.isPending}
                  style={dialogW < 420 ? styles.actionBtnFull : undefined}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  buttonColor={COLORS.primary}
                  onPress={onSave}
                  loading={create.isPending || update.isPending}
                  disabled={create.isPending || update.isPending}
                  style={dialogW < 420 ? styles.actionBtnFull : undefined}
                >
                  Save
                </Button>
              </View>
            </View>
          </Dialog.Actions>
        </Dialog>

        {dobPickerOpen && Platform.OS !== 'web' ? (
          <DateTimePicker
            value={dobCursor}
            mode="date"
            display={Platform.OS === 'android' ? 'default' : 'calendar'}
            onChange={(_event, selected) => {
              setDobPickerOpen(false);
              if (!selected) return;
              const ddmmyyyy = dateToDob(selected);
              if (!dateTarget) {
                setForm((s) => ({ ...s, dateOfBirth: ddmmyyyy }));
              } else {
                setForm((s) => ({ ...s, [dateTarget.field]: ddmmyyyy } as FormState));
              }
              setDateTarget(null);
            }}
            maximumDate={new Date(2100, 11, 31)}
          />
        ) : null}

        <Dialog visible={dobPickerOpen && Platform.OS === 'web'} onDismiss={() => setDobPickerOpen(false)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>{dobPickerStep === 'calendar' ? 'Select Date' : dobPickerStep === 'year' ? 'Select Year' : 'Select Month'}</Dialog.Title>
          <Dialog.Content>
            {dobPickerStep === 'calendar' ? (
              <Calendar
                current={`${dobCursor.getFullYear()}-${String(dobCursor.getMonth() + 1).padStart(2, '0')}-01`}
                markedDates={
                  (() => {
                    const current =
                      dateTarget?.kind === 'field'
                        ? String((form as unknown as Record<string, unknown>)[dateTarget.field] ?? '')
                        : form.dateOfBirth;
                    const iso = dobToIsoDate(String(current ?? '').trim());
                    return iso ? { [iso]: { selected: true, selectedColor: COLORS.primary } } : undefined;
                  })()
                }
                renderHeader={() => (
                  <Pressable
                    onPress={() => setDobPickerStep('year')}
                    style={({ pressed }) => [styles.webCalHeaderPress, pressed && styles.pressed]}
                  >
                    <Text variant="titleSmall" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                      {monthLabel(dobCursor.getMonth())} {dobCursor.getFullYear()}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                )}
                onMonthChange={(m) => {
                  // Keep cursor in sync when user uses arrows.
                  setDobCursor(new Date(m.year, m.month - 1, 1));
                }}
                onDayPress={(day) => {
                  const dob = isoDateToDob(day.dateString);
                  if (!dob) return;
                  if (!dateTarget) {
                    setForm((s) => ({ ...s, dateOfBirth: dob }));
                  } else {
                    setForm((s) => ({ ...s, [dateTarget.field]: dob } as FormState));
                  }
                  setDateTarget(null);
                  setDobPickerOpen(false);
                }}
                theme={{
                  todayTextColor: COLORS.primary,
                  selectedDayBackgroundColor: COLORS.primary,
                  arrowColor: COLORS.primary,
                }}
              />
            ) : null}

            {dobPickerStep === 'year' ? (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 6 }}>
                {Array.from({ length: new Date().getFullYear() - 1950 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => {
                      setDobCursor((d) => new Date(y, d.getMonth(), 1));
                      setDobPickerStep('month');
                    }}
                    style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                  >
                    <Text variant="bodyMedium">{String(y)}</Text>
                    {dobCursor.getFullYear() === y ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                  </Pressable>
                ))}
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
                    style={({ pressed }) => [
                      styles.monthCell,
                      (dobCursor.getMonth() === mi) && styles.monthCellActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text variant="labelLarge" style={(dobCursor.getMonth() === mi) ? styles.monthCellActiveText : undefined}>
                      {monthLabel(mi)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            {dobPickerStep !== 'calendar' ? (
              <Button
                onPress={() => {
                  setDobPickerStep(dobPickerStep === 'month' ? 'year' : 'calendar');
                }}
              >
                Back
              </Button>
            ) : null}
            <Button onPress={() => setDobPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <DeleteCustomerConfirmDialog
          visible={confirmOpen && !!deleteTarget}
          customerName={deleteTarget?.name ?? ''}
          loading={del.isPending}
          onDismiss={() => {
            if (del.isPending) return;
            setConfirmOpen(false);
            setDeleteTarget(null);
          }}
          onConfirm={onConfirmDelete}
        />

        {/* Status selection removed. Status is synced with App Access. */}
        <Dialog visible={!!picker} onDismiss={() => setPicker(null)} style={scheme === 'dark' ? styles.dialogDark : styles.dialogLight}>
          <Dialog.Title>Select Delivery Boy</Dialog.Title>
          <Dialog.Content>
            {picker?.kind === 'deliveryBoy'
              ? (deliveryBoys.data?.items ?? []).map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setForm((s) => ({ ...s, assignedDeliveryBoyId: b.id, assignedDeliveryBoyName: b.fullName, routeName: b.primaryRouteName }));
                      setPicker(null);
                    }}
                    style={({ pressed }) => [styles.pickItem, pressed && styles.pressed]}
                  >
                    <View style={{ gap: 2 }}>
                      <Text variant="bodyMedium" style={{ fontWeight: '900' }}>
                        {b.fullName}
                      </Text>
                      <Text variant="bodySmall" style={textSub}>
                        {b.primaryRouteName}
                      </Text>
                    </View>
                    {form.assignedDeliveryBoyId === b.id ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                  </Pressable>
                ))
              : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPicker(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: amraleColors.surface,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  formGrid: { gap: 10, paddingTop: 8 },
  formRowDesktop: { flexDirection: 'row', gap: 10 },
  formRowStack: { flexDirection: 'column', gap: 10 },
  // minWidth: 0 is important so inputs can shrink without overflow in flex rows.
  formCol: { flex: 1, minWidth: 0 },
  sectionTitle: { fontWeight: '900', marginTop: 6 },
  formTabsBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  formTabsBarLight: { borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.18)' },
  formTabsBarDark: { borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.22)' },
  formTabsRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  formTabPillBase: { height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  formTabPillActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.28)' },
  formTabPillInactive: { backgroundColor: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.18)' },
  formTabTextActive: { color: COLORS.primary, fontWeight: '900' },
  formTabTextInactive: { color: '#475569', fontWeight: '800' },
  toggleRow: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.08)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readonlyStatusRow: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.08)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusPillActive: { backgroundColor: 'rgba(34,197,94,0.14)', borderColor: 'rgba(34,197,94,0.25)' },
  statusPillInactive: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.25)' },
  statusPillText: { fontWeight: '900', color: COLORS.text },
  actionsBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  actionsLeft: { minWidth: 90, alignSelf: 'flex-start' },
  actionsRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, flexGrow: 1 },
  actionBtnFull: { width: '100%' },
  twoCol: { flexDirection: 'row', gap: 10 },
  stackCol: { flexDirection: 'column' },
  pickerField: { flex: 1, minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.08)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerLabel: { opacity: 0.75 },
  pickItem: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(148,163,184,0.12)', marginBottom: 8 },

  webCalHeaderPress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
  monthCell: { width: '30%', minWidth: 92, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.10)', alignItems: 'center', justifyContent: 'center' },
  monthCellActive: { borderColor: 'rgba(37,99,235,0.35)', backgroundColor: 'rgba(37,99,235,0.14)' },
  monthCellActiveText: { color: '#1D4ED8', fontWeight: '900' },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
  dialogLight: { backgroundColor: 'white' },
  dialogDark: { backgroundColor: '#0F172A' },
});

