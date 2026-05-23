import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { MilkSubscriptionLineCompactFields } from '@/src/components/admin/MilkSubscriptionLineCompactFields';
import {
  emptyMilkLineDraftForPicker,
  isMilkCatalogProduct,
  milkLineHasPackComplete,
} from '@/src/components/admin/milkSubscriptionLineUi';
import type { CustomerResponse, CustomerSubscriptionPlanDto } from '@/src/domain/customers/dtos';
import {
  buildSubscriptionMonthOptions,
  monthLabel,
  formatSubscriptionPlanAsOrderExample,
  pickDailySubscriptionExamples,
  planLineTotal,
  shiftMonth,
  subscriptionPlanActiveOnDateYmd,
  subscriptionPlanShowsInCalendarMonth,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { buildCustomerSubscriptionHistoryRows } from '@/src/components/admin/buildCustomerSubscriptionHistoryRows';
import { CustomerSubscriptionHistoryTable } from '@/src/components/admin/CustomerSubscriptionHistoryTable';
import { CustomerSubscriptionPlansEditor } from '@/src/components/admin/CustomerSubscriptionPlansEditor';
import { buildCalendarCells, SubscriptionMonthCalendarGrid } from '@/src/components/admin/SubscriptionMonthCalendarGrid';
import {
  useCustomerDailyProductOrders,
  useCustomerSubscriptionCalendar,
} from '@/src/hooks/customers';
import { useProducts } from '@/src/hooks/products';

const COLORS = {
  primary: '#2563EB',
  accent: '#22C55E',
  text: '#1E293B',
};

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function money(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

function subscriptionStatusTone(status: string): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'Active':
    case 'Paid':
      return { bg: 'rgba(34,197,94,0.14)', fg: '#166534', border: 'rgba(34,197,94,0.22)' };
    case 'Paused':
    case 'Pending':
    case 'Partial':
      return { bg: 'rgba(245,158,11,0.16)', fg: '#92400E', border: 'rgba(245,158,11,0.30)' };
    case 'Advance Paid':
      return { bg: 'rgba(37,99,235,0.14)', fg: '#1D4ED8', border: 'rgba(37,99,235,0.22)' };
    case 'Expired':
    case 'Inactive':
      return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
    case 'Cancelled':
      return { bg: 'rgba(239,68,68,0.14)', fg: '#B91C1C', border: 'rgba(239,68,68,0.22)' };
    default:
      return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
  }
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

function SectionTitle({ children, textMain }: { children: ReactNode; textMain: object }) {
  return (
    <Text variant="titleSmall" style={[styles.bold, textMain, styles.sectionTitle]}>
      {children}
    </Text>
  );
}

/** Desktop / tablet: flex row table — no horizontal page scroll */
function ProductFlexTable({
  plans,
  textMain,
  textSub,
}: {
  plans: CustomerSubscriptionPlanDto[];
  textMain: object;
  textSub: object;
}) {
  const header = ['Product', 'Qty', 'Unit', 'Price', 'Discount', 'Final', 'Frequency', 'Status', 'Tag'];
  return (
    <View style={styles.flexTable}>
      <View style={[styles.flexTr, styles.flexHeader]}>
        {header.map((h) => (
          <Text key={h} variant="labelSmall" style={[styles.flexTh, textSub]} numberOfLines={2}>
            {h}
          </Text>
        ))}
      </View>
      {plans.map((p, i) => (
        <View key={`${p.productName}_${i}`} style={styles.flexTr}>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
            {p.productName}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
            {String(p.numberOfItems ?? 1)}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
            {p.quantityLabel}
            {p.unitType ? `\n(${p.unitType})` : ''}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
            {money(p.originalPrice)}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
            {p.discountedPrice ? money(p.discountedPrice) : '—'}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
            {money(planLineTotal(p))}
          </Text>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
            {p.frequency}
          </Text>
          <View style={styles.flexTd}>
            {(() => {
              const tone = subscriptionStatusTone(p.status);
              return (
                <View style={[styles.miniChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <Text variant="labelSmall" style={{ color: tone.fg, fontWeight: '800', fontSize: 10 }} numberOfLines={1}>
                    {p.status}
                  </Text>
                </View>
              );
            })()}
          </View>
          <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
            {p.productAdditionTag ?? 'Regular'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ProductMobileCard({ p, textMain, textSub }: { p: CustomerSubscriptionPlanDto; textMain: object; textSub: object }) {
  const tone = subscriptionStatusTone(p.status);
  return (
    <View style={styles.mobileProductCard}>
      <View style={styles.mobileProductTop}>
        <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
          {p.productName}
        </Text>
        <View style={[styles.miniChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text variant="labelSmall" style={{ color: tone.fg, fontWeight: '800' }}>
            {p.status}
          </Text>
        </View>
      </View>
      <Kv label="Quantity" value={String(p.numberOfItems ?? 1)} textMain={textMain} textSub={textSub} />
      <Kv label="Unit" value={p.unitType ? `${p.quantityLabel} (${p.unitType})` : p.quantityLabel} textMain={textMain} textSub={textSub} />
      <Kv label="Price" value={money(p.originalPrice)} textMain={textMain} textSub={textSub} />
      <Kv label="Discount" value={p.discountedPrice ? money(p.discountedPrice) : '—'} textMain={textMain} textSub={textSub} />
      <Kv label="Final cost" value={money(planLineTotal(p))} textMain={textMain} textSub={textSub} />
      <Kv label="Delivery frequency" value={p.frequency} textMain={textMain} textSub={textSub} />
      <Kv label="Temporary / permanent" value={p.productAdditionTag ?? 'Regular'} textMain={textMain} textSub={textSub} />
    </View>
  );
}

function placeholderAlert(title: string) {
  Alert.alert(title, 'This action will connect to subscription workflows when the backend is wired.');
}

function todayYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function entryKindLabel(kind: string): string {
  switch (kind) {
    case 'subscription_line':
      return 'Subscription';
    case 'add_on_product':
      return 'Add-on';
    case 'base_online_catalog':
      return 'Base';
    default:
      return kind;
  }
}

export type CustomerSubscriptionTabProps = {
  customer: CustomerResponse | null | undefined;
  customerId: string;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  scheme: 'light' | 'dark' | null | undefined;
};

export function CustomerSubscriptionTab({
  customer: c,
  customerId,
  isMobile,
  isTablet,
  isDesktop,
  scheme,
}: CustomerSubscriptionTabProps) {
  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [subscriptionMonth, setSubscriptionMonth] = useState(monthKey);
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

  const calendar = useCustomerSubscriptionCalendar(customerId);
  const dayOrders = useCustomerDailyProductOrders(customerId);
  const products = useProducts();

  const sectionCard = scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  const adminProducts = useMemo(() => (products.data?.items ?? []).filter((p) => p.isActive), [products.data?.items]);
  const milkCatalogAll = useMemo(() => adminProducts.filter(isMilkCatalogProduct), [adminProducts]);
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

  const subscriptionPlansForMonth = useMemo((): CustomerSubscriptionPlanDto[] => {
    const plans = c?.subscriptionPlans ?? [];
    return plans.filter((p) => subscriptionPlanShowsInCalendarMonth(subscriptionMonth, p));
  }, [c?.subscriptionPlans, subscriptionMonth]);

  const oldestMonth = subscriptionMonthOptions[subscriptionMonthOptions.length - 1] ?? monthKey;
  const prevDisabled = subscriptionMonth <= oldestMonth;
  const nextDisabled = subscriptionMonth >= monthKey;

  useEffect(() => {
    setSubscriptionMonth(monthKey);
  }, [customerId, monthKey]);

  useEffect(() => {
    if (!subscriptionMonthOptions.length) return;
    if (!subscriptionMonthOptions.includes(subscriptionMonth)) {
      setSubscriptionMonth(subscriptionMonthOptions[0]!);
    }
  }, [subscriptionMonthOptions, subscriptionMonth]);

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

  useEffect(() => {
    if (!c || dayOrderFormMode === null) {
      setMilkAddonDraft(null);
      return;
    }
    const dt = c.deliveryTime ?? 'Morning';
    const fq = c.subscriptionFrequency ?? 'Daily';
    if (dayOrderFormMode === 'add') {
      setMilkAddonDraft(emptyMilkLineDraftForPicker(dt, fq));
      return;
    }
    if (dayOrderFormMode === 'edit' && dayOrderEditingId) {
      const line = dayOrders.lines.find((l) => l.id === dayOrderEditingId);
      if (!line) {
        setMilkAddonDraft(null);
        return;
      }
    const prod = adminProducts.find((p) => p.name === line.productName);
      const up = Number(prod?.price ?? 0);
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
  }, [adminProducts, c?.id, c?.deliveryTime, c?.subscriptionFrequency, dayOrderFormMode, dayOrderEditingId, dayOrders.lines]);

  const todayYmd = todayYmdLocal();

  const calendarCells = useMemo(() => {
    const plans = c?.subscriptionPlans ?? [];
    const hasProfile = (ymd: string) => plans.some((p) => subscriptionPlanActiveOnDateYmd(p, ymd));
    const hasExtra = (ymd: string) =>
      calendar.entries.some(
        (e) => e.dateYmd === ymd && (e.kind === 'subscription_line' || e.kind === 'add_on_product'),
      ) || dayOrders.lines.some((l) => l.dateYmd === ymd);
    return buildCalendarCells(subscriptionMonth, todayYmd, hasProfile, hasExtra);
  }, [c?.subscriptionPlans, subscriptionMonth, todayYmd, calendar.entries, dayOrders.lines]);

  const resetDayOrderForm = () => {
    setDayOrderFormMode(null);
    setDayOrderEditingId(null);
    setAddonFormAccordionOpen(true);
    setMilkAddonDraft(null);
  };

  const openDay = (ymd: string) => {
    setSelectedDayYmd(ymd);
    setLastSelectedDayYmd(ymd);
    setDayDialogOpen(true);
    setAddMode(null);
    setAddTitle('');
    setAddSubtitle('');
    setAddonFormAccordionOpen(true);
    resetDayOrderForm();
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

  const storedForSelectedDay = useMemo(() => {
    if (!selectedDayYmd) return [];
    return calendar.entries.filter((e) => e.dateYmd === selectedDayYmd);
  }, [calendar.entries, selectedDayYmd]);

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

  const subscriptionHistoryRows = useMemo(
    () => (c ? buildCustomerSubscriptionHistoryRows(c, dayOrders.ready ? dayOrders.lines : []) : []),
    [c, dayOrders.ready, dayOrders.lines],
  );

  const plansWithPause = useMemo(
    () => (c?.subscriptionPlans ?? []).filter((p) => p.pauseStartDate || p.pauseReason || p.pauseEndDate || p.resumeDate),
    [c],
  );

  const titleColor = scheme === 'dark' ? 'white' : COLORS.text;
  const gapMain = isTablet ? 10 : isDesktop ? 14 : 12;

  const { width: winW, height: winH } = useWindowDimensions();
  const subscriptionDialogMaxW = Math.max(260, Math.min(winW - 24, 600));
  const daySheetScrollMaxH = Math.max(200, Math.min(Math.round(winH * 0.72), winH - 140));
  const monthPickerScrollMaxH = Math.max(180, Math.min(Math.round(winH * 0.5), winH - 200));

  if (!c) {
    return (
      <View style={[styles.root, { gap: gapMain }]}>
        <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
          <Card.Content>
            <Text variant="bodyMedium" style={textSub}>
              Loading subscription…
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const mainColumn = (
    <View style={[styles.mainCol, { gap: gapMain }]}>
      <CustomerSubscriptionPlansEditor customer={c} customerId={customerId} />
      <CustomerSubscriptionHistoryTable
        rows={subscriptionHistoryRows}
        isMobile={isMobile}
        scheme={scheme}
        textMain={textMain}
        textSub={textSub}
        sectionCardStyle={[styles.sectionCard, sectionCard]}
      />
      <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
        <Card.Content style={styles.cardInner}>
          <SectionTitle textMain={textMain}>Product subscription</SectionTitle>
          <Text variant="bodySmall" style={textSub}>
            Month-wise view: only plans that overlap {monthLabel(subscriptionMonth)} ({subscriptionMonth}). Last six steps from today, not before
            subscription start. Tap the month to pick another; pause-only months may show no rows.
          </Text>
          <View style={styles.monthNavRow}>
            <Pressable
              disabled={prevDisabled}
              onPress={() => setSubscriptionMonth(shiftMonth(subscriptionMonth, -1))}
              style={({ pressed }) => [styles.monthNavBtn, prevDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={titleColor} />
            </Pressable>
            <Pressable onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.monthNavCenter, pressed && styles.pressed]}>
              <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                {monthLabel(subscriptionMonth)}
              </Text>
              <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                {subscriptionMonth}
              </Text>
            </Pressable>
            <Pressable
              disabled={nextDisabled}
              onPress={() => setSubscriptionMonth(shiftMonth(subscriptionMonth, 1))}
              style={({ pressed }) => [styles.monthNavBtn, nextDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={titleColor} />
            </Pressable>
          </View>
          {!calendar.ready || !dayOrders.ready ? (
            <Text variant="bodySmall" style={[textSub, { marginTop: 6 }]}>
              Loading calendar…
            </Text>
          ) : null}
          <SubscriptionMonthCalendarGrid
            monthYyyyMm={subscriptionMonth}
            cells={calendarCells}
            textMain={textMain}
            textSub={textSub}
            onPressDay={openDay}
            isDark={scheme === 'dark'}
          />
          <Text variant="labelLarge" style={[textMain, styles.bold, { marginTop: 10 }]}>
            Orders / deliveries (from selected dates)
          </Text>
          <Text variant="bodySmall" style={[textSub, { marginBottom: 8 }]}>
            Shows all add-on products saved in {monthLabel(subscriptionMonth)}.
          </Text>
          {monthAddonLines.length ? (
            isMobile ? (
              <View style={styles.cardStack}>
                {monthAddonLines.map((l) => {
                  const prod = adminProducts.find((p) => p.name === l.productName);
                  const pricePerDelivery = Number(prod?.price ?? 0);
                  const amount = Math.round(Math.max(0, pricePerDelivery) * Math.max(0, Number(l.quantity ?? 0)));
                  return (
                    <View
                      key={l.id}
                      style={[
                        styles.mobileProductCard,
                        {
                          borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.35)',
                          backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(148,163,184,0.06)',
                        },
                      ]}
                    >
                      <Text variant="labelLarge" style={[textMain, styles.bold]} numberOfLines={2}>
                        {l.productName}
                      </Text>
                      <Kv
                        label="Pack / size"
                        value={l.unitType ? `${l.quantityLabel} (${l.unitType})` : l.quantityLabel}
                        textMain={textMain}
                        textSub={textSub}
                      />
                      <Kv label="Qty" value={String(l.quantity)} textMain={textMain} textSub={textSub} />
                      <Kv label="Price / delivery" value={money(pricePerDelivery)} textMain={textMain} textSub={textSub} />
                      <Kv label="Ordered issue date" value={fmtDate(l.createdAtIso)} textMain={textMain} textSub={textSub} />
                      <Kv label="Order date" value={fmtDate(l.dateYmd)} textMain={textMain} textSub={textSub} />
                      <Kv label="Delivered (last)" value="—" textMain={textMain} textSub={textSub} />
                      <Kv label="Qty delivered" value="0" textMain={textMain} textSub={textSub} />
                      <Kv label="Times" value="0" textMain={textMain} textSub={textSub} />
                      <Kv label="Amount" value={money(amount)} textMain={textMain} textSub={textSub} />
                    </View>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                <View style={styles.flexTable}>
                  <View style={[styles.flexTr, styles.flexHeader]}>
                    {[
                      'Product',
                      'Pack / size',
                      'Qty',
                      'Price / delivery',
                      'Ordered issue date',
                      'Order date',
                      'Delivered (last)',
                      'Qty delivered',
                      'Times',
                      'Amount',
                    ].map((h, i) => (
                      <Text
                        key={h}
                        variant="labelSmall"
                        style={[styles.flexTh, i === 0 ? { flex: 1.4 } : null, textSub]}
                        numberOfLines={2}
                      >
                        {h}
                      </Text>
                    ))}
                  </View>
                  {monthAddonLines.map((l) => {
                    const prod = adminProducts.find((p) => p.name === l.productName);
                    const pricePerDelivery = Number(prod?.price ?? 0);
                    const amount = Math.round(Math.max(0, pricePerDelivery) * Math.max(0, Number(l.quantity ?? 0)));
                    return (
                      <View key={l.id} style={styles.flexTr}>
                        <Text variant="bodySmall" style={[styles.flexTd, { flex: 1.4 }, textMain]} numberOfLines={2}>
                          {l.productName}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={2}>
                          {l.quantityLabel}
                          {l.unitType ? ` (${l.unitType})` : ''}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          {String(l.quantity)}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          {money(pricePerDelivery)}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          {fmtDate(l.createdAtIso)}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          {fmtDate(l.dateYmd)}
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          —
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          0
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain]} numberOfLines={1}>
                          0
                        </Text>
                        <Text variant="bodySmall" style={[styles.flexTd, textMain, styles.bold]} numberOfLines={1}>
                          {money(amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )
          ) : (
            <Text variant="bodySmall" style={textSub}>
              No add-on products saved in {monthLabel(subscriptionMonth)}.
            </Text>
          )}
        </Card.Content>
      </Card>

    </View>
  );

  return (
    <View style={styles.root}>
      {mainColumn}

      <Portal>
        <Dialog
          visible={dayDialogOpen}
          onDismiss={closeDayDialog}
          style={[styles.subscriptionDialogSurface, { maxWidth: subscriptionDialogMaxW, width: subscriptionDialogMaxW }]}
        >
          <Dialog.Title>{selectedDayYmd ? fmtDate(selectedDayYmd) : 'Day'}</Dialog.Title>
          <Dialog.Content style={[styles.subscriptionDialogContent, { maxHeight: daySheetScrollMaxH }]}>
            <ScrollView
              style={{ maxHeight: daySheetScrollMaxH }}
              contentContainerStyle={styles.daySheetScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'android' ? { persistentScrollbar: true } : {})}
            >
              <Text variant="bodySmall" style={textSub}>
                Tap a date to see subscription lines active that day. You can add new add-on products only when that section lists at least one line; you can
                still edit or remove add-ons already saved for the date.
              </Text>
              <View style={[styles.daySheetSection, { borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(37,99,235,0.14)' }]}>
                <Text variant="labelLarge" style={[textMain, styles.bold]}>
                  Subscription products on this date
                </Text>
                <Text variant="bodySmall" style={[textSub, { marginBottom: 6 }]}>
                  All subscription lines that are active on {selectedDayYmd ? fmtDate(selectedDayYmd) : 'this day'}.
                </Text>
                {profilePlansForSelectedDay.length ? (
                  profilePlansForSelectedDay.map((p, i) => (
                    <Text key={`${p.productName}_${i}`} variant="bodySmall" style={[textMain, styles.bold, { marginTop: 4 }]}>
                      · {formatSubscriptionPlanAsOrderExample(p)} · {p.frequency} · {p.status}
                    </Text>
                  ))
                ) : (
                  <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                    No active subscription line on this date.
                  </Text>
                )}
              </View>
              <View style={[styles.daySheetSection, { borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(37,99,235,0.14)' }]}>
                <Text variant="labelLarge" style={[textMain, styles.bold]}>
                  Add-on products (this date)
                </Text>
                {dayOrderLinesForSelectedDay.length ? (
                  dayOrderLinesForSelectedDay.map((line) => (
                    <View key={line.id} style={styles.addOnProductRow}>
                      <View style={styles.addOnProductRowText}>
                        <Text variant="bodyMedium" style={[styles.bold, textMain]} numberOfLines={2}>
                          {line.productName}
                        </Text>
                        <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                          {line.quantityLabel}
                          {line.unitType ? ` (${line.unitType})` : ''} · Qty {line.quantity}
                        </Text>
                      </View>
                      <View style={styles.addOnProductRowActions}>
                        <Button
                          mode="text"
                          compact
                          disabled={dayOrderFormMode !== null}
                          onPress={() => {
                            setDayOrderFormMode('edit');
                            setDayOrderEditingId(line.id);
                            setAddMode(null);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          mode="text"
                          compact
                          disabled={dayOrderFormMode !== null}
                          onPress={() =>
                            setAddonRemoveTarget({ id: line.id, productName: line.productName })
                          }
                        >
                          Delete
                        </Button>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text variant="bodySmall" style={[textSub, { marginTop: 4 }]}>
                    {hasSubscriptionLinesOnSelectedDay
                      ? 'No add-on products saved for this date yet. Add products below (no start/end date needed).'
                      : 'No add-on products yet. Add subscription lines for this date above first, then use Add add-on product.'}
                  </Text>
                )}
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
                        {dayOrderFormMode === 'add' ? 'Add add-on product' : 'Edit add-on product'}
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
                            No active products in the catalogue. Add products under Admin Products first.
                          </Text>
                        ) : (
                          <MilkSubscriptionLineCompactFields
                            products={dayAddonProducts}
                            draft={milkAddonDraft}
                            onPatch={(patch) => setMilkAddonDraft((d) => (d ? { ...d, ...patch } : d))}
                            autoOpenProductPicker={dayOrderFormMode === 'add'}
                            productFilter={() => true}
                            productFieldLabel="Product"
                            productPickerTitle="Select product"
                            scheme={scheme}
                            textMain={textMain}
                            textSub={textSub}
                          />
                        )}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Button
                            mode="contained"
                            disabled={!dayAddonProducts.length || !milkLineHasPackComplete(milkAddonDraft, milkCatalogAll)}
                            onPress={async () => {
                              if (!selectedDayYmd || !milkAddonDraft) return;
                              if (dayOrderFormMode === 'add' && !hasSubscriptionLinesOnSelectedDay) {
                                setAddonAddBlockedDialogOpen(true);
                                return;
                              }
                              if (!milkLineHasPackComplete(milkAddonDraft, milkCatalogAll)) return;
                              const q = Math.max(1, Math.min(999, Math.floor(Number(milkAddonDraft.numberOfItems ?? 1))));
                              try {
                                await dayOrders.upsert({
                                  id: dayOrderFormMode === 'edit' ? dayOrderEditingId ?? undefined : undefined,
                                  dateYmd: selectedDayYmd,
                                  productName: milkAddonDraft.productName.trim(),
                                  quantityLabel: milkAddonDraft.quantityLabel.trim(),
                                  unitType: milkAddonDraft.unitType?.trim() || undefined,
                                  quantity: q,
                                });
                                resetDayOrderForm();
                              } catch (e) {
                                Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
                              }
                            }}
                          >
                            Save line
                          </Button>
                          <Button mode="outlined" onPress={resetDayOrderForm}>
                            Cancel
                          </Button>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Button
                    mode="outlined"
                    style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    icon="plus"
                    disabled={hasSubscriptionLinesOnSelectedDay && !dayAddonProducts.length}
                    onPress={() => {
                      if (!hasSubscriptionLinesOnSelectedDay) {
                        setAddonAddBlockedDialogOpen(true);
                        return;
                      }
                      setDayOrderFormMode('add');
                      setDayOrderEditingId(null);
                      setAddMode(null);
                    }}
                  >
                    Add add-on product
                  </Button>
                )}
              </View>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDayDialog}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={pickerOpen}
          onDismiss={() => setPickerOpen(false)}
          style={[styles.subscriptionDialogSurface, { maxWidth: subscriptionDialogMaxW, width: subscriptionDialogMaxW }]}
        >
          <Dialog.Title>Product subscription month</Dialog.Title>
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
            <Button onPress={() => setPickerOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={addonRemoveTarget !== null}
          onDismiss={() => setAddonRemoveTarget(null)}
          style={[styles.subscriptionDialogSurface, { maxWidth: Math.min(subscriptionDialogMaxW, 420), width: '100%' }]}
        >
          <Dialog.Title>Remove add-on?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={textMain}>
              {addonRemoveTarget
                ? `“${addonRemoveTarget.productName}” will be removed for this date only.`
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddonRemoveTarget(null)}>Cancel</Button>
            <Button
              textColor={scheme === 'dark' ? '#FCA5A5' : '#B91C1C'}
              onPress={() => {
                const target = addonRemoveTarget;
                if (!target) return;
                void dayOrders.remove(target.id);
                if (dayOrderEditingId === target.id) resetDayOrderForm();
                setAddonRemoveTarget(null);
              }}
            >
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={addonAddBlockedDialogOpen}
          onDismiss={() => setAddonAddBlockedDialogOpen(false)}
          style={[styles.subscriptionDialogSurface, { maxWidth: Math.min(subscriptionDialogMaxW, 420), width: '100%' }]}
        >
          <Dialog.Title>Subscription required</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={textMain}>
              There are no subscription products on this date. Add or adjust lines in the Product subscription section so this day shows at least one active
              line under “Subscription products on this date”, then you can add add-on products.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddonAddBlockedDialogOpen(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: '100%' },
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
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(148,163,184,0.06)',
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
