import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { memo, startTransition, type ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { MilkSubscriptionLineCompactFields } from '@/src/components/admin/MilkSubscriptionLineCompactFields';
import { emptyMilkLineDraftForPicker, milkLineHasPackComplete } from '@/src/components/admin/milkSubscriptionLineUi';
import type {
  CustomerDailyProductOrderLineDto,
  CustomerResponse,
  CustomerSubscriptionPlanDto,
} from '@/src/domain/customers/dtos';
import { effectiveUnitPrice } from '@/src/domain/products/pricing';
import { estimateMonthTotal } from '@/src/components/customer/myDays';
import {
  buildSubscriptionMonthOptions,
  monthLabel,
  formatSubscriptionPlanAsOrderExample,
  pickDailySubscriptionExamples,
  planLineTotal,
  shiftMonth,
  subscriptionPlanActiveOnDateYmd,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { buildCustomerSubscriptionHistoryRows } from '@/src/components/admin/buildCustomerSubscriptionHistoryRows';
import { CustomerSubscriptionDaySheet, DaySheetAddAddonButton } from '@/src/components/admin/CustomerSubscriptionDaySheet';
import { CustomerSubscriptionHistoryCards } from '@/src/components/admin/CustomerSubscriptionHistoryCards';
import { CustomerSubscriptionPlansEditor } from '@/src/components/admin/CustomerSubscriptionPlansEditor';
import {
  SubscriptionBillingFooter,
  SubscriptionEmptyBox,
  SubscriptionMonthPickerBar,
  SubscriptionTactileCard,
  SubscriptionTactileSection,
  subscriptionBillingCycleLabel,
} from '@/src/components/admin/customerSubscriptionTactileUi';
import { buildCalendarCells, MemoizedSubscriptionMonthCalendarGrid as SubscriptionMonthCalendarGrid } from '@/src/components/admin/SubscriptionMonthCalendarGrid';
import {
  cancelAddOnOrder,
  findPendingAddOn,
  placeAddOnOrder,
  setAddOnItems,
} from '@/src/components/customer/customerActions';
import { addOnDateYmd, addOnItemCount, addOnLabel } from '@/src/domain/customers/addOns';
import { dayEditability, plannedLinesOn } from '@/src/domain/customers/daySchedule';
import { notifyOrderCancelled, notifyOrderPlaced } from '@/src/domain/notifications/events';
import { productPacks } from '@/src/domain/products/packs';
import { useUpdateCustomer } from '@/src/hooks/customers';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { formatDay } from '@/src/utils/format';
import { useProducts } from '@/src/hooks/products';
import { dairyTactileColors } from '@/src/theme/dairyTactile';
import { platformShadow } from '@/src/theme/platformStyles';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';

const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  text: '#1E293B',
};

function money(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

function Kv({ label, value, textSub, textMain }: { label: string; value: string; textSub: object; textMain: object }) {
  return (
    <View style={styles.kvRow}>
      <Text variant="bodySmall" style={[textSub, styles.kvLabel]}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={[styles.kvValue, textMain]} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

function todayYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** An add-on as the day sheet lists it: the shared order row, with what the admin needs to see about it. */
type DayAddOnLine = CustomerDailyProductOrderLineDto & {
  /** Price per pack saved with the order — what the bill charges. */
  price: number;
  status: 'Pending' | 'Delivered' | 'Cancelled';
  placedBy?: 'customer' | 'admin';
};

export type CustomerSubscriptionTabProps = {
  customer: CustomerResponse | null | undefined;
  customerId: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  scheme: 'light' | 'dark' | null | undefined;
  onViewDetailedBill?: () => void;
  /** Month to show. Pass it (with `onMonthChange`) to drive this tab from the screen's shared month stepper. */
  month?: string;
  onMonthChange?: (next: string) => void;
};

function CustomerSubscriptionTabInner({
  customer: c,
  customerId,
  isMobile,
  isTablet,
  isDesktop,
  scheme,
  onViewDetailedBill,
  month,
  onMonthChange,
}: CustomerSubscriptionTabProps) {
  const t = useStrings('subscriptionEditor');
  const common = useStrings('common');
  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Controlled by the screen when `month` is passed; the local state is the standalone fallback.
  const [ownMonth, setOwnMonth] = useState(monthKey);
  const subscriptionMonth = month ?? ownMonth;
  const setSubscriptionMonth = onMonthChange ?? setOwnMonth;
  const monthIsControlled = month !== undefined;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(null);
  /** Persist the last tapped day for the table below the calendar (day dialog clears `selectedDayYmd` on close). */
  const [lastSelectedDayYmd, setLastSelectedDayYmd] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<null | 'subscription_line' | 'add_on_product'>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addSubtitle, setAddSubtitle] = useState('');
  const [dayOrderFormMode, setDayOrderFormMode] = useState<null | 'add' | 'edit'>(null);
  const [dayOrderEditingId, setDayOrderEditingId] = useState<string | null>(null);
  /** Accordion open state only for the add/edit form block (not for listed products). */
  const [addonFormAccordionOpen, setAddonFormAccordionOpen] = useState(true);
  const [milkAddonDraft, setMilkAddonDraft] = useState<CustomerSubscriptionPlanDto | null>(null);
  /** Confirm remove add-on: Alert inside another Dialog is unreliable on Android/Web — use Paper Dialog. */
  const [addonRemoveTarget, setAddonRemoveTarget] = useState<{ id: string; productName: string } | null>(null);
  /** Add-on add blocked when no subscription lines on that date (Paper Dialog, not Alert). */
  const [addonAddBlockedDialogOpen, setAddonAddBlockedDialogOpen] = useState(false);

  const products = useProducts();
  const offers = useOffers();
  const updateCustomer = useUpdateCustomer();
  const [addOnError, setAddOnError] = useState<string | null>(null);

  /**
   * Add-ons live on the customer record — the rows the customer's My days, the delivery run sheet and the bill read —
   * so what the admin adds here is what the van carries and what gets billed.
   */
  const dayOrders = useMemo(() => {
    const lines: DayAddOnLine[] = (c?.extraOrders ?? [])
      .filter((o) => o.status !== 'Cancelled')
      .map((o) => ({
        id: o.id,
        createdAtIso: o.createdAt,
        dateYmd: addOnDateYmd(o),
        productName: o.productName,
        quantityLabel: o.quantityLabel,
        unitType: o.unit,
        quantity: addOnItemCount(o),
        price: Math.max(0, Number(o.price ?? 0)),
        status: o.status,
        placedBy: o.placedBy,
      }));
    return { lines, ready: true };
  }, [c?.extraOrders]);

  const sectionCard = scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  const adminProducts = useMemo(() => (products.data?.items ?? []).filter((p) => p.isActive), [products.data?.items]);
  const customerSubscriptionProductNames = useMemo(() => {
    const names = new Set<string>();
    for (const item of c?.subscription ?? []) names.add(item.productName);
    for (const p of c?.subscriptionPlans ?? []) names.add(p.productName);
    return names;
  }, [c?.subscription, c?.subscriptionPlans]);
  /** Add-on products list for day orders: show all active catalogue products (not only milk). */
  const dayAddonProducts = useMemo(() => adminProducts, [adminProducts]);

  const subscriptionMonthOptions = useMemo(
    () => buildSubscriptionMonthOptions(c?.subscriptionStartDate, monthKey),
    [c?.subscriptionStartDate, monthKey],
  );

  const oldestMonth = subscriptionMonthOptions[subscriptionMonthOptions.length - 1] ?? monthKey;
  const prevDisabled = subscriptionMonth <= oldestMonth;
  const nextDisabled = subscriptionMonth >= monthKey;

  useEffect(() => {
    // Reset to the current month for a new customer — but never when the screen owns the month, or switching to
    // this tab would snap the shared month back to today.
    if (monthIsControlled) return;
    setOwnMonth(monthKey);
  }, [customerId, monthIsControlled, monthKey]);

  useEffect(() => {
    // Only snap to a month with plans when this tab owns the month; a shared month belongs to the whole screen.
    if (monthIsControlled) return;
    if (!subscriptionMonthOptions.length) return;
    if (!subscriptionMonthOptions.includes(subscriptionMonth)) {
      setSubscriptionMonth(subscriptionMonthOptions[0]!);
    }
  }, [monthIsControlled, subscriptionMonthOptions, subscriptionMonth, setSubscriptionMonth]);

  useEffect(() => {
    setDayDialogOpen(false);
    setSelectedDayYmd(null);
    setLastSelectedDayYmd(null);
    setAddMode(null);
    setAddTitle('');
    setAddSubtitle('');
    setDayOrderFormMode(null);
    setDayOrderEditingId(null);
    setAddonFormAccordionOpen(true);
    setMilkAddonDraft(null);
    setAddonRemoveTarget(null);
    setAddonAddBlockedDialogOpen(false);
  }, [customerId]);

  useEffect(() => {
    if (dayOrderFormMode === 'add' || dayOrderFormMode === 'edit') {
      setAddonFormAccordionOpen(true);
    }
  }, [dayOrderFormMode]);

  // Read through refs: a refetch (new `dayOrders.lines` / product list / customer object) must not re-initialise —
  // and so wipe — the add-on draft being edited. The draft is initialised only when the form opens or switches line.
  const dayOrderLinesRef = useRef(dayOrders.lines);
  dayOrderLinesRef.current = dayOrders.lines;
  const adminProductsRef = useRef(adminProducts);
  adminProductsRef.current = adminProducts;
  const customerRef = useRef(c);
  customerRef.current = c;
  const hasCustomer = !!c;

  useEffect(() => {
    const cust = customerRef.current;
    if (!cust || dayOrderFormMode === null) {
      setMilkAddonDraft(null);
      return;
    }
    const dt = cust.deliveryTime ?? 'Morning';
    const fq = cust.subscriptionFrequency ?? 'Daily';
    if (dayOrderFormMode === 'add') {
      setMilkAddonDraft(emptyMilkLineDraftForPicker(dt, fq));
      return;
    }
    if (dayOrderFormMode === 'edit' && dayOrderEditingId) {
      const line = dayOrderLinesRef.current.find((l) => l.id === dayOrderEditingId);
      if (!line) {
        setMilkAddonDraft(null);
        return;
      }
      const prod = adminProductsRef.current.find((p) => p.name === line.productName);
      const up = prod ? effectiveUnitPrice(prod) : 0;
      setMilkAddonDraft({
        ...emptyMilkLineDraftForPicker(dt, fq),
        productName: line.productName,
        quantityLabel: line.quantityLabel,
        unitType: line.unitType,
        numberOfItems: line.quantity,
        originalPrice: up,
        discountedPrice: 0,
        effectiveFinalPrice: up,
      });
    }
  }, [dayOrderFormMode, dayOrderEditingId, hasCustomer]);

  const todayYmd = todayYmdLocal();

  const calendarCells = useMemo(() => {
    // The same day rules as the customer's My days and the run sheet: a skipped day has no subscription dot.
    const hasProfile = (ymd: string) => (c ? plannedLinesOn(c, ymd).length > 0 : false);
    const hasExtra = (ymd: string) => dayOrders.lines.some((l) => l.dateYmd === ymd);
    return buildCalendarCells(subscriptionMonth, todayYmd, hasProfile, hasExtra);
  }, [c, subscriptionMonth, todayYmd, dayOrders.lines]);

  const selectedDayEditability = c && selectedDayYmd ? dayEditability(c, selectedDayYmd, 'admin') : null;
  const selectedDayEditable = !!selectedDayEditability?.editable;

  /** Adds or changes an add-on with the rules the customer app uses; the dairy is not held to the evening cut-off. */
  async function saveAddOn(input: { id?: string; dateYmd: string; productName: string; quantityLabel: string; quantity: number }) {
    if (!c) return;
    setAddOnError(null);
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    const product = (products.data?.items ?? []).find((p) => norm(p.name) === norm(input.productName));
    if (!product) throw new Error(strings('subscriptionEditor').tab.productGone);
    const pack = productPacks(product).find((p) => norm(p.label) === norm(input.quantityLabel));
    if (!pack) throw new Error(strings('subscriptionEditor').tab.pickPackSize(product.name));

    const existing = input.id ? (c.extraOrders ?? []).find((o) => o.id === input.id) : undefined;
    const isSamePack = (o: { productName: string; quantityLabel: string; packId?: string }) =>
      norm(o.productName) === norm(product.name) && (o.packId ? o.packId === pack.id : norm(o.quantityLabel) === norm(pack.label));

    let extraOrders: NonNullable<CustomerResponse['extraOrders']>;
    if (existing && isSamePack(existing)) {
      extraOrders = setAddOnItems(c, existing.id, input.quantity, { actor: 'admin' }).extraOrders;
    } else {
      const base = existing ? { ...c, extraOrders: cancelAddOnOrder(c, existing.id, { actor: 'admin' }).extraOrders } : c;
      // One row per product and pack a day, as in the customer app: adding the same pack again adds to it.
      const open = findPendingAddOn(base, input.dateYmd, product.name, pack);
      extraOrders = open
        ? setAddOnItems(base, open.id, addOnItemCount(open) + input.quantity, { actor: 'admin' }).extraOrders
        : placeAddOnOrder(base, { product, pack, numberOfItems: input.quantity, dateYmd: input.dateYmd, actor: 'admin', offers: offers.all }).extraOrders;
    }

    await updateCustomer.mutateAsync({ id: c.id, data: { extraOrders } });
    notifyOrderPlaced({
      customerId: c.id,
      customerName: c.name,
      by: 'admin',
      deliveryBoyId: c.assignedDeliveryBoyId,
      itemLabel: addOnLabel({ productName: product.name, quantityLabel: pack.label, numberOfItems: input.quantity }),
      dateYmd: input.dateYmd,
      extraOrders,
    });
  }

  async function removeAddOn(orderId: string) {
    if (!c) return;
    setAddOnError(null);
    const { extraOrders, order } = cancelAddOnOrder(c, orderId, { actor: 'admin' });
    if (!order) return;
    await updateCustomer.mutateAsync({ id: c.id, data: { extraOrders } });
    notifyOrderCancelled({
      customerId: c.id,
      customerName: c.name,
      by: 'admin',
      deliveryBoyId: c.assignedDeliveryBoyId,
      itemLabel: addOnLabel(order),
      dateYmd: addOnDateYmd(order),
      extraOrders,
    });
  }

  const resetDayOrderForm = () => {
    setDayOrderFormMode(null);
    setDayOrderEditingId(null);
    setAddonFormAccordionOpen(true);
    setMilkAddonDraft(null);
  };

  const openDay = (ymd: string) => {
    startTransition(() => {
      setSelectedDayYmd(ymd);
      setLastSelectedDayYmd(ymd);
      setDayDialogOpen(true);
      setAddMode(null);
      setAddTitle('');
      setAddSubtitle('');
      setAddonFormAccordionOpen(true);
      setAddOnError(null);
      resetDayOrderForm();
    });
  };

  const closeDayDialog = () => {
    setDayDialogOpen(false);
    setSelectedDayYmd(null);
    setAddMode(null);
    setAddTitle('');
    setAddSubtitle('');
    setAddonFormAccordionOpen(true);
    setAddonRemoveTarget(null);
    setAddonAddBlockedDialogOpen(false);
    resetDayOrderForm();
  };

  const profilePlansForSelectedDay = useMemo(() => {
    if (!selectedDayYmd || !c?.subscriptionPlans) return [];
    return c.subscriptionPlans.filter((p) => subscriptionPlanActiveOnDateYmd(p, selectedDayYmd));
  }, [c?.subscriptionPlans, selectedDayYmd]);

  const hasSubscriptionLinesOnSelectedDay = profilePlansForSelectedDay.length > 0;

  const dayOrderLinesForSelectedDay = useMemo(() => {
    if (!selectedDayYmd) return [];
    return dayOrders.lines.filter((l) => l.dateYmd === selectedDayYmd);
  }, [dayOrders.lines, selectedDayYmd]);

  const dayOrderLinesForLastSelectedDay = useMemo(() => {
    if (!lastSelectedDayYmd) return [];
    return dayOrders.lines.filter((l) => l.dateYmd === lastSelectedDayYmd);
  }, [dayOrders.lines, lastSelectedDayYmd]);

  const monthAddonLines = useMemo(() => {
    return dayOrders.lines
      .filter((l) => l.dateYmd.slice(0, 7) === subscriptionMonth)
      .slice()
      .sort((a, b) => (a.dateYmd === b.dateYmd ? a.productName.localeCompare(b.productName) : a.dateYmd.localeCompare(b.dateYmd)));
  }, [dayOrders.lines, subscriptionMonth]);

  const dailyExamples = useMemo(
    () => pickDailySubscriptionExamples(c?.subscriptionPlans, c?.subscription),
    [c?.subscriptionPlans, c?.subscription],
  );

  // Scoped to the selected month so the amounts reconcile with that month's bill.
  const subscriptionHistoryRows = useMemo(
    () => (c ? buildCustomerSubscriptionHistoryRows(c, [], subscriptionMonth) : []),
    [c, subscriptionMonth],
  );

  const subscriptionHistoryTotal = useMemo(
    () => subscriptionHistoryRows.reduce((sum, r) => sum + Math.max(0, Number(r.calculatedAmount ?? 0)), 0),
    [subscriptionHistoryRows],
  );

  // The whole month as planned: each line within its own dates, after the customer's skips and quantity changes,
  // plus one-off orders — the same day amounts the customer sees on My days.
  const estimatedMonthlyTotal = useMemo(() => (c ? estimateMonthTotal(c, subscriptionMonth) : 0), [c, subscriptionMonth]);

  const plansWithPause = useMemo(
    () => (c?.subscriptionPlans ?? []).filter((p) => p.pauseStartDate || p.pauseReason || p.pauseEndDate || p.resumeDate),
    [c],
  );

  const titleColor = scheme === 'dark' ? 'white' : COLORS.text;
  const gapMain = isTablet ? 10 : isDesktop ? 14 : 12;

  const { height: winH } = useWindowDimensions();
  // Window-capped dialog widths (16px gutter on phones) + viewport max height; replaces Paper's default margin.
  const daySheetDialogStyle = useResponsiveDialogStyle(600);
  const monthPickerDialogStyle = useResponsiveDialogStyle(480);
  const confirmDialogStyle = useResponsiveDialogStyle(420);
  // Header (~90px) + footer (~60px) sit outside the scroll area: keep the whole sheet inside the viewport.
  const daySheetScrollMaxH = Math.max(160, Math.min(Math.round(winH * 0.72), winH - 200));
  const monthPickerScrollMaxH = Math.max(180, Math.min(Math.round(winH * 0.5), winH - 200));

  if (!c) {
    return (
      <View style={[styles.root, { gap: gapMain }]}>
        <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
          <Card.Content>
            <Text variant="bodyMedium" style={textSub}>
              {t.tab.loading}
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const calendarLegend = (
    <Text variant="bodySmall" style={textSub}>
      {t.tab.calendarLegend}
    </Text>
  );

  const mainColumn = (
    <View style={[styles.mainCol, { gap: gapMain }]}>
      <CustomerSubscriptionPlansEditor
        customer={c}
        customerId={customerId}
        variant="tactile"
        month={subscriptionMonth}
        onMonthChange={setSubscriptionMonth}
      />

      <CustomerSubscriptionHistoryCards
        rows={subscriptionHistoryRows}
        monthLabel={monthLabel(subscriptionMonth)}
        monthTotal={subscriptionHistoryTotal}
      />

      <SubscriptionTactileSection
        title={t.tab.productSubscriptionTitle}
        subtitle={
          monthIsControlled
            ? t.tab.productSubscriptionSubtitleShared(monthLabel(subscriptionMonth))
            : t.tab.productSubscriptionSubtitle(monthLabel(subscriptionMonth))
        }
      >
        <SubscriptionTactileCard>
          {monthIsControlled ? null : (
            <SubscriptionMonthPickerBar
              monthLabelText={monthLabel(subscriptionMonth)}
              // The label above already names the month; this line says what tapping it does.
              monthKeyText={t.tab.tapToChangeMonth}
              prevDisabled={prevDisabled}
              nextDisabled={nextDisabled}
              onPrev={() => setSubscriptionMonth(shiftMonth(subscriptionMonth, -1))}
              onNext={() => setSubscriptionMonth(shiftMonth(subscriptionMonth, 1))}
              onOpenPicker={() => setPickerOpen(true)}
            />
          )}
          <SubscriptionMonthCalendarGrid
            monthYyyyMm={subscriptionMonth}
            cells={calendarCells}
            textMain={textMain}
            textSub={textSub}
            onPressDay={openDay}
            isDark={scheme === 'dark'}
            selectedDayYmd={lastSelectedDayYmd}
            legendFooter={calendarLegend}
          />
        </SubscriptionTactileCard>
      </SubscriptionTactileSection>

      <SubscriptionTactileSection
        title={t.tab.addOnsTitle}
        subtitle={t.tab.addOnsSubtitle(monthLabel(subscriptionMonth))}
      >
        {monthAddonLines.length ? (
          <View style={styles.cardGrid}>
            {monthAddonLines.map((l) => {
              // The price saved with the order — what the bill charges, even if the catalogue price moved since.
              const pricePerDelivery = l.price;
              const amount = Math.round(pricePerDelivery * Math.max(0, Number(l.quantity ?? 0)));
              return (
                <View
                  key={l.id}
                  style={[
                    styles.mobileProductCard,
                    styles.gridCard,
                    {
                      borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.12)' : dairyTactileColors.outlineVariant,
                      backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.04)' : dairyTactileColors.surfaceContainerLowest,
                    },
                  ]}
                >
                  <Text variant="labelLarge" style={[textMain, styles.bold]} numberOfLines={2}>
                    {l.productName}
                  </Text>
                  <Kv
                    label={t.fields.packSize}
                    value={l.unitType ? `${l.quantityLabel} (${l.unitType})` : l.quantityLabel}
                    textMain={textMain}
                    textSub={textSub}
                  />
                  <Kv label={t.fields.qty} value={String(l.quantity)} textMain={textMain} textSub={textSub} />
                  <Kv label={t.fields.pricePerDelivery} value={money(pricePerDelivery)} textMain={textMain} textSub={textSub} />
                  <Kv label={common.fields.amount} value={money(amount)} textMain={textMain} textSub={textSub} />
                  <Kv label={common.dates.date} value={formatDay(l.dateYmd, { weekday: true })} textMain={textMain} textSub={textSub} />
                  <Kv
                    label={common.fields.status}
                    value={t.tab.addOnStatusLine(
                      l.status === 'Delivered' ? common.states.delivered : t.tab.toDeliver,
                      l.placedBy === 'admin' ? t.tab.byDairy : t.tab.byCustomer,
                    )}
                    textMain={textMain}
                    textSub={textSub}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <SubscriptionEmptyBox message={t.tab.noAddOns(monthLabel(subscriptionMonth))} />
        )}
      </SubscriptionTactileSection>

      {onViewDetailedBill ? (
        <SubscriptionBillingFooter
          estimatedTotalLabel={money(estimatedMonthlyTotal)}
          billingCycleLabel={subscriptionBillingCycleLabel(subscriptionMonth)}
          onViewDetailedBill={onViewDetailedBill}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {mainColumn}

      <Portal>
        <CustomerSubscriptionDaySheet
          visible={dayDialogOpen}
          onClose={closeDayDialog}
          selectedDayYmd={selectedDayYmd}
          profilePlans={profilePlansForSelectedDay}
          addonLines={dayOrderLinesForSelectedDay}
          hasSubscriptionLines={hasSubscriptionLinesOnSelectedDay}
          maxWidth={daySheetDialogStyle.width}
          scrollMaxHeight={daySheetScrollMaxH}
          addonFormActive={dayOrderFormMode !== null || !selectedDayEditable}
          onEditAddon={(lineId) => {
            setDayOrderFormMode('edit');
            setDayOrderEditingId(lineId);
            setAddMode(null);
          }}
          onRemoveAddon={(lineId, productName) => setAddonRemoveTarget({ id: lineId, productName })}
          addonSectionFooter={
            <>
            {addOnError ? (
              <Text variant="bodySmall" style={styles.addOnError} accessibilityLiveRegion="polite">
                {addOnError}
              </Text>
            ) : null}
            {selectedDayEditability && !selectedDayEditability.editable ? (
              <Text variant="bodySmall" style={textSub}>
                {t.tab.lockedDay(selectedDayEditability.reason)}
              </Text>
            ) : null}
            {dayOrderFormMode && milkAddonDraft ? (
              <View style={styles.addOnFormAccordionCard}>
                <Pressable
                  onPress={() => setAddonFormAccordionOpen((o) => !o)}
                  style={({ pressed }) => [
                    styles.addOnFormAccordionHeader,
                    pressed && styles.pressed,
                    addonFormAccordionOpen && styles.addOnFormAccordionHeaderOpen,
                  ]}
                >
                  <Text variant="labelLarge" style={[textMain, styles.bold]}>
                    {dayOrderFormMode === 'add' ? t.tab.addAddOnProduct : t.tab.editAddOnProduct}
                  </Text>
                  <MaterialCommunityIcons
                    name={addonFormAccordionOpen ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={scheme === 'dark' ? 'white' : COLORS.text}
                  />
                </Pressable>
                {addonFormAccordionOpen ? (
                  <View style={styles.addOnFormAccordionBody}>
                    {!dayAddonProducts.length ? (
                      <Text variant="bodySmall" style={textSub}>
                        {t.tab.noActiveProducts}
                      </Text>
                    ) : (
                      <MilkSubscriptionLineCompactFields
                        products={dayAddonProducts}
                        draft={milkAddonDraft}
                        onPatch={(patch) => setMilkAddonDraft((d) => (d ? { ...d, ...patch } : d))}
                        autoOpenProductPicker={dayOrderFormMode === 'add'}
                        productFilter={() => true}
                        productFieldLabel={common.fields.product}
                        productPickerTitle={t.tab.selectProduct}
                        scheme={scheme}
                        textMain={textMain}
                        textSub={textSub}
                      />
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Button
                        mode="contained"
                        disabled={!dayAddonProducts.length || !milkLineHasPackComplete(milkAddonDraft, dayAddonProducts)}
                        onPress={async () => {
                          if (!selectedDayYmd || !milkAddonDraft) return;
                          if (!milkLineHasPackComplete(milkAddonDraft, dayAddonProducts)) return;
                          const q = Math.max(1, Math.min(999, Math.floor(Number(milkAddonDraft.numberOfItems ?? 1))));
                          try {
                            await saveAddOn({
                              id: dayOrderFormMode === 'edit' ? dayOrderEditingId ?? undefined : undefined,
                              dateYmd: selectedDayYmd,
                              productName: milkAddonDraft.productName.trim(),
                              quantityLabel: milkAddonDraft.quantityLabel.trim(),
                              quantity: q,
                            });
                            resetDayOrderForm();
                          } catch (e) {
                            setAddOnError(e instanceof Error && e.message ? e.message : t.tab.couldNotSave);
                          }
                        }}
                      >
                        {t.tab.saveLine}
                      </Button>
                      <Button mode="outlined" onPress={resetDayOrderForm}>
                        {common.actions.cancel}
                      </Button>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <DaySheetAddAddonButton
                disabled={!dayAddonProducts.length || !selectedDayEditable}
                onPress={() => {
                  setAddOnError(null);
                  setDayOrderFormMode('add');
                  setDayOrderEditingId(null);
                  setAddMode(null);
                }}
              />
            )}
            </>
          }
        />
        <Dialog
          visible={pickerOpen}
          onDismiss={() => setPickerOpen(false)}
          style={[styles.subscriptionDialogSurface, monthPickerDialogStyle]}
        >
          <Dialog.Title>{t.tab.monthPickerTitle}</Dialog.Title>
          <Dialog.Content style={[styles.subscriptionDialogContent, { maxHeight: monthPickerScrollMaxH }]}>
            <ScrollView
              style={{ maxHeight: monthPickerScrollMaxH }}
              contentContainerStyle={{ paddingBottom: 12 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'android' ? { persistentScrollbar: true } : {})}
            >
              {subscriptionMonthOptions.map((m) => {
                const selected = m === subscriptionMonth;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setSubscriptionMonth(m);
                      setPickerOpen(false);
                    }}
                    style={({ pressed }) => [styles.monthPickRow, pressed && styles.pressed]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyLarge" style={textMain}>
                        {monthLabel(m)}
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
            <Button onPress={() => setPickerOpen(false)}>{common.actions.close}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={addonRemoveTarget !== null}
          onDismiss={() => setAddonRemoveTarget(null)}
          style={[styles.subscriptionDialogSurface, confirmDialogStyle]}
        >
          <Dialog.Title>{t.tab.removeAddOnTitle}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={textMain}>
              {addonRemoveTarget ? t.tab.removeAddOnBody(addonRemoveTarget.productName) : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddonRemoveTarget(null)}>{common.actions.cancel}</Button>
            <Button
              textColor={scheme === 'dark' ? '#FCA5A5' : '#B91C1C'}
              onPress={async () => {
                const target = addonRemoveTarget;
                if (!target) return;
                if (dayOrderEditingId === target.id) resetDayOrderForm();
                setAddonRemoveTarget(null);
                try {
                  await removeAddOn(target.id);
                } catch (e) {
                  setAddOnError(e instanceof Error && e.message ? e.message : t.tab.couldNotRemove);
                }
              }}
            >
              {common.actions.remove}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

export const CustomerSubscriptionTab = memo(CustomerSubscriptionTabInner);

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: '100%' },
  addOnError: { color: dairyTactileColors.error, fontWeight: '700' },
  mainCol: { width: '100%', maxWidth: '100%' },
  subscriptionDialogSurface: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  subscriptionDialogContent: {
    paddingHorizontal: 0,
  },
  daySheetScrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 16,
    flexGrow: 1,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    ...platformShadow({ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }),
  },
  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
  bold: { fontWeight: '900' },
  sectionTitle: { marginBottom: 8 },
  cardInner: { gap: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  kvLabel: { flex: 0.42, minWidth: 0 },
  kvValue: { flex: 0.58, textAlign: 'right' },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, marginBottom: 4 },
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
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  flexTable: { width: '100%', maxWidth: '100%' },
  flexTr: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.22)', paddingVertical: 8, gap: 4 },
  flexHeader: { backgroundColor: 'rgba(148,163,184,0.10)', paddingVertical: 10, borderBottomWidth: 1 },
  flexTh: { flex: 1, minWidth: 0, fontWeight: '900', fontSize: 10 },
  flexTd: { flex: 1, minWidth: 0, fontSize: 11 },
  miniChip: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  cardStack: { gap: 10 },
  // Add-on cards: 1 per row on phones/tablet portrait, 2–4 per row on wide screens.
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: '100%' },
  mobileProductCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(148,163,184,0.06)',
    padding: 12,
    gap: 4,
  },
  mobileProductTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  subPauseCard: { padding: 10, borderRadius: 12, borderWidth: 1, marginTop: 8, gap: 4 },
  addOnProductRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(148,163,184,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  addOnProductRowText: { flex: 1, minWidth: 0, gap: 2 },
  addOnProductRowActions: { flexDirection: 'row', flexShrink: 0, alignItems: 'center' },
  addOnFormAccordionCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    overflow: 'hidden',
  },
  addOnFormAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  addOnFormAccordionHeaderOpen: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.30)',
  },
  addOnFormAccordionBody: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionsGridMobile: { flexDirection: 'column' },
  btnFull: { alignSelf: 'stretch', width: '100%' },
  baseSubscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  daySheetSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  dayStoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.35)',
  },
});
