import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { Button, Card, Dialog, Portal, Snackbar, Text, TextInput } from 'react-native-paper';

import { CustomerSubscriptionTab } from '@/src/components/admin/CustomerSubscriptionTab';
import {
  buildCalendarCells,
  type DeliveryDayTone,
  type DeliveryToneSurfaces,
  SubscriptionMonthCalendarGrid,
} from '@/src/components/admin/SubscriptionMonthCalendarGrid';
import {
  buildSubscriptionMonthOptions,
  computeSubscriptionBillingTotalForMonth,
  monthLabel,
  planLineTotal,
  shiftMonth,
  subscriptionPlanActiveOnDateYmd,
  subscriptionPlanWinsDeliveryAttributionAtYmd,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { useCustomer } from '@/src/hooks/customers';
import { useCustomerDailyProductOrders } from '@/src/hooks/customers/useCustomerDailyProductOrders';
import { useUpdateCustomer } from '@/src/hooks/customers/useCustomers';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useProducts } from '@/src/hooks/products/useProducts';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

/** Delivery tab — calendar colors + rgba/hex reference for admins (see legend under the grid). */
const ADMIN_DELIVERY_CALENDAR = {
  tones: {
    empty: {
      title: 'Yellow — no product order',
      meaning: 'No subscription line and no add-on on this date (day total ₹0).',
      codes: 'Fill rgba(234, 179, 8, 0.22) · Border rgba(202, 138, 4, 0.50) · Hue #EAB308',
      light: { backgroundColor: 'rgba(234, 179, 8, 0.22)', borderColor: 'rgba(202, 138, 4, 0.50)' },
      dark: { backgroundColor: 'rgba(234, 179, 8, 0.18)', borderColor: 'rgba(250, 204, 21, 0.45)' },
    },
    pending: {
      title: 'Grey — not marked',
      meaning: 'Orders exist; delivery not marked yet.',
      codes: 'Light fill #F8FAFC · Dark fill rgba(15, 23, 42, 0.55) · Border slate rgba(100, 116, 139, 0.42)',
      light: { backgroundColor: 'rgba(248, 250, 252, 0.95)', borderColor: 'rgba(100, 116, 139, 0.42)' },
      dark: { backgroundColor: 'rgba(15, 23, 42, 0.55)', borderColor: 'rgba(148, 163, 184, 0.38)' },
    },
    delivered: {
      title: 'Green — delivered',
      meaning: 'Marked Delivered for that day’s lines.',
      codes: 'Fill rgba(34, 197, 94, 0.22) · Border rgba(22, 163, 74, 0.55) · Hue #22C55E',
      light: { backgroundColor: 'rgba(34, 197, 94, 0.22)', borderColor: 'rgba(22, 163, 74, 0.55)' },
      dark: { backgroundColor: 'rgba(34, 197, 94, 0.24)', borderColor: 'rgba(74, 222, 128, 0.42)' },
    },
    missed: {
      title: 'Red — not delivered',
      meaning: 'Marked Not delivered for that day’s lines.',
      codes: 'Fill rgba(239, 68, 68, 0.18) · Border rgba(220, 38, 38, 0.50) · Hue #EF4444',
      light: { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderColor: 'rgba(220, 38, 38, 0.50)' },
      dark: { backgroundColor: 'rgba(239, 68, 68, 0.22)', borderColor: 'rgba(252, 165, 165, 0.40)' },
    },
  },
} as const;

const ADMIN_DELIVERY_LEGEND_ORDER: DeliveryDayTone[] = ['empty', 'pending', 'delivered', 'missed'];

function adminDeliveryToneSurfaces(): DeliveryToneSurfaces {
  const t = ADMIN_DELIVERY_CALENDAR.tones;
  return {
    empty: { light: t.empty.light, dark: t.empty.dark },
    pending: { light: t.pending.light, dark: t.pending.dark },
    delivered: { light: t.delivered.light, dark: t.delivered.dark },
    missed: { light: t.missed.light, dark: t.missed.dark },
  };
}

const ADMIN_DELIVERY_SURFACES = adminDeliveryToneSurfaces();

type TabKey =
  | 'overview'
  | 'subscription'
  | 'billing'
  | 'paymentHistory'
  | 'deliveryHistory'
  | 'complaints'
  ;

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatIso(iso: string | undefined): string {
  return fmtDate(iso);
}

function money(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
}

