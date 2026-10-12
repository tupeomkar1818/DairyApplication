import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Dialog, HelperText, List, Portal, Text, TextInput } from 'react-native-paper';

import { buildSubscriptionPayloadFromPlans } from '@/src/components/admin/buildSubscriptionPayloadFromPlans';
import {
  buildSubscriptionMonthOptions,
  deliveryTimeLabel,
  formatSubscriptionPlanAsOrderExample,
  frequencyLabel,
  monthLabel as subscriptionMonthLabel,
  planStatusLabel,
  shiftMonth,
  subscriptionPlanShowsInCalendarMonth,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { MilkSubscriptionLineCompactFields } from '@/src/components/admin/MilkSubscriptionLineCompactFields';
import { DatePickerModal } from '@/src/components/shared/DatePickerModal';
import {
  endOfMonthDdMmYyyy,
  fmtDdMmYyyy,
  toDdMmYyyyFromFlexibleDate,
  toIsoYmdFromFlexibleDate,
} from '@/src/components/admin/customerFormDates';
import { isMilkCatalogProduct, milkLineHasPackComplete } from '@/src/components/admin/milkSubscriptionLineUi';
import type {
  AppendCustomerSubscriptionPlanHistoryMemoRequest,
  CustomerResponse,
  CustomerSubscriptionPlanDto,
} from '@/src/domain/customers/dtos';
import { findDuplicateMilkLineIndex, milkProductNameKey } from '@/src/domain/customers/milkLineDuplicate';
import { duplicateClosureEndDdMmYyyy, isPlanStartEndMonthRuleOk } from '@/src/domain/shared/planBoundaryDates';
import type { Product } from '@/src/domain/products/entities';
import { effectiveUnitPrice } from '@/src/domain/products/pricing';
import { CustomerSubscriptionFieldsUpdateSchema } from '@/src/domain/customers/validations';
import {
  subscriptionPlanHistoryMemosQueryKey,
  useCustomerSubscriptionPlanHistoryMemos,
  useUpdateCustomer,
} from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { formFieldAttrs } from '@/src/theme/platformStyles';
import { amraleRadius, dairyTactileColors, tactileCardElevation } from '@/src/theme/dairyTactile';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';

function planIsMilkRow(p: CustomerSubscriptionPlanDto, catalog: Product[]): boolean {
  const prod = catalog.find((x) => x.name === p.productName);
  if (!prod) return false;
  return isMilkCatalogProduct(prod);
}

function money(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

function startDatePatchWithMonthEnd(startDdMmYyyy: string): Partial<CustomerSubscriptionPlanDto> {
  const t = startDdMmYyyy.trim();
  const end = /^\d{2}\/\d{2}\/\d{4}$/.test(t) ? endOfMonthDdMmYyyy(t) : null;
  return { startDate: t, ...(end ? { endDate: end } : {}) };
}

const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  text: '#1E293B',
};

/** Customer screens use the light-only DairyTactile surfaces; pin the scheme so text never switches to dark-mode colors. */
const CUSTOMER_TACTILE_SCHEME = 'light' as 'light' | 'dark';

const DELIVERY_TIME_OPTIONS = ['Morning', 'Evening', 'Both'] as const;
type DeliveryTimeOption = typeof DELIVERY_TIME_OPTIONS[number];

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
type SubFrequencyOption = typeof SUB_FREQUENCY_OPTIONS[number];

function createEmptySubscriptionPlan(
  deliveryTime: DeliveryTimeOption,
  subscriptionFrequency: SubFrequencyOption,
): CustomerSubscriptionPlanDto {
  const startDate = fmtDdMmYyyy(new Date());
  const endDate = endOfMonthDdMmYyyy(startDate) ?? undefined;
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
    endDate,
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

export type CustomerSubscriptionPlansEditorProps = {
  customer: CustomerResponse;
  customerId: string;
  /** DairyTactile styling for customer detail subscription tab */
  variant?: 'default' | 'tactile';
  /** Month to show. Pass it (with `onMonthChange`) to drive this card from the screen's shared month stepper. */
  month?: string;
  onMonthChange?: (next: string) => void;
};

function CustomerSubscriptionPlansEditorInner({
  customer,
  customerId,
  variant = 'default',
  month,
  onMonthChange,
}: CustomerSubscriptionPlansEditorProps) {
  const isTactile = variant === 'tactile';
  const t = useStrings('subscriptionEditor');
  const common = useStrings('common');
  const scheme = CUSTOMER_TACTILE_SCHEME;
  const { width, height } = useWindowDimensions();
  // Dialogs: centered, 480 max wide (16px gutter on phones), viewport-capped height.
  const dialogSize = useResponsiveDialogStyle(480);
  /** Scrollable dialog body height (year / month lists) so the list scrolls instead of overflowing the dialog. */
  const dialogScrollMaxH = Math.max(200, Math.min(Math.round(height * 0.6), height - 200));
  const qc = useQueryClient();
  const products = useProducts();
  const update = useUpdateCustomer();
  const { appendMemo } = useCustomerSubscriptionPlanHistoryMemos(customerId);

  const isMobileBp = width < 640;
  const inputDense = isMobileBp;

  const sectionCard = isTactile
    ? styles.sectionCardTactile
    : scheme === 'dark'
      ? styles.sectionCardDark
      : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;
  const titleColor = scheme === 'dark' ? 'white' : COLORS.text;

  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Controlled by the screen when `month` is passed; the local state is the standalone fallback.
  const [ownBasicMonth, setOwnBasicMonth] = useState(monthKey);
  const basicDetailsMonth = month ?? ownBasicMonth;
  const setBasicDetailsMonth = onMonthChange ?? setOwnBasicMonth;
  const monthIsControlled = month !== undefined;
  const [basicMonthPickerOpen, setBasicMonthPickerOpen] = useState(false);

  const subscriptionMonthOptions = useMemo(
    () => buildSubscriptionMonthOptions(customer.subscriptionStartDate, monthKey),
    [customer.subscriptionStartDate, monthKey],
  );

  useEffect(() => {
    // Never reset a month the screen owns: that would drag the other tabs back to today.
    if (monthIsControlled) return;
    setOwnBasicMonth(monthKey);
  }, [customerId, monthIsControlled, monthKey]);

  useEffect(() => {
    // Only snap to a month with lines when this card owns the month.
    if (monthIsControlled) return;
    if (!subscriptionMonthOptions.length) return;
    if (!subscriptionMonthOptions.includes(basicDetailsMonth)) {
      setOwnBasicMonth(subscriptionMonthOptions[0]!);
    }
  }, [monthIsControlled, subscriptionMonthOptions, basicDetailsMonth]);

  const oldestBasicMonth = subscriptionMonthOptions[subscriptionMonthOptions.length - 1] ?? monthKey;
  const basicPrevDisabled = basicDetailsMonth <= oldestBasicMonth;
  const basicNextDisabled = basicDetailsMonth >= monthKey;

  const adminProducts = useMemo(() => {
    const items = products.data?.items ?? [];
    return items.filter((p) => p.isActive);
  }, [products.data?.items]);

  const milkProducts = useMemo(() => adminProducts.filter(isMilkCatalogProduct), [adminProducts]);

  const toDob = useCallback((value: string | undefined | null) => toDdMmYyyyFromFlexibleDate(value), []);

  const [subscriptionPlans, setSubscriptionPlans] = useState<CustomerSubscriptionPlanDto[]>([]);
  const [retainedNonMilkPlans, setRetainedNonMilkPlans] = useState<CustomerSubscriptionPlanDto[]>([]);
  const [wizardDraft, setWizardDraft] = useState<CustomerSubscriptionPlanDto | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [wizardDateField, setWizardDateField] = useState<'startDate' | 'endDate' | null>(null);
  const [basicDetailsExpanded, setBasicDetailsExpanded] = useState(false);
  /** `null` = add (only when there are zero milk lines); index = replace that milk row on save */
  const [editingMilkIndex, setEditingMilkIndex] = useState<number | null>(null);
  const [removeMilkDialogIndex, setRemoveMilkDialogIndex] = useState<number | null>(null);
  const [duplicateDialogIndex, setDuplicateDialogIndex] = useState<number | null>(null);

  const milkPlansForSelectedMonth = useMemo(() => {
    const withIdx = subscriptionPlans
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => subscriptionPlanShowsInCalendarMonth(basicDetailsMonth, p));
    const keyToBest = new Map<string, { p: CustomerSubscriptionPlanDto; idx: number }>();
    for (const item of withIdx) {
      const k = milkProductNameKey(item.p);
      const startYmd = toIsoYmdFromFlexibleDate(item.p.startDate) ?? '';
      const prev = keyToBest.get(k);
      if (!prev) {
        keyToBest.set(k, item);
        continue;
      }
      const prevStart = toIsoYmdFromFlexibleDate(prev.p.startDate) ?? '';
      if (startYmd > prevStart || (startYmd === prevStart && item.idx > prev.idx)) {
        keyToBest.set(k, item);
      }
    }
    return Array.from(keyToBest.values()).sort((a, b) => a.idx - b.idx);
  }, [subscriptionPlans, basicDetailsMonth]);

  useEffect(() => {
    setBasicDetailsExpanded(false);
  }, [customerId]);

  const customerRef = useRef(customer);
  customerRef.current = customer;
  const wizardOpenRef = useRef(false);
  wizardOpenRef.current = wizardDraft != null;
  /** A customer update arrived while the add/edit wizard was open; applied once the wizard closes. */
  const syncPendingRef = useRef(false);

  const syncFromCustomer = useCallback(() => {
    const catalog = adminProducts;
    const all = customerRef.current.subscriptionPlans ?? [];
    const milkRows = all.filter((p) => planIsMilkRow(p, catalog));
    const other = all.filter((p) => !planIsMilkRow(p, catalog));
    setRetainedNonMilkPlans(other);

    setSubscriptionPlans(
      milkRows.length
        ? (milkRows.map((p) => ({
            // Keep identity so saving re-sends the same line instead of re-issuing it.
            id: p.id,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            productName: p.productName,
            numberOfItems: (p as { numberOfItems?: number }).numberOfItems ?? 1,
            quantityLabel: p.quantityLabel,
            unitType: p.unitType,
            subscriptionKind: p.subscriptionKind ?? 'Monthly',
            deliveryDate: p.deliveryDate ? toDob(p.deliveryDate) : undefined,
            deliveryTime: p.deliveryTime,
            frequency: p.frequency,
            startDate: toDob(p.startDate),
            endDate: (() => {
              const fromStored = p.endDate ? toDob(p.endDate) : '';
              if (fromStored) return fromStored;
              const sd = toDob(p.startDate);
              if (sd && /^\d{2}\/\d{2}\/\d{4}$/.test(sd)) {
                const eom = endOfMonthDdMmYyyy(sd);
                if (eom) return eom;
              }
              return undefined;
            })(),
            pauseStartDate: p.pauseStartDate ? toDob(p.pauseStartDate) : undefined,
            pauseEndDate: p.pauseEndDate ? toDob(p.pauseEndDate) : undefined,
            resumeDate: p.resumeDate ? toDob(p.resumeDate) : undefined,
            pauseReason: p.pauseReason,
            pauseStatus: p.pauseStatus,
            productAdditionTag: p.productAdditionTag ?? 'Regular',
            notes: p.notes,
            originalPrice: p.effectiveFinalPrice ?? p.originalPrice ?? 0,
            discountedPrice: 0,
            effectiveFinalPrice: p.effectiveFinalPrice ?? p.originalPrice ?? 0,
            paymentStatus: p.paymentStatus,
            dailyCost: p.dailyCost,
            addedDate: p.addedDate ? toDob(p.addedDate) : undefined,
            status: p.status,
          })) as CustomerSubscriptionPlanDto[])
        : [],
    );
    setWizardDraft(null);
    setEditingMilkIndex(null);
    setRemoveMilkDialogIndex(null);
    setTouched(false);
    setError(null);
  }, [adminProducts, toDob]);

  // Re-sync local rows when the customer changes — but never while an add/edit draft is in progress: a refetch
  // (e.g. another tab saving) would otherwise wipe what the admin is typing.
  useEffect(() => {
    if (wizardOpenRef.current) {
      syncPendingRef.current = true;
      return;
    }
    syncPendingRef.current = false;
    syncFromCustomer();
  }, [customer.id, customer.updatedAt, customer.subscriptionPlans, customer.deliveryTime, customer.subscriptionFrequency, customer.subscriptionStatus, syncFromCustomer]);

  const wizardOpen = wizardDraft != null;
  useEffect(() => {
    if (wizardOpen || !syncPendingRef.current) return;
    syncPendingRef.current = false;
    syncFromCustomer();
  }, [wizardOpen, syncFromCustomer]);

  useEffect(() => {
    if (error) setBasicDetailsExpanded(true);
  }, [error]);

  const patchWizard = useCallback((patch: Partial<CustomerSubscriptionPlanDto>) => {
    setWizardDraft((d) => (d ? { ...d, ...patch } : d));
  }, []);

  const startWizard = useCallback(() => {
    const dt = (customer.deliveryTime ?? 'Morning') as DeliveryTimeOption;
    const fq = (customer.subscriptionFrequency ?? 'Daily') as SubFrequencyOption;
    const base = createEmptySubscriptionPlan(dt, fq);
    setEditingMilkIndex(null);
    const last = subscriptionPlans.length ? subscriptionPlans[subscriptionPlans.length - 1] : null;
    if (last?.productName?.trim()) {
      const prod = milkProducts.find((p) => p.name === last.productName);
      const unitPrice = prod ? effectiveUnitPrice(prod) : Number(last.originalPrice ?? 0);
      setWizardDraft({
        ...base,
        productName: last.productName,
        quantityLabel: last.quantityLabel,
        numberOfItems: last.numberOfItems ?? 1,
        unitType: last.unitType,
        originalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        discountedPrice: 0,
        effectiveFinalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      });
    } else {
      setWizardDraft(base);
    }
    setTouched(false);
    setError(null);
  }, [customer.deliveryTime, customer.subscriptionFrequency, milkProducts, subscriptionPlans]);

  const startEditWizard = useCallback(
    (index: number) => {
      const row = subscriptionPlans[index];
      if (!row) return;
      const prod = milkProducts.find((p) => p.name === row.productName);
      const unitPrice = prod ? effectiveUnitPrice(prod) : Number(row.originalPrice ?? row.effectiveFinalPrice ?? 0);
      setEditingMilkIndex(index);
      setWizardDraft({
        ...row,
        originalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        discountedPrice: 0,
        effectiveFinalPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      });
      setTouched(false);
      setError(null);
    },
    [subscriptionPlans, milkProducts],
  );

  const cancelWizard = useCallback(() => {
    setWizardDraft(null);
    setEditingMilkIndex(null);
    setTouched(false);
    setError(null);
    setDuplicateDialogIndex(null);
  }, []);

  const wizardStartValid = /^\d{2}\/\d{2}\/\d{4}$/.test((wizardDraft?.startDate ?? '').trim());
  const canSaveWizard =
    !!wizardDraft &&
    milkLineHasPackComplete(wizardDraft, milkProducts) &&
    wizardStartValid &&
    isPlanStartEndMonthRuleOk(wizardDraft.startDate, wizardDraft.endDate);

  const openDatePickerForDraft = (field: 'startDate' | 'endDate') => {
    if (!wizardDraft) return;
    setWizardDateField(field);
    setDobPickerOpen(true);
  };

  const buildSavePayload = useCallback(
    (milkRows: CustomerSubscriptionPlanDto[]) => {
      const milkBuilt = buildSubscriptionPayloadFromPlans(milkRows ?? [], milkProducts);
      const mergedPlans = [...milkBuilt.subscriptionPlans, ...retainedNonMilkPlans];
      const mergedSub = [
        ...milkBuilt.subscription,
        ...retainedNonMilkPlans.map((p) => ({
          productName: p.productName,
          quantityLabel: `${Math.max(1, Number((p as { numberOfItems?: number }).numberOfItems ?? 1))} x ${p.quantityLabel}`,
        })),
      ];
      const first = milkBuilt.subscriptionPlans[0];
      return {
        deliveryTime: (customer.deliveryTime ?? 'Morning') as DeliveryTimeOption,
        subscriptionStartDate: first?.startDate,
        subscriptionEndDate: first?.endDate,
        subscriptionStatus: customer.subscriptionStatus ?? 'Active',
        subscriptionFrequency: (customer.subscriptionFrequency ?? 'Daily') as SubFrequencyOption,
        preferredDeliveryNotes: customer.preferredDeliveryNotes?.trim() ? customer.preferredDeliveryNotes.trim() : undefined,
        subscription: mergedSub,
        subscriptionPlans: mergedPlans,
      };
    },
    [
      customer.deliveryTime,
      customer.preferredDeliveryNotes,
      customer.subscriptionFrequency,
      customer.subscriptionStatus,
      milkProducts,
      retainedNonMilkPlans,
    ],
  );

  function openRemoveMilkDialog(index: number) {
    if (!subscriptionPlans[index]) return;
    setRemoveMilkDialogIndex(index);
  }

  async function confirmRemoveMilkPlan() {
    if (removeMilkDialogIndex === null) return;
    const index = removeMilkDialogIndex;
    setRemoveMilkDialogIndex(null);
    await removeMilkPlanAtIndex(index);
  }

  const persistMilkPlans = useCallback(
    async (
      combinedMilk: CustomerSubscriptionPlanDto[],
      memoPayload?: AppendCustomerSubscriptionPlanHistoryMemoRequest,
    ): Promise<boolean> => {
      const payload = buildSavePayload(combinedMilk);
      const parsed = CustomerSubscriptionFieldsUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? strings('subscriptionEditor').plansEditor.errors.checkFields);
        return false;
      }
      try {
        await update.mutateAsync({ id: customerId, data: parsed.data });
        // Immediate UI: do not wait for refetch; sync effect will reconcile when `customer` updates.
        setSubscriptionPlans(combinedMilk);
        if (memoPayload) {
          await appendMemo(memoPayload);
        }
        await qc.invalidateQueries({ queryKey: ['customers', 'getById', customerId] });
        await qc.invalidateQueries({ queryKey: ['customers', 'list'] });
        await qc.invalidateQueries({ queryKey: subscriptionPlanHistoryMemosQueryKey(customerId) });
        await qc.refetchQueries({ queryKey: ['customers', 'getById', customerId] });
        setTouched(false);
        setWizardDraft(null);
        setEditingMilkIndex(null);
        setDuplicateDialogIndex(null);
        return true;
      } catch {
        setError(strings('subscriptionEditor').plansEditor.errors.saveFailed);
        return false;
      }
    },
    [appendMemo, buildSavePayload, customerId, qc, update],
  );

  async function removeMilkPlanAtIndex(index: number) {
    setError(null);
    const nextMilk = subscriptionPlans.filter((_, i) => i !== index);
    const payload = buildSavePayload(nextMilk);
    const parsed = CustomerSubscriptionFieldsUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t.plansEditor.errors.removeInvalid;
      setError(msg);
      Alert.alert(t.plansEditor.errors.cannotRemove, msg);
      return;
    }
    try {
      await update.mutateAsync({ id: customerId, data: parsed.data });
      setSubscriptionPlans(nextMilk);
      await qc.invalidateQueries({ queryKey: ['customers', 'getById', customerId] });
      await qc.invalidateQueries({ queryKey: ['customers', 'list'] });
      await qc.refetchQueries({ queryKey: ['customers', 'getById', customerId] });
    } catch {
      const msg = t.plansEditor.errors.removeFailed;
      setError(msg);
      Alert.alert(t.plansEditor.errors.removeFailedTitle, msg);
    }
  }

  async function onSaveSubscription() {
    if (!wizardDraft) return;
    setError(null);
    setTouched(true);

    const dupIdx = findDuplicateMilkLineIndex(wizardDraft, subscriptionPlans, editingMilkIndex);
    if (dupIdx >= 0) {
      setDuplicateDialogIndex(dupIdx);
      return;
    }

    const combinedMilk =
      editingMilkIndex !== null
        ? subscriptionPlans.map((row, i) => (i === editingMilkIndex ? { ...wizardDraft } : row))
        : [...subscriptionPlans, wizardDraft];
    await persistMilkPlans(combinedMilk);
  }

  async function confirmDuplicateMilkLineAndSave() {
    if (!wizardDraft || duplicateDialogIndex === null) return;
    const dupIdx = duplicateDialogIndex;
    const closed = subscriptionPlans[dupIdx];
    if (!closed) {
      setDuplicateDialogIndex(null);
      return;
    }

    const newStart = wizardDraft.startDate.trim();
    const closureEnd = duplicateClosureEndDdMmYyyy(closed.startDate, newStart);
    if (!isPlanStartEndMonthRuleOk(closed.startDate, closureEnd)) {
      setError(t.plansEditor.errors.closeLineInvalid);
      setDuplicateDialogIndex(null);
      return;
    }

    const priorEnd = closed.endDate?.trim() ?? '';
    let newEnd = wizardDraft.endDate?.trim() ?? '';
    if (priorEnd && isPlanStartEndMonthRuleOk(newStart, priorEnd)) {
      newEnd = priorEnd;
    }
    const newRow: CustomerSubscriptionPlanDto = { ...wizardDraft, endDate: newEnd || wizardDraft.endDate };
    if (!isPlanStartEndMonthRuleOk(newRow.startDate, newRow.endDate)) {
      setError(t.plansEditor.errors.newEndInvalid);
      setDuplicateDialogIndex(null);
      return;
    }

    const beforeEnd = closed.endDate?.trim() ? closed.endDate : '—';
    const base = subscriptionPlans.map((row, i) => (i === dupIdx ? { ...row, endDate: closureEnd } : row));

    const combinedMilk =
      editingMilkIndex !== null
        ? base.map((row, i) => (i === editingMilkIndex ? { ...newRow } : row))
        : [...base, newRow];

    // Without the existing line's start as a floor, closure is simply the day before the new start.
    const clampedToOldStart = closureEnd !== duplicateClosureEndDdMmYyyy('', newStart);
    const endNote = clampedToOldStart
      ? `New line start ${newStart}; previous end ${beforeEnd} → ${closureEnd} (end set to previous line’s start because the new line starts on or before it).`
      : `Previous end ${beforeEnd} → ${closureEnd} (day before new line start ${newStart}). New line end ${newRow.endDate?.trim() ?? '—'} (same as previous subscription end when applicable).`;

    const msg = `Same milk product: closed prior line for "${closed.productName}" (${String(closed.quantityLabel ?? '').trim()}, qty ${closed.numberOfItems ?? 1}, ${closed.frequency}, ${closed.deliveryTime}). ${endNote} Added "${newRow.productName}" (${String(newRow.quantityLabel ?? '').trim()}, qty ${newRow.numberOfItems ?? 1}, ${newRow.frequency}, ${newRow.deliveryTime}).`;

    const memoPayload: AppendCustomerSubscriptionPlanHistoryMemoRequest = {
      kind: 'duplicate_milk_line_closed',
      message: msg,
      closedLineProductName: closed.productName,
      closedLineEndBeforeDisplay: beforeEnd,
      closedLineEndAfterDisplay: closureEnd,
      addedLineProductName: newRow.productName,
    };

    await persistMilkPlans(combinedMilk, memoPayload);
  }

  const basicAccordionExpanded = wizardDraft != null ? true : basicDetailsExpanded;

  return (
    <Card style={[styles.sectionCard, sectionCard, isTactile ? styles.sectionCardTactileElev : null]} mode={isTactile ? 'contained' : 'elevated'}>
      <Card.Content style={styles.cardInnerAccordion}>
        <View style={[styles.sectionCardClip, isTactile ? styles.sectionCardClipTactile : null]}>
        <List.Accordion
          title={t.plansEditor.title}
          titleNumberOfLines={2}
          expanded={basicAccordionExpanded}
          onPress={() => {
            if (wizardDraft != null) return;
            setBasicDetailsExpanded((v) => !v);
          }}
          titleStyle={[styles.bold, isTactile ? styles.accordionTitleTactile : textMain]}
          style={{ backgroundColor: 'transparent' }}
          left={(props) => <List.Icon {...props} icon={isTactile ? 'shopping-outline' : 'clipboard-text-outline'} color={isTactile ? dairyTactileColors.primaryContainer : undefined} />}
        >
          <View style={styles.accordionBody}>
            {!milkProducts.length ? (
              <HelperText type="info" visible>
                {t.plansEditor.noMilkProducts}
              </HelperText>
            ) : null}

            {!wizardDraft ? (
              <View style={styles.idleColumn}>
                <Text variant="bodySmall" style={textSub}>
                  {monthIsControlled
                    ? t.plansEditor.overlapShared(subscriptionMonthLabel(basicDetailsMonth))
                    : t.plansEditor.overlap(subscriptionMonthLabel(basicDetailsMonth))}
                </Text>
                {monthIsControlled ? null : (
                  <View style={styles.monthNavRow}>
                    <Pressable
                      disabled={basicPrevDisabled}
                      onPress={() => setBasicDetailsMonth(shiftMonth(basicDetailsMonth, -1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        basicPrevDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={22} color={titleColor} />
                    </Pressable>
                    <Pressable onPress={() => setBasicMonthPickerOpen(true)} style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}>
                      <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                        {subscriptionMonthLabel(basicDetailsMonth)}
                      </Text>
                      <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                        {basicDetailsMonth}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={basicNextDisabled}
                      onPress={() => setBasicDetailsMonth(shiftMonth(basicDetailsMonth, 1))}
                      style={({ pressed }) => [
                        styles.monthNavBtn,
                        basicNextDisabled ? styles.monthNavBtnDisabled : null,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={22} color={titleColor} />
                    </Pressable>
                  </View>
                )}

                {milkPlansForSelectedMonth.length > 0 ? (
                  <View style={styles.savedPlansList}>
                    {milkPlansForSelectedMonth.map(({ p, idx }) => (
                      <View
                        key={`${p.productName}_${p.startDate ?? ''}_${p.quantityLabel}_${idx}`}
                        style={[styles.savedPlanCard, scheme === 'dark' ? styles.savedPlanCardDark : styles.savedPlanCardLight]}
                      >
                        <View style={styles.savedPlanHeader}>
                          <Text variant="titleSmall" style={[styles.bold, textMain, styles.savedPlanTitle]} numberOfLines={2}>
                            {p.productName}
                          </Text>
                          <View style={styles.savedPlanActions}>
                            <Button
                              mode="text"
                              compact
                              disabled={update.isPending}
                              onPress={() => startEditWizard(idx)}
                              accessibilityLabel={t.plansEditor.updateA11y(p.productName)}
                            >
                              {t.plansEditor.update}
                            </Button>
                            <Button
                              mode="text"
                              compact
                              disabled={update.isPending}
                              onPress={() => openRemoveMilkDialog(idx)}
                              textColor="#B91C1C"
                              accessibilityLabel={t.plansEditor.removeA11y(p.productName)}
                            >
                              {common.actions.delete}
                            </Button>
                          </View>
                        </View>
                        <Text variant="bodySmall" style={textMain} numberOfLines={2}>
                          {formatSubscriptionPlanAsOrderExample(p)}
                        </Text>
                        <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                          {frequencyLabel(p.frequency)} · {deliveryTimeLabel(p.deliveryTime)}
                        </Text>
                        <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                          {p.startDate?.trim() ? p.startDate : '—'} → {p.endDate?.trim() ? p.endDate : '—'}
                        </Text>
                        <View style={styles.savedPlanFooter}>
                          <Text variant="labelSmall" style={[styles.bold, textMain]}>
                            {planStatusLabel(p.status)}
                          </Text>
                          <Text variant="labelSmall" style={[styles.bold, textMain]}>
                            {money(p.effectiveFinalPrice ?? p.originalPrice)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : subscriptionPlans.length > 0 ? (
                  <Text variant="bodySmall" style={textSub}>
                    {t.plansEditor.noLinesInMonth(subscriptionMonthLabel(basicDetailsMonth))}
                  </Text>
                ) : null}

                <Button
                  mode="contained"
                  buttonColor={COLORS.primary}
                  onPress={startWizard}
                  disabled={!milkProducts.length}
                >
                  {t.plansEditor.addMilkProduct}
                </Button>
              </View>
            ) : (
              <ScrollView style={styles.wizardScroll} contentContainerStyle={styles.wizardScrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.planCard}>
                  <MilkSubscriptionLineCompactFields
                    products={milkProducts}
                    draft={wizardDraft}
                    onPatch={patchWizard}
                    scheme={scheme}
                    textMain={textMain}
                    textSub={textSub}
                  />

                  {milkLineHasPackComplete(wizardDraft, milkProducts) ? (
                    <>
                      <TextInput
                        {...formFieldAttrs('subscription-plan-start-date')}
                        dense={inputDense}
                        mode="outlined"
                        label={t.fields.startDate}
                        placeholder="DD/MM/YYYY"
                        value={wizardDraft.startDate}
                        onChangeText={(t) => {
                          const s = t.trim();
                          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
                            patchWizard(startDatePatchWithMonthEnd(s));
                          } else {
                            patchWizard({ startDate: t });
                          }
                        }}
                        right={
                          <TextInput.Icon
                            icon="calendar"
                            onPress={() => openDatePickerForDraft('startDate')}
                            forceTextInputFocus={false}
                          />
                        }
                      />

                      <Text variant="bodySmall" style={[textSub, { marginBottom: -4 }]}>
                        {t.plansEditor.endDateHint}
                      </Text>
                      <TextInput
                        {...formFieldAttrs('subscription-plan-end-date')}
                        dense={inputDense}
                        mode="outlined"
                        label={t.fields.endDate}
                        placeholder="DD/MM/YYYY"
                        value={wizardDraft.endDate ?? ''}
                        onChangeText={(t) => {
                          const s = t.trim();
                          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
                            patchWizard({ endDate: s });
                          } else {
                            patchWizard({ endDate: t });
                          }
                        }}
                        right={
                          <TextInput.Icon
                            icon="calendar"
                            onPress={() => openDatePickerForDraft('endDate')}
                            forceTextInputFocus={false}
                          />
                        }
                      />
                    </>
                  ) : null}
                </View>

                <View style={styles.wizardActions}>
                  <Button mode="outlined" onPress={cancelWizard} disabled={update.isPending}>
                    {common.actions.cancel}
                  </Button>
                  <Button
                    mode="contained"
                    buttonColor={COLORS.primary}
                    onPress={() => void onSaveSubscription()}
                    loading={update.isPending}
                    disabled={update.isPending || !canSaveWizard}
                  >
                    {editingMilkIndex !== null ? t.plansEditor.updateSubscription : t.plansEditor.saveSubscription}
                  </Button>
                </View>
              </ScrollView>
            )}

            <HelperText type="error" visible={!!error}>
              {error ?? ' '}
            </HelperText>
          </View>
        </List.Accordion>
        </View>
      </Card.Content>

      <Portal>
        {/* Shared JS picker on every platform: the native iOS picker crashed the app here (it aborts on display="calendar"). */}
        <DatePickerModal
          visible={dobPickerOpen}
          value={wizardDraft && wizardDateField ? String(wizardDraft[wizardDateField] ?? '') : ''}
          // Plan start/end dates are future-capable (e.g. a December line ending next January).
          yearsAhead={5}
          title={wizardDateField === 'endDate' ? t.fields.endDate : t.fields.startDate}
          onSelect={(ddmmyyyy) => {
            if (wizardDateField === 'endDate') {
              patchWizard({ endDate: ddmmyyyy });
            } else {
              patchWizard(startDatePatchWithMonthEnd(ddmmyyyy));
            }
          }}
          // `wizardDateField` stays until the next opening sets it, so the title does not flip while the picker fades out.
          onDismiss={() => setDobPickerOpen(false)}
        />

        <Dialog visible={basicMonthPickerOpen} onDismiss={() => setBasicMonthPickerOpen(false)} style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, dialogSize]}>
          <Dialog.Title>{t.plansEditor.monthPickerTitle}</Dialog.Title>
          <Dialog.Content style={{ maxHeight: Math.min(360, dialogScrollMaxH) }}>
            <ScrollView>
              {subscriptionMonthOptions.map((m) => {
                const selected = m === basicDetailsMonth;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setBasicDetailsMonth(m);
                      setBasicMonthPickerOpen(false);
                    }}
                    style={({ pressed }) => [styles.monthPickRow, pressed && styles.pressed]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyLarge" style={textMain}>
                        {subscriptionMonthLabel(m)}
                      </Text>
                      <Text variant="bodySmall" style={textSub}>
                        {m}
                      </Text>
                    </View>
                    {selected ? <MaterialCommunityIcons name="check" size={20} color={COLORS.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBasicMonthPickerOpen(false)}>{common.actions.close}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={duplicateDialogIndex !== null}
          onDismiss={() => setDuplicateDialogIndex(null)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, dialogSize]}
        >
          <Dialog.Title>{t.plansEditor.duplicateTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
              {t.plansEditor.duplicateBody}
            </Text>
            {duplicateDialogIndex !== null && subscriptionPlans[duplicateDialogIndex] ? (
              <Text variant="bodySmall" style={[textSub, { marginTop: 10 }]}>
                {t.plansEditor.existing(formatSubscriptionPlanAsOrderExample(subscriptionPlans[duplicateDialogIndex]!))}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDuplicateDialogIndex(null)} disabled={update.isPending}>
              {common.actions.cancel}
            </Button>
            <Button mode="contained" onPress={() => void confirmDuplicateMilkLineAndSave()} loading={update.isPending}>
              {t.plansEditor.endPreviousAndSave}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={removeMilkDialogIndex !== null}
          onDismiss={() => setRemoveMilkDialogIndex(null)}
          style={[scheme === 'dark' ? styles.dialogDark : styles.dialogLight, dialogSize]}
        >
          <Dialog.Title>{t.plansEditor.removeTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
              {removeMilkDialogIndex !== null
                ? t.plansEditor.removeBody(subscriptionPlans[removeMilkDialogIndex]?.productName ?? '')
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveMilkDialogIndex(null)} disabled={update.isPending}>
              {common.actions.cancel}
            </Button>
            <Button
              textColor="#B91C1C"
              onPress={() => void confirmRemoveMilkPlan()}
              loading={update.isPending}
              disabled={update.isPending}
            >
              {common.actions.remove}
            </Button>
          </Dialog.Actions>
        </Dialog>

      </Portal>
    </Card>
  );
}

export const CustomerSubscriptionPlansEditor = React.memo(CustomerSubscriptionPlansEditorInner);

const styles = StyleSheet.create({
  bold: { fontWeight: '900' },
  cardInner: { gap: 10 },
  cardInnerAccordion: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  idleColumn: { gap: 12 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4, marginBottom: 4 },
  monthNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(148,163,184,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.55 },
  monthNavCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  monthPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  savedPlansList: { gap: 10 },
  savedPlanHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  savedPlanActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 },
  savedPlanTitle: { flex: 1, minWidth: 0 },
  savedPlanCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  savedPlanCardLight: { borderColor: 'rgba(148,163,184,0.35)', backgroundColor: 'rgba(148,163,184,0.06)' },
  savedPlanCardDark: { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
  savedPlanFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, gap: 8 },
  sectionCard: { borderRadius: 16, borderWidth: 1 },
  sectionCardClip: { overflow: 'hidden', borderRadius: 16 },
  sectionCardClipTactile: { borderRadius: amraleRadius.lg },
  sectionCardTactile: {
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderColor: dairyTactileColors.outlineVariant,
    borderRadius: amraleRadius.lg,
  },
  sectionCardTactileElev: tactileCardElevation(),
  accordionTitleTactile: { color: dairyTactileColors.onSurface, fontWeight: '700' },
  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
  dialogLight: { backgroundColor: 'white' },
  dialogDark: { backgroundColor: '#0F172A' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  wizardScroll: { maxHeight: 560 },
  wizardScrollContent: { paddingBottom: 12 },
  wizardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  planCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', padding: 10, gap: 10 },
});