function newDeliveryId(): string {
  return `del_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function newPaymentId(): string {
  return `pay_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function billPaymentTag(monthYyyyMm: string) {
  return `Bill payment for ${monthYyyyMm}`;
}

function daysInMonth(yyyyMm: string): number {
  const m = yyyyMm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 31;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return new Date(y, mo, 0).getDate();
}

function ymdsForMonth(yyyyMm: string): string[] {
  const dim = daysInMonth(yyyyMm);
  const out: string[] = [];
  for (let d = 1; d <= dim; d += 1) out.push(`${yyyyMm}-${String(d).padStart(2, '0')}`);
  return out;
}

function lastDayYmdForMonth(yyyyMm: string): string {
  const dim = daysInMonth(yyyyMm);
  return `${yyyyMm}-${String(dim).padStart(2, '0')}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtYmd(ymd: string): string {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function badgeTone(status: string): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'Paid':
    case 'Delivered':
    case 'Active':
    case 'Advance Paid':
      return { bg: 'rgba(34,197,94,0.14)', fg: '#166534', border: 'rgba(34,197,94,0.22)' };
    case 'Partial':
    case 'Pending':
    case 'Paused':
      return { bg: 'rgba(245,158,11,0.16)', fg: '#92400E', border: 'rgba(245,158,11,0.30)' };
    case 'Expired':
      return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
    case 'Inactive':
    case 'Missed':
    case 'Cancelled':
      return { bg: 'rgba(239,68,68,0.14)', fg: '#B91C1C', border: 'rgba(239,68,68,0.22)' };
    default:
      return { bg: 'rgba(148,163,184,0.16)', fg: '#475569', border: 'rgba(148,163,184,0.22)' };
  }
}

function TabPill({
  label,
  active,
  onPress,
  pillSizeStyle,
  textSizeStyle,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  pillSizeStyle: object;
  textSizeStyle: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        active ? styles.tabPillActive : styles.tabPillInactive,
        styles.tabPillBase,
        pillSizeStyle,
        pressed && styles.pressed,
      ]}
    >
      <Text variant="labelLarge" style={[active ? styles.tabTextActive : styles.tabTextInactive, textSizeStyle]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function TableScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
      {children}
    </ScrollView>
  );
}

function TableRow({
  cells,
  header,
}: {
  cells: Array<{ text: string; grow?: boolean; lines?: number; tone?: { bg: string; fg: string; border: string } }>;
  header?: boolean;
}) {
  return (
    <View style={[styles.tableRow, header ? styles.tableHeader : null]}>
      {cells.map((c, idx) => (
        <View key={idx} style={[styles.cell, c.grow && styles.cellGrow]}>
          {c.tone ? (
            <View style={[styles.chip, { backgroundColor: c.tone.bg, borderColor: c.tone.border }]}>
              <Text variant="labelSmall" style={{ color: c.tone.fg, fontWeight: '800' }}>
                {c.text}
              </Text>
            </View>
          ) : (
            <Text
              variant={header ? 'labelSmall' : 'bodySmall'}
              style={header ? styles.tableHeaderText : styles.tableBodyText}
              numberOfLines={c.lines ?? (header ? 2 : 1)}
            >
              {c.text}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export default function AdminCustomerDetailDashboard() {
  const scheme = useColorScheme();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const customer = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const products = useProducts();
  const deliveryBoys = useDeliveryBoys();
  const [tab, setTab] = useState<TabKey>('overview');
  const dailyOrders = useCustomerDailyProductOrders(id);

  const c = customer.data;
  const title = c?.name ?? 'Customer';

  const sectionCard = scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight;
  const textMain = scheme === 'dark' ? styles.textOnDark : styles.textOnLight;
  const textSub = scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight;

  const summary = useMemo(() => {
    const deliveryBoyId = (c as any)?.assignedDeliveryBoyId as string | undefined;
    const deliveryBoy = deliveryBoyId ? (deliveryBoys.data?.items ?? []).find((x) => x.id === deliveryBoyId) ?? null : null;
    return {
      name: c?.name ?? '—',
      mobile: c?.mobile ?? '—',
      address: c ? (c.societyName?.trim() ? `${c.societyName}, ${c.address}` : c.address) : '—',
      status: c?.status ?? '—',
      deliveryTime: c?.deliveryTime ?? '—',
      currentBill: money(c?.monthlyBillAmount),
      pending: money(c?.pendingAmount ?? 0),
      nextDueDate: fmtDate(c?.nextDueDate),
      lastPayment: fmtDate(c?.lastPaymentDate),
      assignedDeliveryBoy: deliveryBoy?.fullName ?? c?.assignedDeliveryBoyName ?? '—',
      routeName: deliveryBoy?.primaryRouteName ?? c?.routeName ?? '—',
      paymentType: (c as any)?.paymentType ?? '—',
      startDate: c?.subscriptionStartDate ? formatIso(c.subscriptionStartDate) : '—',
      endDate: c?.subscriptionEndDate ? formatIso(c.subscriptionEndDate) : '—',
    };
  }, [c, deliveryBoys.data?.items]);

  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const deliveryMonthOptions = useMemo(
    () => buildSubscriptionMonthOptions(c?.subscriptionStartDate, monthKey),
    [c?.subscriptionStartDate, monthKey],
  );
  const [deliveryMonth, setDeliveryMonth] = useState<string>(monthKey);
  const isDeliveryNextDisabled = useMemo(() => deliveryMonth >= monthKey, [deliveryMonth, monthKey]);
  const isDeliveryPrevDisabled = useMemo(
    () => deliveryMonthOptions.length > 0 && deliveryMonth <= deliveryMonthOptions[deliveryMonthOptions.length - 1]!,
    [deliveryMonth, deliveryMonthOptions],
  );
  const [deliverySelectedDayYmd, setDeliverySelectedDayYmd] = useState<string | null>(null);

  const billingMonthOptions = useMemo(() => buildSubscriptionMonthOptions(c?.subscriptionStartDate, monthKey), [c?.subscriptionStartDate, monthKey]);
  const [billingMonth, setBillingMonth] = useState<string>(monthKey);
  const isBillingNextDisabled = useMemo(() => billingMonth >= monthKey, [billingMonth, monthKey]);
  const isBillingPrevDisabled = useMemo(
    () => billingMonthOptions.length > 0 && billingMonth <= billingMonthOptions[billingMonthOptions.length - 1]!,
    [billingMonth, billingMonthOptions],
  );

  const paymentMonthOptions = billingMonthOptions;
  const [paymentMonth, setPaymentMonth] = useState<string>(monthKey);
  const isPaymentNextDisabled = useMemo(() => paymentMonth >= monthKey, [paymentMonth, monthKey]);
  const isPaymentPrevDisabled = useMemo(
    () => paymentMonthOptions.length > 0 && paymentMonth <= paymentMonthOptions[paymentMonthOptions.length - 1]!,
    [paymentMonth, paymentMonthOptions],
  );

  const adminPaymentModeOptions = useMemo(() => ['Cash', 'UPI', 'Bank', 'Other'] as const, []);
  const customerDefaultPaymentMode = useMemo(() => {
    const pref = String((c as any)?.preferredPaymentMode ?? '').trim();
    if (adminPaymentModeOptions.includes(pref as any)) return pref as (typeof adminPaymentModeOptions)[number];
    // Customer side should not use Cash; default to UPI when unknown.
    return 'UPI' as (typeof adminPaymentModeOptions)[number];
  }, [adminPaymentModeOptions, c]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<(typeof adminPaymentModeOptions)[number]>('UPI');
  const [paymentModeDialogOpen, setPaymentModeDialogOpen] = useState(false);
  const [paymentModeDialogContext, setPaymentModeDialogContext] = useState<null | { month: string; pendingAmount: number }>(null);
  const [paymentDialogPayKind, setPaymentDialogPayKind] = useState<'full' | 'partial'>('full');
  const [paymentDialogPartialAmount, setPaymentDialogPartialAmount] = useState<string>('');
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
  }, []);

  const [complaintActionDialogOpen, setComplaintActionDialogOpen] = useState(false);
  const [complaintActionTargetId, setComplaintActionTargetId] = useState<string | null>(null);
  const [complaintActionStatus, setComplaintActionStatus] = useState<'Open' | 'In Progress' | 'Resolved' | 'Closed'>('Open');
  const [complaintActionNote, setComplaintActionNote] = useState('');

  useEffect(() => {
    setSelectedPaymentMode(customerDefaultPaymentMode);
  }, [customerDefaultPaymentMode, paymentMonth]);

  const shouldComputeBillingUi = tab === 'billing';
  const shouldComputePaymentUi = tab === 'paymentHistory';
  const shouldComputeBillingTimeline = shouldComputeBillingUi || shouldComputePaymentUi;

  // Defer heavy billing-related inputs so typing / tab switches stay responsive;
  // the billing loops recompute when the main thread is idle.
  const deferredDailyOrderLines = useDeferredValue(dailyOrders.lines);
  const deferredCustomer = useDeferredValue(c);

  const billingSubscriptionTotal = useMemo(() => {
    if (!deferredCustomer) return 0;
    if (!shouldComputeBillingUi) return 0;
    return computeSubscriptionBillingTotalForMonth(
      billingMonth,
      (deferredCustomer.subscriptionPlans ?? []) as any[],
      deferredDailyOrderLines as any[],
      (deferredCustomer.deliveries ?? []) as any[],
    );
  }, [deferredCustomer, billingMonth, deferredDailyOrderLines, shouldComputeBillingUi]);

  const billingDiscount = useMemo(() => Math.max(0, Number(c?.discountAmount ?? 0)), [c?.discountAmount]);

  const billingTimeline = useMemo(() => {
    if (!deferredCustomer) return [];
    if (!shouldComputeBillingTimeline) return [];

    const monthsDesc = billingMonthOptions.length ? billingMonthOptions : [monthKey];
    const monthsAsc = monthsDesc.slice().reverse();

    // Payments are applied FIFO to the oldest outstanding bill to keep Billing + Payments consistent.
    const payments = [...(deferredCustomer.payments ?? [])]
      .map((p) => ({
        date: String((p as any).paymentDate ?? ''),
        amount: Math.max(0, Number((p as any).amountPaid ?? 0)),
      }))
      .filter((p) => p.amount > 0 && p.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    let payIdx = 0;
    let payRemaining = payments[0]?.amount ?? 0;

    const out: Array<{
      month: string;
      billCalcDateYmd: string;
      dueDateYmd: string;
      baseAmount: number;
      carryForwardIn: number;
      invoiceTotal: number;
      paidApplied: number;
      pending: number;
      status: 'Paid' | 'Partial' | 'Pending';
    }> = [];

    let carry = 0;
    for (const m of monthsAsc) {
      const base = Math.max(
        0,
        Math.round(
          computeSubscriptionBillingTotalForMonth(
            m,
            (deferredCustomer.subscriptionPlans ?? []) as any[],
            deferredDailyOrderLines as any[],
            (deferredCustomer.deliveries ?? []) as any[],
          ) - billingDiscount,
        ),
      );
      const billCalcDateYmd = lastDayYmdForMonth(m);
      const dueDateYmd = addDaysYmd(billCalcDateYmd, 45);
      const invoiceTotal = Math.max(0, Math.round(base + carry));

      let paidApplied = 0;
      let pending = invoiceTotal;
      while (pending > 0 && payIdx < payments.length) {
        if (payRemaining <= 0) {
          payIdx += 1;
          payRemaining = payments[payIdx]?.amount ?? 0;
          continue;
        }
        const used = Math.min(pending, payRemaining);
        paidApplied += used;
        pending -= used;
        payRemaining -= used;
      }

      const status: 'Paid' | 'Partial' | 'Pending' = pending <= 0 && paidApplied > 0 ? 'Paid' : paidApplied > 0 ? 'Partial' : 'Pending';
      out.push({
        month: m,
        billCalcDateYmd,
        dueDateYmd,
        baseAmount: base,
        carryForwardIn: Math.round(carry),
        invoiceTotal,
        paidApplied: Math.round(paidApplied),
        pending: Math.round(Math.max(0, pending)),
        status,
      });

      carry = Math.round(Math.max(0, pending));
    }

    return out.reverse(); // keep newest-first for UI (matches month options)
  }, [billingDiscount, billingMonthOptions, deferredCustomer, deferredDailyOrderLines, monthKey, shouldComputeBillingTimeline]);

  const billingSummaryForSelectedMonth = useMemo(() => {
    const row = billingTimeline.find((x) => x.month === billingMonth);
    if (!row) {
      const billCalcDateYmd = lastDayYmdForMonth(billingMonth);
      return {
        billCalcDateYmd,
        dueDateYmd: addDaysYmd(billCalcDateYmd, 45),
        baseAmount: 0,
        carryForwardIn: 0,
        invoiceTotal: 0,
        paidApplied: 0,
        pending: 0,
        status: 'Pending' as const,
      };
    }
    return row;
  }, [billingMonth, billingTimeline]);

  const paymentSummaryForSelectedMonth = useMemo(() => {
    const row = billingTimeline.find((x) => x.month === paymentMonth);
    if (!row) {
      const billCalcDateYmd = lastDayYmdForMonth(paymentMonth);
      return {
        month: paymentMonth,
        billCalcDateYmd,
        dueDateYmd: addDaysYmd(billCalcDateYmd, 45),
        baseAmount: 0,
        carryForwardIn: 0,
        invoiceTotal: 0,
        paidApplied: 0,
        pending: 0,
        status: 'Pending' as const,
      };
    }
    return row;
  }, [billingTimeline, paymentMonth]);

  const paymentsForSelectedMonth = useMemo(() => {
    if (!shouldComputePaymentUi) return [];
    const mm = paymentMonth;
    const tag = billPaymentTag(mm);
    return [...(c?.payments ?? [])]
      .filter((p) => {
        const notes = String((p as any).notes ?? '');
        if (notes.startsWith(tag)) return true;
        // fallback for older payments without bill tag
        return String(p.paymentDate ?? '').slice(0, 7) === mm;
      })
      .sort((a, b) => String(b.paymentDate ?? '').localeCompare(String(a.paymentDate ?? '')));
  }, [c?.payments, paymentMonth, shouldComputePaymentUi]);

  const paymentHistoryRowsForSelectedMonth = useMemo(() => {
    if (!shouldComputePaymentUi) return [];
    const mm = paymentMonth;
    const tag = billPaymentTag(mm);
    const billRow = billingTimeline.find((x) => x.month === mm);
    const startingDue = Math.max(0, Math.round(billRow?.invoiceTotal ?? 0));

    const payments = paymentsForSelectedMonth
      .filter((p) => String((p as any).notes ?? '').startsWith(tag) || String(p.paymentDate ?? '').slice(0, 7) === mm)
      .slice()
      .sort((a, b) => String(a.paymentDate ?? '').localeCompare(String(b.paymentDate ?? '')));

    const unpaidEvents = [...((c as any)?.audit ?? [])]
      .filter((a: any) => String(a?.action ?? '').includes(`Payment marked unpaid for ${mm}`))
      .map((a: any) => ({
        id: String(a.id ?? `audit_${mm}_${String(a.date ?? '')}`),
        createdAt: String(a.date ?? ''),
      }));

    let runningDue = startingDue;
    const paymentRows = payments.map((p) => {
      const prevDue = Math.max(0, Math.round(runningDue));
      const paid = Math.max(0, Math.round(Number(p.amountPaid ?? 0)));
      const adjusted = Math.min(prevDue, paid);
      const remaining = Math.max(0, Math.round(prevDue - paid));
      const advanceAdded = Math.max(0, Math.round(paid - prevDue));
      const status = remaining <= 0 && adjusted > 0 ? 'Paid' : adjusted > 0 ? 'Partial' : 'Pending';
      runningDue = remaining;
      return {
        id: p.id,
        createdAtIso: String(p.createdAt ?? p.paymentDate ?? ''),
        paymentDate: fmtDate(p.paymentDate),
        paymentAmount: money(p.amountPaid),
        paymentMode: p.paymentMode ?? '—',
        transactionId: p.transactionId ?? '—',
        collectedBy: p.collectedBy ?? '—',
        billingPeriod: `${monthLabel(mm)} (${mm})`,
        paymentStatus: status === 'Pending' ? 'Unpaid' : status,
        previousDueAmount: money(prevDue),
        amountAdjusted: money(adjusted),
        remainingDueAmount: money(remaining),
        advanceAmountAdded: money(advanceAdded),
        paymentNotes: p.notes ?? '—',
        receiptNumber: '—',
        createdBy: p.collectedBy ?? '—',
        createdAt: fmtDateTime(String(p.createdAt ?? p.paymentDate ?? '')),
      };
    });

    const unpaidRows = unpaidEvents.map((a) => ({
      id: a.id,
      createdAtIso: a.createdAt,
      paymentDate: fmtDate(a.createdAt),
      paymentAmount: '—',
      paymentMode: '—',
      transactionId: '—',
      collectedBy: '—',
      billingPeriod: `${monthLabel(mm)} (${mm})`,
      paymentStatus: 'Unpaid',
      previousDueAmount: money(startingDue),
      amountAdjusted: money(0),
      remainingDueAmount: money(startingDue),
      advanceAmountAdded: money(0),
      paymentNotes: `Payment marked unpaid for ${mm}`,
      receiptNumber: '—',
      createdBy: 'Admin',
      createdAt: fmtDateTime(a.createdAt),
    }));

    return [...paymentRows, ...unpaidRows].sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
  }, [billingTimeline, c, paymentMonth, paymentsForSelectedMonth, shouldComputePaymentUi]);

  const productPriceByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products.data?.items ?? []) {
      const base = Number((p as any)?.price ?? 0);
      const disc = Number((p as any)?.discountPrice ?? 0);
      const unit = disc > 0 && disc < base ? disc : base;
      if (p?.name) map.set(String(p.name).trim(), Math.max(0, unit));
    }
    return map;
  }, [products.data?.items]);

  const billingDeliveredProductRowsForMonth = useMemo(() => {
    if (!c) return [];
    if (!shouldComputeBillingUi) return [];
    const month = billingMonth;
    const deliveries = (c.deliveries ?? []).filter(
      (d) => d?.status === 'Delivered' && String(d.deliveryDate ?? '').slice(0, 7) === month,
    );

    const plans = c.subscriptionPlans ?? [];
    const addonLines = dailyOrders.lines ?? [];

    const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

    const rows = deliveries.map((d) => {
      const ymd = String(d.deliveryDate ?? '').slice(0, 10);
      const productName = String(d.productName ?? '').trim();
      const qtyLabel = String(d.quantityLabel ?? '').trim();

      const planIndex = plans.findIndex((p, idx) => {
        if (!p) return false;
        if (String(p.productName ?? '').trim() !== productName) return false;
        if (norm(p.quantityLabel) !== norm(qtyLabel)) return false;
        if (!subscriptionPlanActiveOnDateYmd(p as any, ymd)) return false;
        return subscriptionPlanWinsDeliveryAttributionAtYmd(idx, ymd, plans as any);
      });

      if (planIndex >= 0) {
        const plan = plans[planIndex]!;
        const qtyOrdered = Math.max(1, Math.floor(Number((plan as any).numberOfItems ?? 1)));
        const pricePerDelivery = Math.round(planLineTotal(plan as any));
        return {
          key: `sub_${ymd}_${productName}_${qtyLabel}_${planIndex}`,
          dateYmd: ymd,
          type: 'Subscription',
          productName,
          packSizeLabel: qtyLabel,
          qty: qtyOrdered,
          pricePerDelivery: money(pricePerDelivery),
          deliveredLast: fmtYmd(ymd),
          qtyDelivered: qtyOrdered,
          amount: money(pricePerDelivery),
        };
      }

      const line = addonLines.find(
        (l) =>
          String(l.dateYmd ?? '') === ymd &&
          String(l.productName ?? '').trim() === productName &&
          norm(l.quantityLabel) === norm(qtyLabel),
      );
      const qtyOrdered = Math.max(1, Math.floor(Number(line?.quantity ?? 1)));
      const unit = Math.max(0, Number(productPriceByName.get(productName) ?? 0));
      const amount = Math.round(unit * qtyOrdered);
      return {
        key: `add_${ymd}_${productName}_${qtyLabel}`,
        dateYmd: ymd,
        type: 'Add-on',
        productName,
        packSizeLabel: qtyLabel,
        qty: qtyOrdered,
        pricePerDelivery: money(unit),
        deliveredLast: fmtYmd(ymd),
        qtyDelivered: qtyOrdered,
        amount: money(amount),
      };
    });

    return rows.sort((a, b) =>
      a.dateYmd === b.dateYmd ? a.productName.localeCompare(b.productName) : a.dateYmd.localeCompare(b.dateYmd),
    );
  }, [billingMonth, c, dailyOrders.lines, productPriceByName, shouldComputeBillingUi]);

  const billingStatusForMonth = useMemo(() => billingSummaryForSelectedMonth.status, [billingSummaryForSelectedMonth.status]);

  const overviewBillingStatus = useMemo(() => {
    const pending = Math.max(0, Math.round(Number(c?.pendingAmount ?? 0)));
    const currentMonth = pending > 0 ? 'Pending' : 'Paid';
    return { lastMonth: '—', currentMonth } as const;
  }, [c?.pendingAmount]);

  function billCalcDateForMonth(yyyyMm: string): string {
    return fmtYmd(lastDayYmdForMonth(yyyyMm));
  }

  function dueDateForMonth(yyyyMm: string): string {
    const last = lastDayYmdForMonth(yyyyMm);
    return fmtYmd(addDaysYmd(last, 45));
  }

  const lastPaymentRecord = useMemo(() => {
    const list = [...(c?.payments ?? [])].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    );
    return list[0];
  }, [c]);

  const memoItems = useMemo(() => {
    const items: Array<{ when: string; who: 'Admin' | 'Customer' | 'Delivery' | 'System'; text: string; tone: { bg: string; fg: string; border: string } }> = [];
    for (const p of c?.payments ?? []) {
      items.push({
        when: fmtDate(p.paymentDate),
        who: 'Admin',
        text: `Payment received: ${money(p.amountPaid)} via ${p.paymentMode}${p.transactionId ? ` (${p.transactionId})` : ''}`,
        tone: { bg: 'rgba(37,99,235,0.14)', fg: '#1D4ED8', border: 'rgba(37,99,235,0.22)' },
      });
    }
    for (const a of c?.audit ?? []) {
      items.push({
        when: fmtDate(a.date),
        who: (a.updatedBy ?? 'Admin') === 'Customer' ? 'Customer' : 'Admin',
        text: a.action,
        tone: (a.updatedBy ?? 'Admin') === 'Customer'
          ? { bg: 'rgba(34,197,94,0.14)', fg: '#166534', border: 'rgba(34,197,94,0.22)' }
          : { bg: 'rgba(37,99,235,0.14)', fg: '#1D4ED8', border: 'rgba(37,99,235,0.22)' },
      });
    }
    // newest first (string dates are fine for mock UI)
    return items.slice(0, 30);
  }, [c]);

  // Responsive breakpoints (admin dashboard)
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const pagePadding = isMobile ? 12 : isTablet ? 14 : 16;
  const contentGap = isMobile ? 10 : 12;

  const deliveryDialogMaxW = useMemo(() => Math.max(240, Math.min(420, width - 20)), [width]);
  const deliveryDialogScrollMaxH = useMemo(() => Math.max(220, Math.min(Math.round(height * 0.52), height - 220)), [height]);

  const deliveryMonthDays = useMemo(() => ymdsForMonth(deliveryMonth), [deliveryMonth]);
  const deliveryAddonLinesForMonth = useMemo(
    () => (dailyOrders.lines ?? []).filter((l) => String(l.dateYmd).slice(0, 7) === deliveryMonth),
    [dailyOrders.lines, deliveryMonth],
  );

  const deliveryDayTotals = useMemo(() => {
    // Avoid heavy work unless Delivery tab is active or the delivery dialog is open.
    if (tab !== 'deliveryHistory' && !deliverySelectedDayYmd) return new Map<string, number>();
    if (!c) return new Map<string, number>();
    const plans = c.subscriptionPlans ?? [];
    const map = new Map<string, number>();
    for (const ymd of deliveryMonthDays) {
      const subTotal = plans
        .filter((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd))
        .reduce((s, p) => s + Math.round(planLineTotal(p as any)), 0);
      const addonTotal = deliveryAddonLinesForMonth
        .filter((l) => l.dateYmd === ymd)
        .reduce((s, l) => {
          const unit = productPriceByName.get(String(l.productName ?? '').trim()) ?? 0;
          const qty = Math.max(1, Math.floor(Number(l.quantity ?? 1)));
          return s + Math.round(unit * qty);
        }, 0);
      map.set(ymd, Math.round(subTotal + addonTotal));
    }
    return map;
  }, [c, deliveryAddonLinesForMonth, deliveryMonthDays, productPriceByName, tab, deliverySelectedDayYmd]);

  const deliveryStatusForDayYmd = useCallback((ymd: string): 'Delivered' | 'Not delivered' | 'Mixed' | '—' => {
    if (!c) return '—';
    const existing = (c.deliveries ?? []).filter((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd);
    const delivered = existing.some((d) => d.status === 'Delivered');
    const missed = existing.some((d) => d.status === 'Missed');
    if (delivered && !missed) return 'Delivered';
    if (missed && !delivered) return 'Not delivered';
    if (delivered && missed) return 'Mixed';
    return '—';
  }, [c]);

  const deliveryCalendarCells = useMemo(() => {
    if (tab !== 'deliveryHistory' && !deliverySelectedDayYmd) return [];
    const todayYmd = new Date().toISOString().slice(0, 10);
    const plans = c?.subscriptionPlans ?? [];
    const addonLines = dailyOrders.lines ?? [];
    const getTone = (ymd: string): DeliveryDayTone => {
      const total = deliveryDayTotals.get(ymd) ?? 0;
      if (total <= 0) return 'empty';
      const st = deliveryStatusForDayYmd(ymd);
      if (st === 'Delivered') return 'delivered';
      if (st === 'Not delivered') return 'missed';
      return 'pending';
    };
    return buildCalendarCells(
      deliveryMonth,
      todayYmd,
      (ymd) => plans.some((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd)),
      (ymd) => addonLines.some((l) => l.dateYmd === ymd),
      getTone,
    );
  }, [c?.subscriptionPlans, dailyOrders.lines, deliveryMonth, deliveryDayTotals, deliveryStatusForDayYmd, tab, deliverySelectedDayYmd]);

  const deliveryCalendarLegendFooter = useMemo(
    () => (
      <View style={styles.deliveryCalLegendWrap}>
        <Text variant="labelSmall" style={[styles.bold, textMain]}>
          Delivery calendar — color key
        </Text>
        {ADMIN_DELIVERY_LEGEND_ORDER.map((tone) => {
          const row = ADMIN_DELIVERY_CALENDAR.tones[tone];
          const sw = scheme === 'dark' ? row.dark : row.light;
          return (
            <View key={tone} style={styles.deliveryCalLegendRow}>
              <View style={[styles.deliveryCalSwatch, { backgroundColor: sw.backgroundColor, borderColor: sw.borderColor }]} />
              <View style={styles.deliveryCalLegendTextCol}>
                <Text variant="bodySmall" style={[styles.bold, textMain]} numberOfLines={2}>
                  {row.title}
                </Text>
                <Text variant="bodySmall" style={textSub} numberOfLines={4}>
                  {row.meaning}
                </Text>
                <Text
                  variant="labelSmall"
                  style={[textSub, styles.deliveryCalCodeLine, { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }]}
                  selectable
                >
                  {row.codes}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    ),
    [scheme, textMain, textSub],
  );

  const deliverySelectedDayModel = useMemo(() => {
    if (!c || !deliverySelectedDayYmd) return null;
    const ymd = deliverySelectedDayYmd;
    const plans = (c.subscriptionPlans ?? []).filter((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd));
    const addons = (dailyOrders.lines ?? []).filter((l) => l.dateYmd === ymd);
    const status = deliveryStatusForDayYmd(ymd);
    const total = Math.round(deliveryDayTotals.get(ymd) ?? 0);
    return { ymd, plans, addons, status, total };
  }, [c, dailyOrders.lines, deliveryDayTotals, deliverySelectedDayYmd, deliveryStatusForDayYmd]);

  async function setDeliveryStatusForDay(ymd: string, next: 'Delivered' | 'Missed') {
    if (!c) return;
    const now = new Date().toISOString();
    const plans = (c.subscriptionPlans ?? []).filter((p) => subscriptionPlanActiveOnDateYmd(p as any, ymd));
    const addons = (dailyOrders.lines ?? []).filter((l) => l.dateYmd === ymd);
    const wanted = [
      ...plans.map((p) => ({ productName: p.productName, quantityLabel: p.quantityLabel })),
      ...addons.map((a) => ({ productName: a.productName, quantityLabel: a.quantityLabel })),
    ];
    const prev = c.deliveries ?? [];
    const nextList = [...prev];
    for (const w of wanted) {
      const existingIdx = nextList.findIndex(
        (d) =>
          String(d.deliveryDate ?? '').slice(0, 10) === ymd &&
          String(d.productName ?? '').trim() === String(w.productName ?? '').trim() &&
          String(d.quantityLabel ?? '').trim() === String(w.quantityLabel ?? '').trim(),
      );
      const base = existingIdx >= 0 ? nextList[existingIdx]! : null;
      const row = {
        id: base?.id ?? newDeliveryId(),
        deliveryDate: ymd,
        productName: String(w.productName ?? '').trim(),
        quantityLabel: String(w.quantityLabel ?? '').trim(),
        deliveryBoyName: base?.deliveryBoyName,
        status: next,
        missedReason: next === 'Missed' ? base?.missedReason ?? 'Marked not delivered' : undefined,
        rescheduledDate: base?.rescheduledDate,
        notes: base?.notes,
        createdAt: base?.createdAt ?? now,
        updatedAt: now,
      };
      if (existingIdx >= 0) nextList[existingIdx] = row as any;
      else nextList.push(row as any);
    }
    await updateCustomer.mutateAsync({ id: c.id, data: { deliveries: nextList } });
  }

  const tabPillSizeStyle = isDesktop ? styles.tabPillH44 : isTablet ? styles.tabPillH40 : styles.tabPillH36;
  const tabTextSizeStyle = isDesktop ? styles.tabText14 : isTablet ? styles.tabText13 : styles.tabText12;

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight]}>
      <View
        style={[
          styles.appBar,
          scheme === 'dark' ? styles.appBarDark : styles.appBarLight,
          isMobile ? styles.appBarMobile : null,
          { paddingTop: headerPaddingTop },
        ]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
        </Pressable>

        <View style={[styles.headerMid, isMobile ? styles.headerMidMobile : null]}>
          <View style={styles.headerNameRow}>
            <Text variant="titleMedium" style={[styles.headerTitle, textMain]} numberOfLines={1}>
              {summary.name}
            </Text>
            {(() => {
              const t = badgeTone(summary.status);
              return (
                <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
                  <Text variant="labelSmall" style={{ color: t.fg, fontWeight: '800' }}>
                    {summary.status}
                  </Text>
                </View>
              );
            })()}
          </View>
          <Text variant="bodySmall" style={textSub} numberOfLines={1}>
            {summary.mobile}
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace({ pathname: '/(admin)/customers', params: { editId: id } })}
          style={({ pressed }) => [styles.editPill, sectionCard, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={scheme === 'dark' ? 'white' : COLORS.text} />
          <Text variant="labelLarge" style={textMain}>
            Edit
          </Text>
        </Pressable>
      </View>

      <View style={[styles.tabsBar, scheme === 'dark' ? styles.tabsBarDark : styles.tabsBarLight]}>
        {isTablet ? (
          <View style={[styles.tabsRowWrap, { gap: isMobile ? 6 : 8 }]}>
            <TabPill label="Overview" active={tab === 'overview'} onPress={() => startTransition(() => setTab('overview'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Subscription" active={tab === 'subscription'} onPress={() => startTransition(() => setTab('subscription'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Billing" active={tab === 'billing'} onPress={() => startTransition(() => setTab('billing'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Payments" active={tab === 'paymentHistory'} onPress={() => startTransition(() => setTab('paymentHistory'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Customer Delivery" active={tab === 'deliveryHistory'} onPress={() => startTransition(() => setTab('deliveryHistory'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Complaints" active={tab === 'complaints'} onPress={() => startTransition(() => setTab('complaints'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          </View>
        ) : (
          <ScrollView
            horizontal
            scrollEnabled={isMobile}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabsRowScroll, isMobile ? styles.tabsRowScrollMobile : null]}
          >
            <TabPill label="Overview" active={tab === 'overview'} onPress={() => startTransition(() => setTab('overview'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Subscription" active={tab === 'subscription'} onPress={() => startTransition(() => setTab('subscription'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Billing" active={tab === 'billing'} onPress={() => startTransition(() => setTab('billing'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Payments" active={tab === 'paymentHistory'} onPress={() => startTransition(() => setTab('paymentHistory'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Customer Delivery" active={tab === 'deliveryHistory'} onPress={() => startTransition(() => setTab('deliveryHistory'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
            <TabPill label="Complaints" active={tab === 'complaints'} onPress={() => startTransition(() => setTab('complaints'))} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          </ScrollView>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.container, { padding: pagePadding, gap: contentGap }]} showsVerticalScrollIndicator={false}>
        {tab === 'overview' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Overview
                </Text>
                <Text variant="bodySmall" style={textSub}>
                  Snapshot across Subscription, Billing, Payments, and Delivery.
                </Text>

                {(() => {
                  const lastMonthKey = shiftMonth(monthKey, -1);
                  const fmtPaidUnpaid = (s: string | undefined) => (s === 'Pending' ? 'Unpaid' : s ?? '—');
                  const appAccess = (c as any)?.appAccessEnabled !== false ? 'Allowed' : 'Blocked';

                  const overviewRows = [
                    { label: 'Full name', value: c?.name ?? '—', lines: 2 },
                    { label: 'Mobile number', value: c?.mobile ?? '—' },
                    { label: 'Alternate mobile number', value: c?.alternateMobile ?? '—' },
                    { label: 'App access', value: appAccess },
                    { label: 'Status', value: summary.status },
                    { label: 'Full address', value: summary.address, lines: 4 }, // wrap naturally
                    { label: 'Assigned delivery boy', value: summary.assignedDeliveryBoy, lines: 2 },
                    { label: 'Delivery route', value: summary.routeName, lines: 2 },
                    { label: 'Billing type', value: String((c as any)?.billingType ?? '—') },
                    { label: 'Subscription', value: c?.subscriptionStatus ?? '—' },
                    { label: `Billing (last month · ${monthLabel(lastMonthKey)})`, value: fmtPaidUnpaid(overviewBillingStatus.lastMonth) },
                    { label: `Billing (current month · ${monthLabel(monthKey)})`, value: fmtPaidUnpaid(overviewBillingStatus.currentMonth) },
                  ] as Array<{ label: string; value: string; lines?: number }>;

                  return (
                    isMobile ? (
                      <View style={{ gap: 8 }}>
                        {overviewRows.map((r) => (
                          <View key={r.label} style={[styles.overviewItemCard, sectionCard]}>
                            <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                              {r.label}
                            </Text>
                            <Text
                              variant="bodyMedium"
                              style={[styles.bold, textMain, isMobile ? { fontSize: 13, lineHeight: 18 } : null]}
                              numberOfLines={r.lines ?? 1}
                            >
                              {r.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.tableWrap}>
                        {isDesktop ? (
                          <View style={{ width: '100%', maxWidth: '100%' }}>
                            <TableRow header cells={[{ text: 'Field', grow: true }, { text: 'Value', grow: true }]} />
                            {overviewRows.map((r) => (
                              <TableRow
                                key={r.label}
                                cells={[
                                  { text: r.label, grow: true, lines: 2 },
                                  { text: r.value, grow: true, lines: r.lines ?? 1 },
                                ]}
                              />
                            ))}
                          </View>
                        ) : (
                          <TableScroll>
                            <View style={[styles.tableMin, { minWidth: 720 }]}>
                              <TableRow header cells={[{ text: 'Field', grow: true }, { text: 'Value', grow: true }]} />
                              {overviewRows.map((r) => (
                                <TableRow
                                  key={r.label}
                                  cells={[
                                    { text: r.label, grow: true, lines: 2 },
                                  { text: r.value, grow: true, lines: r.lines ?? 1 },
                                  ]}
                                />
                              ))}
                            </View>
                          </TableScroll>
                        )}
                      </View>
                    )
                  );
                })()}
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {tab === 'subscription' ? (
          <CustomerSubscriptionTab
            customer={c}
            customerId={id}
            isMobile={isMobile}
            isTablet={isTablet}
            isDesktop={isDesktop}
            scheme={scheme}
          />
        ) : null}

        {tab === 'billing' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Billing summary
                </Text>
                <View style={[styles.monthNavRow, { marginTop: 8, marginBottom: 10 }]}>
                  <Pressable
                    disabled={isBillingPrevDisabled}
                    onPress={() => setBillingMonth(shiftMonth(billingMonth, -1))}
                    style={({ pressed }) => [styles.monthNavBtn, isBillingPrevDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                  <View style={styles.monthNavCenter}>
                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                      {monthLabel(billingMonth)}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {billingMonth}
                    </Text>
                  </View>
                  <Pressable
                    disabled={isBillingNextDisabled}
                    onPress={() => setBillingMonth(shiftMonth(billingMonth, 1))}
                    style={({ pressed }) => [styles.monthNavBtn, isBillingNextDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                </View>
                <Text variant="bodySmall" style={[textSub, { marginBottom: 8 }]}>
                  Month-wise billing is calculated using the same delivery attribution rules as the Subscription tab.
                </Text>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Subscription amount (calculated)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.baseAmount)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Carry-forward (from previous bill)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.carryForwardIn)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Discount amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingDiscount)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Advance amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(c?.advanceBalance)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Final payable amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.invoiceTotal)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Paid amount (applied to this bill)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.paidApplied)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Pending amount (carry-forward)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.pending)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Bill calculation date (month end)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {billCalcDateForMonth(billingMonth)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Billing due date (this month)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {dueDateForMonth(billingMonth)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Last payment date
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {c?.lastPaymentDate ? formatIso(c.lastPaymentDate) : '—'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Billing status (this month)
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {billingSummaryForSelectedMonth.status}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Billing cycle date
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    Month-end
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Delivered products (day-wise)
                </Text>
                <Text variant="bodySmall" style={textSub}>
                  Only products marked Delivered in {monthLabel(billingMonth)}. This list is part of the month-wise billing summary and updates automatically.
                </Text>

                <View style={styles.tableWrap}>
                  <TableScroll>
                    <View style={[styles.tableMin, { minWidth: 860 }]}>
                      <TableRow
                        header
                        cells={[
                          { text: 'Date', grow: true },
                          { text: 'Type' },
                          { text: 'Product', grow: true },
                          { text: 'Pack / size', grow: true },
                          { text: 'Qty' },
                          { text: 'Price / delivery' },
                          { text: 'Delivered (last)' },
                          { text: 'Qty delivered' },
                          { text: 'Amount' },
                        ]}
                      />

                      {billingDeliveredProductRowsForMonth.length ? (
                        billingDeliveredProductRowsForMonth.map((r) => (
                          <TableRow
                            key={r.key}
                            cells={[
                              { text: fmtYmd(r.dateYmd), grow: true },
                              { text: r.type },
                              { text: r.productName, grow: true },
                              { text: r.packSizeLabel, grow: true },
                              { text: String(r.qty) },
                              { text: r.pricePerDelivery },
                              { text: r.deliveredLast },
                              { text: String(r.qtyDelivered) },
                              { text: r.amount },
                            ]}
                          />
                        ))
                      ) : (
                        <TableRow
                          cells={[
                            { text: 'No delivered products yet for this month.', grow: true },
                            { text: '—' },
                            { text: '—', grow: true },
                            { text: '—', grow: true },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                          ]}
                        />
                      )}
                    </View>
                  </TableScroll>
                </View>
              </Card.Content>
            </Card>

            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Billing History
                </Text>
                <View style={styles.tableWrap}>
                  <TableScroll>
                    <View style={styles.tableMin}>
                      <TableRow
                        header
                        cells={[
                          { text: 'Month', grow: true },
                          { text: 'Base' },
                          { text: 'Carry fwd' },
                          { text: 'Total' },
                          { text: 'Paid' },
                          { text: 'Pending' },
                          { text: 'Bill date' },
                          { text: 'Due Date' },
                          { text: 'Status' },
                        ]}
                      />
                      {billingTimeline.map((r) => (
                        <TableRow
                          key={r.month}
                          cells={[
                            { text: monthLabel(r.month), grow: true },
                            { text: money(r.baseAmount) },
                            { text: money(r.carryForwardIn) },
                            { text: money(r.invoiceTotal) },
                            { text: money(r.paidApplied) },
                            { text: money(r.pending) },
                            { text: fmtYmd(r.billCalcDateYmd) },
                            { text: fmtYmd(r.dueDateYmd) },
                            { text: r.status, tone: badgeTone(r.status) },
                          ]}
                        />
                      ))}
                    </View>
                  </TableScroll>
                </View>
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {tab === 'paymentHistory' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Payment summary
                </Text>

                <View style={[styles.monthNavRow, { marginTop: 8, marginBottom: 6 }]}>
                  <Pressable
                    disabled={isPaymentPrevDisabled}
                    onPress={() => setPaymentMonth(shiftMonth(paymentMonth, -1))}
                    style={({ pressed }) => [styles.monthNavBtn, isPaymentPrevDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                  <View style={styles.monthNavCenter}>
                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                      {monthLabel(paymentMonth)}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {paymentMonth}
                    </Text>
                  </View>
                  <Pressable
                    disabled={isPaymentNextDisabled}
                    onPress={() => setPaymentMonth(shiftMonth(paymentMonth, 1))}
                    style={({ pressed }) => [styles.monthNavBtn, isPaymentNextDisabled ? styles.monthNavBtnDisabled : null, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                </View>

                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Billing Period
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {monthLabel(paymentMonth)} ({paymentMonth})
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Payment Status
                  </Text>
                  {(() => {
                    const st = paymentSummaryForSelectedMonth.status;
                    const display = st === 'Pending' ? 'Unpaid' : st;
                    const t = badgeTone(st);
                    return (
                      <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
                        <Text variant="labelSmall" style={{ color: t.fg, fontWeight: '800' }}>
                          {display}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Total Bill Amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.invoiceTotal)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Paid Amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.paidApplied)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Pending Amount
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.pending)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Bill Date
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {fmtYmd(paymentSummaryForSelectedMonth.billCalcDateYmd)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Due Date
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {fmtYmd(paymentSummaryForSelectedMonth.dueDateYmd)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    Payment Mode
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {paymentsForSelectedMonth[0]?.paymentMode ?? '—'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                  <Button
                    mode="contained"
                    disabled={!c || updateCustomer.isPending || paymentSummaryForSelectedMonth.pending <= 0}
                    loading={updateCustomer.isPending}
                    onPress={() => {
                      const pending = Math.round(Math.max(0, paymentSummaryForSelectedMonth.pending));
                      if (!c || pending <= 0) return;
                      setSelectedPaymentMode(customerDefaultPaymentMode);
                      setPaymentModeDialogContext({ month: paymentMonth, pendingAmount: pending });
                      setPaymentDialogPayKind('full');
                      setPaymentDialogPartialAmount(String(pending));
                      setPaymentModeDialogOpen(true);
                    }}
                  >
                    Mark Paid (full)
                  </Button>
                  <Button
                    mode="outlined"
                    disabled={!c || updateCustomer.isPending}
                    onPress={async () => {
                      if (!c) return;
                      const tag = billPaymentTag(paymentMonth);
                      const next = (c.payments ?? []).filter((p) => !String((p as any).notes ?? '').startsWith(tag));
                      const nowIso = new Date().toISOString();
                      const nextAudit = [
                        ...((c as any).audit ?? []),
                        {
                          id: `audit_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
                          createdAt: nowIso,
                          updatedAt: nowIso,
                          date: nowIso,
                          action: `Payment marked unpaid for ${paymentMonth}`,
                          updatedBy: 'Admin',
                        },
                      ];
                      await updateCustomer.mutateAsync({
                        id: c.id,
                        data: {
                          payments: next as any,
                          audit: nextAudit as any,
                        },
                      });
                      showToast(`Marked unpaid for ${monthLabel(paymentMonth)}. Pending will carry forward automatically.`);
                    }}
                  >
                    Mark Unpaid (reopen)
                  </Button>
                </View>
              </Card.Content>
            </Card>

            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Payment History
                </Text>
                <View style={styles.tableWrap}>
                  <TableScroll>
                    <View style={[styles.tableMin, { minWidth: 1400 }]}>
                      <TableRow
                        header
                        cells={[
                          { text: 'Payment Date', grow: true, lines: 2 },
                          { text: 'Payment Amount', lines: 2 },
                          { text: 'Payment Mode', lines: 2 },
                          { text: 'Transaction ID / Reference Number', grow: true, lines: 2 },
                          { text: 'Collected By', grow: true, lines: 2 },
                          { text: 'Bill Month / Billing Period', grow: true, lines: 2 },
                          { text: 'Payment Status', lines: 2 },
                          { text: 'Previous Due Amount', lines: 2 },
                          { text: 'Amount Adjusted', lines: 2 },
                          { text: 'Remaining Due Amount', lines: 2 },
                          { text: 'Advance Amount Added', lines: 2 },
                          { text: 'Payment Notes', grow: true, lines: 2 },
                          { text: 'Receipt Number', lines: 2 },
                          { text: 'Created By', grow: true, lines: 2 },
                          { text: 'Created Date & Time', grow: true, lines: 2 },
                        ]}
                      />
                      {paymentHistoryRowsForSelectedMonth.length ? (
                        paymentHistoryRowsForSelectedMonth.map((r) => (
                          <TableRow
                            key={r.id}
                            cells={[
                              { text: r.paymentDate, grow: true },
                              { text: r.paymentAmount },
                              { text: r.paymentMode },
                              { text: r.transactionId, grow: true, lines: 2 },
                              { text: r.collectedBy, grow: true, lines: 2 },
                              { text: r.billingPeriod, grow: true, lines: 2 },
                              { text: r.paymentStatus },
                              { text: r.previousDueAmount },
                              { text: r.amountAdjusted },
                              { text: r.remainingDueAmount },
                              { text: r.advanceAmountAdded },
                              { text: r.paymentNotes, grow: true, lines: 3 },
                              { text: r.receiptNumber },
                              { text: r.createdBy, grow: true, lines: 2 },
                              { text: r.createdAt, grow: true, lines: 2 },
                            ]}
                          />
                        ))
                      ) : (
                        <TableRow
                          cells={[
                            { text: 'No payments recorded for this month.', grow: true, lines: 2 },
                            { text: '—' },
                            { text: '—' },
                            { text: '—', grow: true, lines: 2 },
                            { text: '—', grow: true, lines: 2 },
                            { text: '—', grow: true, lines: 2 },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                            { text: '—' },
                            { text: '—', grow: true, lines: 2 },
                            { text: '—' },
                            { text: '—', grow: true, lines: 2 },
                            { text: '—', grow: true, lines: 2 },
                          ]}
                        />
                      )}
                    </View>
                  </TableScroll>
                </View>
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {tab === 'deliveryHistory' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Day orders (month-wise)
                </Text>
                <View style={[styles.monthNavRow, { marginTop: 6 }]}>
                  <Pressable
                    disabled={isDeliveryPrevDisabled}
                    onPress={() => setDeliveryMonth(shiftMonth(deliveryMonth, -1))}
                    style={({ pressed }) => [
                      styles.monthNavBtn,
                      isDeliveryPrevDisabled ? styles.monthNavBtnDisabled : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                  <View style={styles.monthNavCenter}>
                    <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                      {monthLabel(deliveryMonth)}
                    </Text>
                    <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                      {deliveryMonth}
                    </Text>
                  </View>
                  <Pressable
                    disabled={isDeliveryNextDisabled}
                    onPress={() => setDeliveryMonth(shiftMonth(deliveryMonth, 1))}
                    style={({ pressed }) => [
                      styles.monthNavBtn,
                      isDeliveryNextDisabled ? styles.monthNavBtnDisabled : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
                  </Pressable>
                </View>

                <Text variant="bodySmall" style={textSub}>
                  Tap a day in the calendar to view orders and mark Delivered/Not delivered.
                </Text>

                <SubscriptionMonthCalendarGrid
                  monthYyyyMm={deliveryMonth}
                  cells={deliveryCalendarCells}
                  textMain={textMain}
                  textSub={textSub}
                  isDark={scheme === 'dark'}
                  mode="delivery"
                  deliveryToneSurfaces={ADMIN_DELIVERY_SURFACES}
                  legendFooter={deliveryCalendarLegendFooter}
                  onPressDay={(ymd) => setDeliverySelectedDayYmd(ymd)}
                />
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {tab === 'complaints' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  Complaints
                </Text>
                <Text variant="bodySmall" style={textSub}>
                  Shows complaints raised by the customer.
                </Text>
                <View style={styles.tableWrap}>
                  <TableScroll>
                    <View style={[styles.tableMin, { minWidth: 980 }]}>
                      <TableRow
                        header
                        cells={[
                          { text: 'Complaint Date', grow: true },
                          { text: 'Type', grow: true },
                          { text: 'Status' },
                          { text: 'Resolution Date' },
                          { text: 'Description / Notes', grow: true, lines: 2 },
                          { text: 'Resolved By', grow: true, lines: 2 },
                        ]}
                      />
                      {(() => {
                        const list = [...(c?.complaints ?? [])].sort((a, b) =>
                          String(b.complaintDate ?? '').localeCompare(String(a.complaintDate ?? '')),
                        );
                        if (!list.length) {
                          return (
                            <TableRow
                              cells={[
                                { text: 'No complaints raised yet.', grow: true, lines: 2 },
                                { text: '—', grow: true },
                                { text: '—' },
                                { text: '—' },
                                { text: '—', grow: true, lines: 2 },
                                { text: '—', grow: true },
                              ]}
                            />
                          );
                        }
                        return list.map((cmp) => {
                          const st = String((cmp as any).status ?? 'Pending');
                          return (
                            <TableRow
                              key={cmp.id}
                              cells={[
                                { text: fmtDate((cmp as any).complaintDate), grow: true },
                                { text: String((cmp as any).type ?? '—'), grow: true, lines: 2 },
                                { text: st, tone: badgeTone(st) },
                                { text: fmtDate((cmp as any).resolutionDate) },
                                { text: String((cmp as any).description ?? '—') || '—', grow: true, lines: 3 },
                                { text: String((cmp as any).resolvedBy ?? '—'), grow: true, lines: 2 },
                              ]}
                            />
                          );
                        });
                      })()}
                    </View>
                  </TableScroll>
                </View>

                {(() => {
                  const list = [...(c?.complaints ?? [])].sort((a, b) =>
                    String(b.complaintDate ?? '').localeCompare(String(a.complaintDate ?? '')),
                  );
                  if (!list.length) return null;

                  const actions = c?.complaintActions ?? [];
                  const actionsFor = (complaintId: string) =>
                    actions
                      .filter((x) => String((x as any).complaintId ?? '') === complaintId)
                      .slice()
                      .sort((a, b) => String((b as any).createdAt ?? '').localeCompare(String((a as any).createdAt ?? '')));

                  return (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      <Text variant="labelLarge" style={[styles.bold, textMain]}>
                        Admin actions (visible to customer)
                      </Text>
                      {list.map((cmp) => {
                        const acts = actionsFor(cmp.id);
                        return (
                          <View
                            key={`cmp_actions_${cmp.id}`}
                            style={[
                              styles.dayCard,
                              {
                                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(148,163,184,0.06)',
                                borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.18)',
                              },
                            ]}
                          >
                            <View style={styles.dayCardTop}>
                              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                                  {cmp.type}
                                </Text>
                                <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                                  {fmtDate(cmp.complaintDate)} · {cmp.status}
                                </Text>
                              </View>
                              <Button
                                mode="contained"
                                onPress={() => {
                                  setComplaintActionTargetId(cmp.id);
                                  setComplaintActionStatus(cmp.status as any);
                                  setComplaintActionNote('');
                                  setComplaintActionDialogOpen(true);
                                }}
                              >
                                Add action
                              </Button>
                            </View>

                            {acts.length ? (
                              <View style={{ gap: 6 }}>
                                {acts.slice(0, 3).map((a) => (
                                  <View key={a.id} style={{ gap: 2 }}>
                                    <Text variant="bodySmall" style={textMain} numberOfLines={3}>
                                      {String((a as any).message ?? '')}
                                    </Text>
                                    <Text variant="labelSmall" style={textSub} numberOfLines={2}>
                                      {fmtDateTime(String((a as any).createdAt ?? ''))} · {String((a as any).createdBy ?? 'Admin')}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text variant="bodySmall" style={textSub}>
                                No admin actions yet.
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {/* Orders, Audit, Memo History tabs removed */}
      </ScrollView>

      <Portal>
        <Dialog
          visible={complaintActionDialogOpen}
          onDismiss={() => {
            setComplaintActionDialogOpen(false);
            setComplaintActionTargetId(null);
            setComplaintActionNote('');
          }}
          style={[scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight, { alignSelf: 'center', maxWidth: 520, width: '100%' }]}
        >
          <Dialog.Title>Complaint action</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
              This action will be saved and visible to the customer.
            </Text>

            <View style={{ marginTop: 10, gap: 8 }}>
              <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                Status
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {(['Open', 'In Progress', 'Resolved', 'Closed'] as const).map((st) => (
                  <Button
                    key={st}
                    mode={complaintActionStatus === st ? 'contained' : 'outlined'}
                    onPress={() => setComplaintActionStatus(st)}
                  >
                    {st}
                  </Button>
                ))}
              </View>

              <TextInput
                mode="outlined"
                label="Admin note"
                value={complaintActionNote}
                onChangeText={setComplaintActionNote}
                placeholder="Write what action you took…"
                multiline
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setComplaintActionDialogOpen(false);
                setComplaintActionTargetId(null);
                setComplaintActionNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              disabled={!c || !complaintActionTargetId || updateCustomer.isPending}
              loading={updateCustomer.isPending}
              onPress={async () => {
                if (!c || !complaintActionTargetId) return;
                const nowIso = new Date().toISOString();
                const complaintId = complaintActionTargetId;

                const nextComplaints = (c.complaints ?? []).map((cmp) => {
                  if (cmp.id !== complaintId) return cmp;
                  const next: any = { ...cmp, status: complaintActionStatus };
                  if (complaintActionStatus === 'Resolved' || complaintActionStatus === 'Closed') {
                    next.resolutionDate = nowIso;
                    next.resolvedBy = 'Admin';
                  }
                  return next;
                });

                const nextActions = [
                  ...(c.complaintActions ?? []),
                  {
                    id: `cmpact_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    complaintId,
                    kind: 'status_change',
                    nextStatus: complaintActionStatus,
                    message: complaintActionNote.trim() ? complaintActionNote.trim() : `Status updated to ${complaintActionStatus}`,
                    createdBy: 'Admin',
                  },
                ];

                await updateCustomer.mutateAsync({
                  id: c.id,
                  data: {
                    complaints: nextComplaints as any,
                    complaintActions: nextActions as any,
                  },
                });

                showToast(`Complaint updated: ${complaintActionStatus}`);
                setComplaintActionDialogOpen(false);
                setComplaintActionTargetId(null);
                setComplaintActionNote('');
              }}
            >
              Save action
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={paymentModeDialogOpen}
          onDismiss={() => {
            setPaymentModeDialogOpen(false);
            setPaymentModeDialogContext(null);
          }}
          style={[scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight, { alignSelf: 'center', maxWidth: 420, width: '100%' }]}
        >
          <Dialog.Title>Mark paid</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
              Customer can pay online/bank. Cash is admin-only, but admins can record cash collections here.
            </Text>
            <Text variant="bodySmall" style={[scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight, { marginTop: 6 }]}>
              {paymentModeDialogContext
                ? `Bill: ${monthLabel(paymentModeDialogContext.month)} · Amount: ${money(paymentModeDialogContext.pendingAmount)}`
                : ''}
            </Text>

            {paymentModeDialogContext ? (
              <>
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                    Payment mode
                  </Text>
                  {adminPaymentModeOptions.map((m) => {
                    const active = m === selectedPaymentMode;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setSelectedPaymentMode(m)}
                        style={({ pressed }) => [
                          styles.pickItem,
                          active ? { borderColor: 'rgba(37,99,235,0.35)' } : null,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text variant="bodyMedium">{m}</Text>
                        {active ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ marginTop: 14, gap: 8 }}>
                  <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                    Payment type
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <Button
                      mode={paymentDialogPayKind === 'full' ? 'contained' : 'outlined'}
                      onPress={() => {
                        setPaymentDialogPayKind('full');
                        setPaymentDialogPartialAmount(String(paymentModeDialogContext.pendingAmount));
                      }}
                    >
                      Full payment
                    </Button>
                    <Button
                      mode={paymentDialogPayKind === 'partial' ? 'contained' : 'outlined'}
                      onPress={() => {
                        setPaymentDialogPayKind('partial');
                        setPaymentDialogPartialAmount(String(Math.max(1, Math.min(paymentModeDialogContext.pendingAmount, Number(paymentDialogPartialAmount || 1)))));
                      }}
                    >
                      Partial payment
                    </Button>
                  </View>

                  {paymentDialogPayKind === 'partial' ? (
                    <TextInput
                      mode="outlined"
                      keyboardType="numeric"
                      label="Amount paid now"
                      value={paymentDialogPartialAmount}
                      onChangeText={setPaymentDialogPartialAmount}
                      placeholder={String(paymentModeDialogContext.pendingAmount)}
                    />
                  ) : null}

                  {(() => {
                    const pending = Math.round(Math.max(0, paymentModeDialogContext.pendingAmount));
                    const raw = Number(String(paymentDialogPartialAmount ?? '').trim());
                    const desired = paymentDialogPayKind === 'full' ? pending : Math.round(Number.isFinite(raw) ? raw : 0);
                    const paidNow = Math.max(0, Math.min(pending, desired));
                    const remaining = Math.max(0, Math.round(pending - paidNow));
                    return (
                      <View style={{ gap: 6 }}>
                        <View style={styles.kvRow}>
                          <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                            Paying now
                          </Text>
                          <Text variant="bodyMedium" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                            {money(paidNow)}
                          </Text>
                        </View>
                        <View style={styles.kvRow}>
                          <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                            Remaining (carry-forward)
                          </Text>
                          <Text variant="bodyMedium" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                            {money(remaining)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setPaymentModeDialogOpen(false);
                setPaymentModeDialogContext(null);
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              disabled={!c || updateCustomer.isPending || !paymentModeDialogContext}
              loading={updateCustomer.isPending}
              onPress={async () => {
                if (!c || !paymentModeDialogContext) return;
                const pending = Math.round(Math.max(0, paymentModeDialogContext.pendingAmount));
                const raw = Number(String(paymentDialogPartialAmount ?? '').trim());
                const desired = paymentDialogPayKind === 'full' ? pending : Math.round(Number.isFinite(raw) ? raw : 0);
                const payAmount = Math.max(0, Math.min(pending, desired));
                if (payAmount <= 0) {
                  setPaymentModeDialogOpen(false);
                  setPaymentModeDialogContext(null);
                  return;
                }
                const nowIso = new Date().toISOString();
                const month = paymentModeDialogContext.month;
                const notes =
                  paymentDialogPayKind === 'full'
                    ? billPaymentTag(month)
                    : `${billPaymentTag(month)} (partial ${payAmount}/${pending})`;
                const nextPayments = [
                  {
                    id: newPaymentId(),
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    paymentDate: nowIso,
                    amountPaid: payAmount,
                    paymentMode: selectedPaymentMode as any,
                    notes,
                  },
                  ...(c.payments ?? []),
                ];
                const nextAudit = [
                  ...((c as any).audit ?? []),
                  {
                    id: `audit_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    date: nowIso,
                    action:
                      paymentDialogPayKind === 'full'
                        ? `Payment marked paid for ${month} (full ${payAmount})`
                        : `Payment marked paid for ${month} (partial ${payAmount}/${pending})`,
                    updatedBy: 'Admin',
                  },
                ];
                await updateCustomer.mutateAsync({
                  id: c.id,
                  data: {
                    payments: nextPayments as any,
                    lastPaymentDate: nowIso,
                    audit: nextAudit as any,
                  },
                });
                const remaining = Math.max(0, Math.round(pending - payAmount));
                showToast(
                  paymentDialogPayKind === 'full'
                    ? `Marked paid (full) for ${monthLabel(month)} · Paid ${money(payAmount)} · Remaining ${money(remaining)}`
                    : `Marked paid (partial) for ${monthLabel(month)} · Paid ${money(payAmount)} · Remaining ${money(remaining)}`,
                );
                setPaymentModeDialogOpen(false);
                setPaymentModeDialogContext(null);
              }}
            >
              Mark paid
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={!!deliverySelectedDayYmd}
          onDismiss={() => setDeliverySelectedDayYmd(null)}
          style={[
            scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight,
            styles.deliveryDialogSurface,
            { maxWidth: deliveryDialogMaxW, width: deliveryDialogMaxW },
          ]}
        >
          <Dialog.Title style={styles.deliveryDialogTitle}>Day orders</Dialog.Title>
          <Dialog.Content style={styles.deliveryDialogContent}>
            {deliverySelectedDayModel ? (
              <ScrollView
                style={{ maxHeight: deliveryDialogScrollMaxH }}
                contentContainerStyle={styles.deliveryDayScrollContent}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    Date
                  </Text>
                  <Text variant="bodyMedium" style={[styles.deliveryDayValue, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}>
                    {fmtYmd(deliverySelectedDayModel.ymd)}
                  </Text>
                  <Text variant="labelSmall" style={[styles.deliveryDayMeta, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    {deliverySelectedDayModel.ymd}
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    Products & amount
                  </Text>
                  {deliverySelectedDayModel.plans.map((p, idx) => (
                    <Text
                      key={`dp_${idx}`}
                      variant="bodySmall"
                      style={[styles.deliveryProductLine, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}
                    >
                      {p.productName} {p.quantityLabel} (subscription) — ₹{Math.round(planLineTotal(p as any))}
                    </Text>
                  ))}
                  {deliverySelectedDayModel.addons.map((a, idx) => {
                    const unit = productPriceByName.get(String(a.productName ?? '').trim()) ?? 0;
                    const qty = Math.max(1, Math.floor(Number(a.quantity ?? 1)));
                    const cost = Math.round(unit * qty);
                    return (
                      <Text
                        key={`da_${idx}`}
                        variant="bodySmall"
                        style={[styles.deliveryProductLine, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}
                      >
                        {a.productName} {a.quantityLabel} · Qty {a.quantity} (add-on) — ₹{cost}
                      </Text>
                    );
                  })}
                  {!deliverySelectedDayModel.plans.length && !deliverySelectedDayModel.addons.length ? (
                    <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                      No orders on this day.
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    Total amount
                  </Text>
                  <Text variant="bodyLarge" style={[styles.deliveryDayValue, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}>
                    ₹{deliverySelectedDayModel.total}
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    Status
                  </Text>
                  <Text variant="bodyMedium" style={[styles.deliveryDayValue, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}>
                    {deliverySelectedDayModel.status}
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryActionsRow}>
                  <Button
                    compact
                    mode="contained"
                    loading={updateCustomer.isPending}
                    disabled={updateCustomer.isPending || (!deliverySelectedDayModel.plans.length && !deliverySelectedDayModel.addons.length)}
                    onPress={() => void setDeliveryStatusForDay(deliverySelectedDayModel.ymd, 'Delivered')}
                    style={styles.deliveryActionBtn}
                  >
                    Delivered
                  </Button>
                  <Button
                    compact
                    mode="outlined"
                    loading={updateCustomer.isPending}
                    disabled={updateCustomer.isPending || (!deliverySelectedDayModel.plans.length && !deliverySelectedDayModel.addons.length)}
                    onPress={() => void setDeliveryStatusForDay(deliverySelectedDayModel.ymd, 'Missed')}
                    style={styles.deliveryActionBtn}
                  >
                    Not delivered
                  </Button>
                </View>
              </ScrollView>
            ) : (
              <Text variant="bodySmall" style={textSub}>
                Loading…
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.deliveryDialogActions}>
            <Button compact onPress={() => setDeliverySelectedDayYmd(null)}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Snackbar
          visible={toast.visible}
          onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
          duration={3500}
          action={{ label: 'OK', onPress: () => setToast((t) => ({ ...t, visible: false })) }}
        >
          {toast.message}
        </Snackbar>
      </Portal>

    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  appBar: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  appBarLight: { backgroundColor: 'transparent' },
  appBarDark: { backgroundColor: 'transparent' },
  appBarMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start', justifyContent: 'center' },
  headerMidMobile: { width: '100%', alignItems: 'flex-start' },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  headerTitle: { fontWeight: '900', flexShrink: 1 },
  editPill: { height: 40, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },

  tabsBar: { paddingHorizontal: 16, paddingBottom: 10 },
  tabsBarLight: { backgroundColor: 'transparent' },
  tabsBarDark: { backgroundColor: 'transparent' },

  container: { padding: 16, paddingBottom: 24, gap: 12 },

  // Header CRM card removed; details live in Overview tab.
  kv: { flexGrow: 1, flexBasis: 160, minWidth: 0, gap: 4 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  bold: { fontWeight: '900' },

  tabsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabsRowScroll: { flexDirection: 'row', gap: 8 },
  tabsRowScrollMobile: { paddingHorizontal: 16, gap: 6 },
  tabPill: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  tabPillBase: { paddingHorizontal: 12 },
  tabPillH44: { height: 44 },
  tabPillH40: { height: 40, paddingHorizontal: 10 },
  tabPillH36: { height: 36, paddingHorizontal: 10, maxWidth: 140 },
  tabPillActive: { backgroundColor: 'rgba(37,99,235,0.14)', borderColor: 'rgba(37,99,235,0.22)' },
  tabPillInactive: { backgroundColor: 'rgba(148,163,184,0.08)', borderColor: 'rgba(148,163,184,0.18)' },
  tabTextActive: { color: '#1D4ED8', fontWeight: '900' },
  tabTextInactive: { color: 'rgba(30,41,59,0.70)', fontWeight: '800' },
  tabText14: { fontSize: 14 },
  tabText13: { fontSize: 13 },
  tabText12: { fontSize: 12 },

  sectionStack: { gap: 12 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  sectionContent: { gap: 10 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  overviewCard: { flexGrow: 1, flexBasis: 420, minWidth: 0 },
  overviewCardsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  miniCard: { flexGrow: 1, flexBasis: 170, minWidth: 0, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.08)' },
  miniCardWide: { flexBasis: 360 },
  overviewItemCard: {
    width: '100%',
    maxWidth: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(148,163,184,0.06)',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },

  memoItem: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', paddingHorizontal: 10 },
  memoDot: { width: 12, height: 12, borderRadius: 999, borderWidth: 1, marginTop: 4 },
  memoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },

  tableWrap: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', overflow: 'hidden' },
  tableScroll: { paddingRight: 0 },
  tableMin: { minWidth: 640 },
  tableRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  tableHeader: { backgroundColor: 'rgba(148,163,184,0.10)', borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.18)' },
  tableHeaderText: { color: 'rgba(30,41,59,0.70)', fontWeight: '900' },
  tableBodyText: { color: COLORS.text },
  cell: { width: 92, flexShrink: 0 },
  cellGrow: { flex: 1, width: 'auto', minWidth: 140 },

  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  monthNavBtn: { width: 44, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.06)' },
  monthNavBtnDisabled: { opacity: 0.45 },
  monthNavCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)' },
  dayCard: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', gap: 10 },
  dayCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dayCardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(148,163,184,0.06)',
    minWidth: 140,
  },

  subLine: { paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', paddingHorizontal: 10, gap: 2 },
  pickItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(148,163,184,0.12)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },

  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },

  sectionCardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  sectionCardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.70)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },

  deliveryDialogSurface: { alignSelf: 'center', marginHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  deliveryDialogTitle: { paddingTop: 4, paddingBottom: 6, fontSize: 16, lineHeight: 20 },
  deliveryDialogContent: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  deliveryDialogActions: { paddingHorizontal: 8, paddingVertical: 4, minHeight: 44, justifyContent: 'flex-end' },
  deliveryDayScrollContent: { paddingHorizontal: 16, paddingBottom: 6, gap: 0 },
  deliveryDaySection: { gap: 2, paddingVertical: 2 },
  deliveryDayRule: { height: 0, borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 6 },
  deliveryDayRuleLight: { borderTopColor: 'rgba(148,163,184,0.35)' },
  deliveryDayRuleDark: { borderTopColor: 'rgba(255,255,255,0.12)' },
  deliveryDayLabel: { fontWeight: '800', letterSpacing: 0.2, marginBottom: 1 },
  deliveryDayValue: { fontWeight: '800' },
  deliveryDayMeta: { marginTop: 0, opacity: 0.85 },
  deliveryProductLine: { paddingVertical: 1, lineHeight: 18 },
  deliveryActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2, paddingBottom: 2 },
  deliveryActionBtn: { marginVertical: 0 },

  deliveryCalLegendWrap: { marginTop: 6, gap: 8 },
  deliveryCalLegendRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  deliveryCalSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, marginTop: 2, flexShrink: 0 },
  deliveryCalLegendTextCol: { flex: 1, minWidth: 0, gap: 2 },
  deliveryCalCodeLine: { opacity: 0.92 },
});

