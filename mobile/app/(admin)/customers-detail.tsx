import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { CustomerDetailOverview } from '@/src/components/admin/CustomerDetailOverview';
import type { CustomerFormTab } from '@/src/components/admin/customerFormShared';
import { AdminListEmptyState } from '@/src/components/shared/adminListUi';
import { DetailProfileCard } from '@/src/components/shared/DetailProfileCard';
import { useResetPin } from '@/src/hooks/auth';
import { DetailStatusPill } from '@/src/components/shared/detailUi';
import { PeriodStepper } from '@/src/components/shared/PeriodStepper';
import { CustomerSubscriptionTab } from '@/src/components/admin/CustomerSubscriptionTab';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { DeferredTextInput, type DeferredTextInputHandle } from '@/src/components/DeferredTextInput';
import { DairyTactileScreenBackground } from '@/src/components/shared/DairyTactileScreenBackground';
import { useResponsiveContainerMaxWidth } from '@/src/components/shared/ResponsiveContainer';
import {
  buildCalendarCells,
  type DeliveryDayTone,
  type DeliveryToneSurfaces,
  MemoizedSubscriptionMonthCalendarGrid as SubscriptionMonthCalendarGrid,
} from '@/src/components/admin/SubscriptionMonthCalendarGrid';
import {
  addDaysYmd,
  BILL_DUE_GRACE_DAYS,
  billDateYmdForMonth,
  buildBillingTimeline,
  summarizeBilling,
} from '@/src/components/admin/billingTimeline';
import {
  buildSubscriptionMonthOptions,
  monthLabel,
  planLineTotal,
  shiftMonth,
  subscriptionPlanActiveOnDateYmd,
  subscriptionPlanWinsDeliveryAttributionAtYmd,
} from '@/src/components/admin/customerSubscriptionMonthUtils';
import { CustomerDayChangesCard } from '@/src/components/admin/CustomerDayChangesCard';
import { buildDayStatusDeliveries, NothingPlannedError } from '@/src/components/delivery/markDayStatus';
import { useCustomer } from '@/src/hooks/customers';
import { buildTodayEntries } from '@/src/components/admin/dashboardMetrics';
import { addOnItemCount, addOnLabel, addOnLineTotal, addOnsForDate, deliveredAddOnsForMonth } from '@/src/domain/customers/addOns';
import { plannedLinesOn, usualQuantity } from '@/src/domain/customers/daySchedule';
import { notifyDeliveryMarked, notifyPaymentRecorded } from '@/src/domain/notifications/events';
import { PaymentRequestReview } from '@/src/components/admin/PaymentRequestReview';
import { useUpdateCustomer } from '@/src/hooks/customers/useCustomers';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { strings } from '@/src/i18n/strings';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import {
  amraleRadius,
  amraleSpacing,
  amraleTypography,
  dairyGradient,
  dairyTactileColors,
  primaryButtonElevation,
} from '@/src/theme/dairyTactile';
import { formFieldAttrs, platformShadow } from '@/src/theme/platformStyles';
import { formatDateTime, formatDay } from '@/src/utils/format';
import { useResponsiveDialogStyle } from '@/src/utils/responsiveLayout';
import { storedText } from '@/src/i18n/storedText';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { offerDiscountsForMonth, offerText, orderSavings } from '@/src/domain/offers/offers';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

/**
 * Customer screens use the light-only DairyTactile surfaces (cards, tables, dialogs). Pin the scheme so text colors
 * never switch to dark-mode values on those light surfaces (unreadable in system dark mode).
 */
const CUSTOMER_SCREEN_SCHEME = 'light' as 'light' | 'dark';

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : strings('customers').detail.tryAgain;
}

/** Local calendar day (a `toISOString()` slice is the UTC day — wrong for part of every IST day). */
function todayYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD as a local date; `new Date('YYYY-MM-DD')` is UTC midnight (previous day west of UTC). */
function parseYmdLocal(ymd: string): Date | null {
  const m = String(ymd ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const ADMIN_PAYMENT_MODES = ['Cash', 'UPI', 'Bank', 'Other'] as const;
type AdminPaymentMode = typeof ADMIN_PAYMENT_MODES[number];

/** Delivery tab — calendar colors + rgba/hex reference (the legend wording is in the `customers` dictionary). */
const ADMIN_DELIVERY_CALENDAR = {
  tones: {
    empty: {
      codes: 'Fill rgba(234, 179, 8, 0.22) · Border rgba(202, 138, 4, 0.50) · Hue #EAB308',
      light: { backgroundColor: 'rgba(234, 179, 8, 0.22)', borderColor: 'rgba(202, 138, 4, 0.50)' },
      dark: { backgroundColor: 'rgba(234, 179, 8, 0.18)', borderColor: 'rgba(250, 204, 21, 0.45)' },
    },
    pending: {
      codes: 'Light fill #F8FAFC · Dark fill rgba(15, 23, 42, 0.55) · Border slate rgba(100, 116, 139, 0.42)',
      light: { backgroundColor: 'rgba(248, 250, 252, 0.95)', borderColor: 'rgba(100, 116, 139, 0.42)' },
      dark: { backgroundColor: 'rgba(15, 23, 42, 0.55)', borderColor: 'rgba(148, 163, 184, 0.38)' },
    },
    delivered: {
      codes: 'Fill rgba(34, 197, 94, 0.22) · Border rgba(22, 163, 74, 0.55) · Hue #22C55E',
      light: { backgroundColor: 'rgba(34, 197, 94, 0.22)', borderColor: 'rgba(22, 163, 74, 0.55)' },
      dark: { backgroundColor: 'rgba(34, 197, 94, 0.24)', borderColor: 'rgba(74, 222, 128, 0.42)' },
    },
    missed: {
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

/** Day-month-year, e.g. "21 Aug 2026", in the app language. Used everywhere on this screen so dates never switch format. */
function formatDayMonthYear(d: Date): string {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return formatDay(ymd, { year: true });
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  // Date-only strings are calendar dates: read them locally so they never shift a day west of UTC.
  const ymd = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDayMonthYear(d);
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return formatDateTime(iso) || '—';
}

function formatIso(iso: string | undefined): string {
  return fmtDate(iso);
}

function money(v: number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n)}`;
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


function fmtYmd(ymd: string): string {
  const d = parseYmdLocal(ymd);
  if (!d) return ymd;
  return formatDayMonthYear(d);
}

/** A stored status/mode shown in the app language; values the dictionary does not know are shown as stored. */
function labelOf(labels: Record<string, string>, key: string): string {
  return labels[key] ?? key;
}

/** Payment status → pill colour. */
function paymentTone(status: string): 'green' | 'amber' | 'red' | 'gray' {
  const t = status.trim().toLowerCase();
  if (t === 'paid') return 'green';
  if (t === 'partial' || t === 'pending') return 'amber';
  if (t === 'unpaid' || t === 'failed') return 'red';
  return 'gray';
}

/** Complaint status → pill colour: open work is amber, resolved is green, anything else neutral. */
function complaintTone(status: string): 'green' | 'amber' | 'gray' {
  const s = status.trim().toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'green';
  if (s === 'open' || s === 'in progress' || s === 'pending') return 'amber';
  return 'gray';
}

/** Tabs whose content is scoped to one month; they share the stepper under the tab strip. */
const MONTH_SCOPED_TABS: TabKey[] = ['subscription', 'billing', 'paymentHistory', 'deliveryHistory'];

function formatCustomerDisplayId(id: string): string {
  const compact = id.replace(/^cust_/, '').replace(/_/g, '').toUpperCase();
  const tail = compact.slice(-4) || compact.slice(0, 4) || '0000';
  return `#CUST-${tail}`;
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function memberBadgeLabel(c: { subscriptionStatus?: string; billingType?: string; status?: string } | null | undefined): string {
  const t = strings('customers');
  const billing = String(c?.billingType ?? '').trim();
  if (billing === 'Prepaid') return t.detail.member.premium;
  const sub = String(c?.subscriptionStatus ?? '').trim();
  if (sub === 'Active') return t.detail.member.active;
  if (sub) return labelOf(t.subscriptionStatus, sub);
  return c?.status ? labelOf(t.customerStatus, c.status) : t.detail.member.member;
}

function formatMobileDisplay(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return mobile.trim() || '—';
}

function overviewAddressTags(c: {
  societyName?: string;
  specialDeliveryInstructions?: string;
} | null | undefined): string[] {
  if (!c) return [];
  const labels = strings('customers').detail.tags;
  const tags: string[] = [];
  if (c.societyName?.trim()) tags.push(labels.residential);
  if (c.specialDeliveryInstructions?.trim()) tags.push(labels.gateAccess);
  return tags;
}

function billingTypeDisplay(c: { billingType?: string; paymentType?: string } | null | undefined): string {
  const t = strings('customers');
  const billing = String(c?.billingType ?? '').trim();
  if (billing === 'Prepaid') return t.detail.prepaidWallet;
  if (billing) return labelOf(t.billingTypes, billing);
  const pay = String(c?.paymentType ?? '').trim();
  return pay ? labelOf(t.paymentModes, pay) : '—';
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

const TabPill = memo(function TabPill({
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
      <Text
        style={[
          active ? styles.tabTextActive : styles.tabTextInactive,
          textSizeStyle,
          { fontFamily: active ? amraleTypography.fontFamily.bold : amraleTypography.fontFamily.semiBold },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

/** True inside a `TableScroll fit`: rows use fluid columns that share the card width instead of fixed widths. */
const TableFitContext = createContext(false);

/**
 * Phones/tablets: horizontal scroller (indicator visible so the extra columns are discoverable).
 * Laptops/desktops (`fit`): no scroller — columns shrink/grow to the card width.
 */
function TableScroll({ children, fit }: { children: React.ReactNode; fit?: boolean }) {
  if (fit) {
    return (
      <TableFitContext.Provider value>
        <View style={styles.tableFitWrap}>{children}</View>
      </TableFitContext.Provider>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
      {children}
    </ScrollView>
  );
}

const TableRow = memo(function TableRow({
  cells,
  header,
}: {
  cells: Array<{ text: string; grow?: boolean; lines?: number; tone?: { bg: string; fg: string; border: string } }>;
  header?: boolean;
}) {
  const fit = useContext(TableFitContext);
  return (
    <View style={[styles.tableRow, fit && styles.tableRowFit, header ? styles.tableHeader : null]}>
      {cells.map((c, idx) => (
        <View key={idx} style={fit ? [styles.cellFit, c.grow && styles.cellGrowFit] : [styles.cell, c.grow && styles.cellGrow]}>
          {c.tone ? (
            <View style={[styles.chip, { backgroundColor: c.tone.bg, borderColor: c.tone.border }]}>
              <Text variant="labelSmall" style={{ color: c.tone.fg, fontWeight: '800' }} numberOfLines={1}>
                {c.text}
              </Text>
            </View>
          ) : (
            <Text
              variant={header ? 'labelSmall' : 'bodySmall'}
              style={header ? styles.tableHeaderText : styles.tableBodyText}
              numberOfLines={header && fit ? Math.max(3, c.lines ?? 2) : c.lines ?? (header ? 2 : 1)}
            >
              {c.text}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
});

const DeferredTabPlaceholder = memo(function DeferredTabPlaceholder({
  label,
  sectionCard,
  textMain,
  textSub,
}: {
  label: string;
  sectionCard: object;
  textMain: object;
  textSub: object;
}) {
  const t = useStrings('customers').detail;
  return (
    <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
      <Card.Content style={styles.sectionContent}>
        <Text variant="titleSmall" style={[styles.bold, textMain]}>
          {label}
        </Text>
        <Text variant="bodySmall" style={textSub}>
          {t.loading}
        </Text>
      </Card.Content>
    </Card>
  );
});

export default function AdminCustomerDetailDashboard() {
  const scheme = CUSTOMER_SCREEN_SCHEME;
  const navigation = useNavigation();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? '';
  const text = useStrings('customers');
  const t = text.detail;
  const lang = useLanguage();
  const offers = useOffers();
  const offerWords = useStrings('offers');
  const customer = useCustomer(id);
  const updateCustomer = useUpdateCustomer();
  const deliveryBoys = useDeliveryBoys();
  const [tab, setTab] = useState<TabKey>('overview');

  const c = customer.data;

  const sectionCard = useMemo(() => scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight, [scheme]);
  const textMain = useMemo(() => scheme === 'dark' ? styles.textOnDark : styles.textOnLight, [scheme]);
  const textSub = useMemo(() => scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight, [scheme]);

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
      assignedDeliveryBoy: deliveryBoy?.fullName ?? (c?.assignedDeliveryBoyName ? storedText(c.assignedDeliveryBoyName) : '—'),
      routeName: deliveryBoy?.primaryRouteName ?? c?.routeName ?? '—',
      paymentType: (c as any)?.paymentType ?? '—',
      startDate: c?.subscriptionStartDate ? formatIso(c.subscriptionStartDate) : '—',
      endDate: c?.subscriptionEndDate ? formatIso(c.subscriptionEndDate) : '—',
    };
  }, [c, deliveryBoys.data?.items, lang]);

  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const deliveryMonthOptions = useMemo(
    () => buildSubscriptionMonthOptions(c?.subscriptionStartDate, monthKey),
    [c?.subscriptionStartDate, monthKey],
  );
  /**
   * A single month drives every month-scoped tab, so switching it on one tab carries over to the others. The old
   * per-tab states are kept as aliases below so the rest of this screen reads the same.
   */
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey);
  const deliveryMonth = selectedMonth;
  const setDeliveryMonth = setSelectedMonth;
  const isDeliveryNextDisabled = useMemo(() => deliveryMonth >= monthKey, [deliveryMonth, monthKey]);
  const isDeliveryPrevDisabled = useMemo(
    () => deliveryMonthOptions.length > 0 && deliveryMonth <= deliveryMonthOptions[deliveryMonthOptions.length - 1]!,
    [deliveryMonth, deliveryMonthOptions],
  );
  const [deliverySelectedDayYmd, setDeliverySelectedDayYmd] = useState<string | null>(null);

  const billingMonthOptions = useMemo(() => buildSubscriptionMonthOptions(c?.subscriptionStartDate, monthKey), [c?.subscriptionStartDate, monthKey]);
  const billingMonth = selectedMonth;
  const setBillingMonth = setSelectedMonth;
  const isBillingNextDisabled = useMemo(() => billingMonth >= monthKey, [billingMonth, monthKey]);
  const isBillingPrevDisabled = useMemo(
    () => billingMonthOptions.length > 0 && billingMonth <= billingMonthOptions[billingMonthOptions.length - 1]!,
    [billingMonth, billingMonthOptions],
  );

  const paymentMonthOptions = billingMonthOptions;
  const paymentMonth = selectedMonth;
  const setPaymentMonth = setSelectedMonth;
  const isPaymentNextDisabled = useMemo(() => paymentMonth >= monthKey, [paymentMonth, monthKey]);
  const isPaymentPrevDisabled = useMemo(
    () => paymentMonthOptions.length > 0 && paymentMonth <= paymentMonthOptions[paymentMonthOptions.length - 1]!,
    [paymentMonth, paymentMonthOptions],
  );

  const customerDefaultPaymentMode = useMemo(() => {
    const pref = String((c as any)?.preferredPaymentMode ?? '').trim();
    if ((ADMIN_PAYMENT_MODES as readonly string[]).includes(pref)) return pref as AdminPaymentMode;
    // Customer side should not use Cash; default to UPI when unknown.
    return 'UPI' as AdminPaymentMode;
  }, [c]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<AdminPaymentMode>('UPI');
  const [paymentModeDialogOpen, setPaymentModeDialogOpen] = useState(false);
  const [paymentModeDialogContext, setPaymentModeDialogContext] = useState<null | { month: string; pendingAmount: number }>(null);
  const [paymentDialogPayKind, setPaymentDialogPayKind] = useState<'full' | 'partial'>('full');
  const [paymentDialogPartialAmount, setPaymentDialogPartialAmount] = useState<string>('');
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
  }, []);

  // Somebody who has forgotten their PIN: the dairy forgets it too, and they sign in with their own mobile
  // number again and choose a new one.
  const shared = useStrings('common');
  const resetPin = useResetPin();
  const resetTheirPin = useCallback(
    async (mobile: string) => {
      try {
        await resetPin.mutateAsync(mobile);
        showToast(shared.actions.pinReset);
      } catch {
        showToast(shared.errors.couldNotSave);
      }
    },
    [resetPin, shared, showToast],
  );
  // Stable so AppSnackbar's auto-dismiss timer is not restarted by every render of this screen.
  const dismissToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  const [complaintActionDialogOpen, setComplaintActionDialogOpen] = useState(false);
  const [complaintActionTargetId, setComplaintActionTargetId] = useState<string | null>(null);
  const [complaintActionStatus, setComplaintActionStatus] = useState<'Open' | 'In Progress' | 'Resolved' | 'Closed'>('Open');
  const [complaintActionNote, setComplaintActionNote] = useState('');
  // Debounced dialog inputs: save handlers flush these (a button tap does not blur the input on native).
  const complaintNoteInputRef = useRef<DeferredTextInputHandle>(null);
  const partialAmountInputRef = useRef<DeferredTextInputHandle>(null);

  const setActiveTab = useCallback((nextTab: TabKey) => {
    setTab((currentTab) => (currentTab === nextTab ? currentTab : nextTab));
    // Leaving the delivery tab clears its day selection (done here, not during render — R8).
    if (nextTab !== 'deliveryHistory') setDeliverySelectedDayYmd(null);
  }, []);

  // Stable per-tab callbacks so TabPill memo() is effective
  const onPressOverview = useCallback(() => setActiveTab('overview'), [setActiveTab]);
  const onPressSubscription = useCallback(() => setActiveTab('subscription'), [setActiveTab]);
  const onPressBilling = useCallback(() => setActiveTab('billing'), [setActiveTab]);
  const onPressPayments = useCallback(() => setActiveTab('paymentHistory'), [setActiveTab]);
  const onPressDelivery = useCallback(() => setActiveTab('deliveryHistory'), [setActiveTab]);
  const onPressComplaints = useCallback(() => setActiveTab('complaints'), [setActiveTab]);

  useEffect(() => {
    setSelectedPaymentMode(customerDefaultPaymentMode);
  }, [customerDefaultPaymentMode, paymentMonth]);

  // Heavy month/billing loops only for the visible tab.
  const shouldComputeBillingUi = tab === 'billing';
  const shouldComputePaymentUi = tab === 'paymentHistory';
  const shouldComputeBillingTimeline = shouldComputeBillingUi || shouldComputePaymentUi;
  const shouldComputeDeliveryUi = tab === 'deliveryHistory';

  const billingDiscount = useMemo(() => Math.max(0, Number(c?.discountAmount ?? 0)), [c?.discountAmount]);

  /**
   * Every bill from the first billable month, with unpaid amounts carried forward and payments settling the oldest
   * bill first — the same timeline the customer sees in My bills.
   */
  const billingTimeline = useMemo(() => {
    if (!c || !shouldComputeBillingTimeline) return [];
    return buildBillingTimeline(c, monthKey, { offers: offers.all }).map((row) => ({
      ...row,
      billCalcDateYmd: row.billDateYmd,
    }));
  }, [c, monthKey, shouldComputeBillingTimeline, offers.all]);

  const billingSummaryForSelectedMonth = useMemo(() => {
    const row = billingTimeline.find((x) => x.month === billingMonth);
    if (!row) {
      const billCalcDateYmd = billDateYmdForMonth(billingMonth, c?.billingCycleDate);
      return {
        billCalcDateYmd,
        dueDateYmd: addDaysYmd(billCalcDateYmd, BILL_DUE_GRACE_DAYS),
        baseAmount: 0,
        offerDiscount: 0,
        carryForwardIn: 0,
        invoiceTotal: 0,
        paidApplied: 0,
        pending: 0,
        status: 'Pending' as const,
      };
    }
    return row;
  }, [billingMonth, billingTimeline]);

  /** One line per offer that came off the selected month's bill ("Offer: Festival offer −₹50"). */
  const billingOfferLinesForMonth = useMemo(() => {
    if (!c || !shouldComputeBillingUi || !offers.all.length) return [];
    return offerDiscountsForMonth(c, billingMonth, offers.all);
  }, [billingMonth, c, offers.all, shouldComputeBillingUi]);

  const paymentSummaryForSelectedMonth = useMemo(() => {
    const row = billingTimeline.find((x) => x.month === paymentMonth);
    if (!row) {
      const billCalcDateYmd = billDateYmdForMonth(paymentMonth, c?.billingCycleDate);
      return {
        month: paymentMonth,
        billCalcDateYmd,
        dueDateYmd: addDaysYmd(billCalcDateYmd, BILL_DUE_GRACE_DAYS),
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
        paymentMode: p.paymentMode ? labelOf(text.paymentModes, p.paymentMode) : '—',
        transactionId: p.transactionId ?? '—',
        collectedBy: p.collectedBy ?? '—',
        billingPeriod: `${monthLabel(mm)} (${mm})`,
        paymentStatus: (status === 'Pending' ? 'Unpaid' : status) as 'Paid' | 'Partial' | 'Unpaid',
        previousDueAmount: money(prevDue),
        amountAdjusted: money(adjusted),
        remainingDueAmount: money(remaining),
        advanceAmountAdded: money(advanceAdded),
        paymentNotes: p.notes ? storedText(p.notes) : '—',
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
      paymentStatus: 'Unpaid' as const,
      previousDueAmount: money(startingDue),
      amountAdjusted: money(0),
      remainingDueAmount: money(startingDue),
      advanceAmountAdded: money(0),
      paymentNotes: t.payments.markedUnpaidNote(mm),
      receiptNumber: '—',
      createdBy: t.admin,
      createdAt: fmtDateTime(a.createdAt),
    }));

    return [...paymentRows, ...unpaidRows].sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
  }, [billingTimeline, c, paymentMonth, paymentsForSelectedMonth, shouldComputePaymentUi, t, text]);

  /**
   * What the month's bill is made of, row by row — the same figures the bill adds up: subscription packs delivered
   * at the pack price, and delivered add-ons at the price saved with the order.
   */
  const billingDeliveredProductRowsForMonth = useMemo(() => {
    if (!c) return [];
    if (!shouldComputeBillingUi) return [];
    const month = billingMonth;
    const plans = c.subscriptionPlans ?? [];
    const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

    const subscriptionRows = (c.deliveries ?? [])
      .filter((d) => d?.status === 'Delivered' && String(d.deliveryDate ?? '').slice(0, 7) === month)
      .flatMap((d) => {
        const ymd = String(d.deliveryDate ?? '').slice(0, 10);
        const productName = String(d.productName ?? '').trim();
        const qtyLabel = String(d.quantityLabel ?? '').trim();
        const planIndex = plans.findIndex(
          (p, idx) =>
            norm(p.productName) === norm(productName) &&
            norm(p.quantityLabel) === norm(qtyLabel) &&
            subscriptionPlanActiveOnDateYmd(p as any, ymd) &&
            subscriptionPlanWinsDeliveryAttributionAtYmd(idx, ymd, plans as any),
        );
        if (planIndex < 0) return [];
        const plan = plans[planIndex]!;
        const usual = usualQuantity(plan);
        // Rows written before per-day quantities existed bill at the usual quantity; 0 means only an add-on went.
        const packs = d.subscriptionItems ?? usual;
        if (packs <= 0) return [];
        const unit = planLineTotal(plan as any) / usual;
        return [
          {
            key: `sub_${d.id}_${planIndex}`,
            dateYmd: ymd,
            type: t.lineTypes.subscription,
            productName,
            packSizeLabel: qtyLabel,
            qty: packs,
            pricePerDelivery: money(Math.round(unit)),
            deliveredLast: fmtYmd(ymd),
            qtyDelivered: packs,
            amount: money(Math.round(unit * packs)),
          },
        ];
      });

    const addOnRows = deliveredAddOnsForMonth(c, month).map((o) => {
      const ymd = String(o.deliveryDate ?? o.orderDate ?? '').slice(0, 10);
      const packs = addOnItemCount(o);
      const isCombo = !!o.comboItems?.length;
      const saved = orderSavings(o);
      return {
        key: `add_${o.id}`,
        dateYmd: ymd,
        // Orders under an offer carry a tag; they are already priced at the offer price.
        type: o.offer ? `${t.lineTypes.addOn} · ${t.billing.offerTag}` : t.lineTypes.addOn,
        // A combo reads with what is in it.
        productName: isCombo ? addOnLabel({ ...o, numberOfItems: 1 }, lang) : String(o.productName ?? '').trim(),
        packSizeLabel: isCombo ? offerWords.kinds.combo : String(o.quantityLabel ?? '').trim(),
        qty: packs,
        pricePerDelivery: money(Math.round(Number(o.price ?? 0))),
        deliveredLast: fmtYmd(ymd),
        qtyDelivered: packs,
        amount: saved > 0 ? `${money(addOnLineTotal(o))} (${t.billing.saved(money(saved))})` : money(addOnLineTotal(o)),
      };
    });

    return [...subscriptionRows, ...addOnRows].sort((a, b) =>
      a.dateYmd === b.dateYmd ? a.productName.localeCompare(b.productName) : a.dateYmd.localeCompare(b.dateYmd),
    );
  }, [billingMonth, c, shouldComputeBillingUi, t, lang, offerWords]);

  function billCalcDateForMonth(yyyyMm: string): string {
    return fmtYmd(lastDayYmdForMonth(yyyyMm));
  }

  /** Same rule as the billing timeline: the customer's bill date plus the grace period. */
  function dueDateForMonth(yyyyMm: string): string {
    return fmtYmd(addDaysYmd(billDateYmdForMonth(yyyyMm, c?.billingCycleDate), BILL_DUE_GRACE_DAYS));
  }

  // Responsive breakpoints (admin dashboard)
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  /** Laptops/desktops: tables fit the card width (no sideways scroll); phones/tablets keep the horizontal scroller. */
  const fitTables = isDesktop;

  const pagePadding = isMobile ? 12 : isTablet ? 14 : 16;
  const contentGap = isMobile ? 10 : 12;

  // Header, profile card, tab row and tab content share one centered list-width column (full width on phones).
  const pageMaxWidth = useResponsiveContainerMaxWidth('list');
  const pageWidthStyle = useMemo(
    () => ({ width: '100%' as const, maxWidth: pageMaxWidth, alignSelf: 'center' as const }),
    [pageMaxWidth],
  );

  const complaintDialogStyle = useResponsiveDialogStyle(520);
  const paymentDialogStyle = useResponsiveDialogStyle(440);
  const deliveryDialogStyle = useResponsiveDialogStyle(420);
  /** Scrollable body inside a dialog; the dialog title + actions take the rest of its viewport-capped height. */
  const dialogScrollMaxH = useMemo(() => Math.max(180, Math.min(Math.round(height * 0.6), height - 220)), [height]);
  const deliveryDialogScrollMaxH = useMemo(() => Math.max(220, Math.min(Math.round(height * 0.52), height - 220)), [height]);

  const deliveryMonthDays = useMemo(() => ymdsForMonth(deliveryMonth), [deliveryMonth]);
  /**
   * Each day's planned value — after the customer's skips and quantity changes, add-ons included — the figure the
   * admin's Today list and the delivery boy's run sheet show for the same day.
   */
  const deliveryDayTotals = useMemo(() => {
    if (!shouldComputeDeliveryUi) return new Map<string, number>();
    if (!c) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const ymd of deliveryMonthDays) {
      map.set(ymd, Math.round(buildTodayEntries([c], ymd)[0]?.amount ?? 0));
    }
    return map;
  }, [c, deliveryMonthDays, shouldComputeDeliveryUi]);

  // Pre-index delivery statuses by YMD for O(1) lookups instead of O(D) per cell
  const deliveryStatusByYmd = useMemo(() => {
    const map = new Map<string, { delivered: boolean; missed: boolean }>();
    for (const d of c?.deliveries ?? []) {
      const ymd = String(d.deliveryDate ?? '').slice(0, 10);
      let e = map.get(ymd);
      if (!e) { e = { delivered: false, missed: false }; map.set(ymd, e); }
      if (d.status === 'Delivered') e.delivered = true;
      if (d.status === 'Missed') e.missed = true;
    }
    return map;
  }, [c?.deliveries]);

  const deliveryStatusForDayYmd = useCallback((ymd: string): 'Delivered' | 'Not delivered' | 'Mixed' | '—' => {
    const e = deliveryStatusByYmd.get(ymd);
    if (!e) return '—';
    if (e.delivered && !e.missed) return 'Delivered';
    if (e.missed && !e.delivered) return 'Not delivered';
    if (e.delivered && e.missed) return 'Mixed';
    return '—';
  }, [deliveryStatusByYmd]);

  const deliveryCalendarCells = useMemo(() => {
    if (!shouldComputeDeliveryUi) return [];
    const todayYmd = todayYmdLocal();
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
      (ymd) => (c ? plannedLinesOn(c, ymd).length > 0 : false),
      (ymd) => (c ? addOnsForDate(c, ymd).length > 0 : false),
      getTone,
    );
  }, [c, deliveryMonth, deliveryDayTotals, deliveryStatusForDayYmd, shouldComputeDeliveryUi]);

  const deliveryCalendarLegendFooter = useMemo(
    () => (
      <View style={styles.deliveryCalLegendWrap}>
        <Text variant="labelSmall" style={[styles.bold, textMain]}>
          {t.delivery.colourKey}
        </Text>
        {ADMIN_DELIVERY_LEGEND_ORDER.map((tone) => {
          const row = ADMIN_DELIVERY_CALENDAR.tones[tone];
          const words = t.delivery.legend[tone];
          const sw = scheme === 'dark' ? row.dark : row.light;
          // Swatch + meaning only — the raw rgba/hex values were developer notes, not something admins need.
          return (
            <View key={tone} style={styles.deliveryCalLegendRow}>
              <View style={[styles.deliveryCalSwatch, { backgroundColor: sw.backgroundColor, borderColor: sw.borderColor }]} />
              <View style={styles.deliveryCalLegendTextCol}>
                <Text variant="bodySmall" style={[styles.bold, textMain]} numberOfLines={2}>
                  {words.title}
                </Text>
                <Text variant="bodySmall" style={textSub} numberOfLines={4}>
                  {words.meaning}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    ),
    [scheme, t, textMain, textSub],
  );

  const deliverySelectedDayModel = useMemo(() => {
    if (!shouldComputeDeliveryUi || !c || !deliverySelectedDayYmd) return null;
    const ymd = deliverySelectedDayYmd;
    // What is actually going that day: skipped lines are left out, changed quantities used.
    const plans = plannedLinesOn(c, ymd);
    const addons = addOnsForDate(c, ymd);
    const status = deliveryStatusForDayYmd(ymd);
    const total = Math.round(deliveryDayTotals.get(ymd) ?? 0);
    return { ymd, plans, addons, status, total };
  }, [c, deliveryDayTotals, deliverySelectedDayYmd, deliveryStatusForDayYmd, shouldComputeDeliveryUi]);

  async function setDeliveryStatusForDay(ymd: string, next: 'Delivered' | 'Missed') {
    if (!c) return;
    const now = new Date().toISOString();

    // The same writer as the delivery app: it leaves out what the customer skipped, uses their quantity for the day,
    // records how many packs went, and settles the day's one-off orders.
    let nextList = [...(c.deliveries ?? [])];
    let extraOrders = c.extraOrders ?? [];
    let wroteAny = false;
    try {
      const res = buildDayStatusDeliveries({ customer: c, ymd, next, now });
      nextList = [...res.deliveries];
      extraOrders = res.extraOrders;
      wroteAny = true;
    } catch (err) {
      if (!(err instanceof NothingPlannedError)) throw err;
    }

    if (!wroteAny) {
      showToast(t.delivery.nothingPlanned);
      return;
    }
    try {
      await updateCustomer.mutateAsync({ id: c.id, data: { deliveries: nextList, extraOrders } });
      notifyDeliveryMarked({
        customerId: c.id,
        customerName: c.name,
        dateYmd: ymd,
        delivered: next === 'Delivered',
        itemsLabel: nextList
          .filter((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd)
          .map((d) => [d.productName, d.quantityLabel].filter(Boolean).join(' · '))
          .join(', '),
        deliveryBoyName: 'Admin',
      });
    } catch (e) {
      showToast(t.delivery.couldNotUpdate(errorMessage(e)));
    }
  }

  const tabPillSizeStyle = useMemo(() => isDesktop ? styles.tabPillDesktop : isTablet ? styles.tabPillTablet : styles.tabPillMobile, [isDesktop, isTablet]);
  const tabTextSizeStyle = useMemo(() => isDesktop ? styles.tabText14 : styles.tabText13, [isDesktop]);

  const displayId = useMemo(() => (id ? formatCustomerDisplayId(id) : '—'), [id]);
  const profileInitials = useMemo(() => customerInitials(summary.name === '—' ? '' : summary.name), [summary.name]);
  // The Overview CTA is its own bar below the scroll area (not an overlay), so no extra bottom gap is needed for it.
  const tabScrollFooterPad = tab === 'subscription' ? 160 : 24;

  const openEdit = useCallback(() => {
    // `from: 'detail'` lets the edit screen go back here on save instead of stacking a second detail screen.
    router.push({ pathname: '/(admin)/customers-edit', params: { id, from: 'detail' } });
  }, [id]);

  /** Overview section Edit links open the form scrolled to the same section. */
  const openEditSection = useCallback(
    (section: CustomerFormTab) => {
      router.push({ pathname: '/(admin)/customers-edit', params: { id, from: 'detail', section } });
    },
    [id],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(admin)/customers');
  }, [navigation]);

  const detailHeader = (
    <View style={[styles.detailHeader, pageWidthStyle, { paddingTop: headerPaddingTop }]}>
      <Pressable onPress={handleBack} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t.goBack}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={dairyTactileColors.primaryContainer} />
      </Pressable>
      <Text style={styles.detailHeaderTitle} numberOfLines={1}>
        {t.title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  // No customer yet: explicit loading / not-found / error states instead of an empty dashboard with live actions.
  if (!c) {
    const loadFailed = customer.isError;
    const notFound = !id || customer.data === null;
    return (
      <DairyTactileScreenBackground>
        <View style={styles.screenRoot}>
          {detailHeader}
          <View style={styles.statusWrap}>
            <Text style={styles.statusTitle}>
              {loadFailed ? t.couldNotLoad : notFound ? t.notFound : t.loadingCustomer}
            </Text>
            {loadFailed || notFound ? (
              <>
                <Text style={styles.statusBody}>
                  {loadFailed ? t.loadErrorBody : t.deletedBody}
                </Text>
                <View style={styles.statusActions}>
                  {loadFailed ? (
                    <Button mode="contained" onPress={() => void customer.refetch()}>
                      {t.retry}
                    </Button>
                  ) : null}
                  <Button mode="outlined" onPress={handleBack}>
                    {t.back}
                  </Button>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </DairyTactileScreenBackground>
    );
  }

  return (
    <DairyTactileScreenBackground>
    <View style={styles.screenRoot}>
      {detailHeader}

      <View style={pageWidthStyle}>
        <DetailProfileCard
          name={summary.name}
          memberBadge={memberBadgeLabel(c)}
          initials={profileInitials}
          editLabel={t.editCustomer}
          subtitle={[displayId, c.mobile ? formatMobileDisplay(c.mobile) : ''].filter(Boolean).join(' · ')}
          onEdit={openEdit}
          onResetPin={c.mobile ? () => void resetTheirPin(c.mobile) : undefined}
        />
      </View>

      <View style={[styles.tabsBar, pageWidthStyle]}>
        <View style={[styles.tabsRowWrap, { gap: isMobile ? 6 : 8 }]}>
          <TabPill label={t.tabs.overview} active={tab === 'overview'} onPress={onPressOverview} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          <TabPill label={t.tabs.subscription} active={tab === 'subscription'} onPress={onPressSubscription} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          <TabPill label={t.tabs.billing} active={tab === 'billing'} onPress={onPressBilling} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          <TabPill label={t.tabs.payments} active={tab === 'paymentHistory'} onPress={onPressPayments} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          <TabPill label={isMobile ? t.tabs.delivery : t.tabs.customerDelivery} active={tab === 'deliveryHistory'} onPress={onPressDelivery} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
          <TabPill label={t.tabs.complaints} active={tab === 'complaints'} onPress={onPressComplaints} pillSizeStyle={tabPillSizeStyle} textSizeStyle={tabTextSizeStyle} />
        </View>
      </View>

      {MONTH_SCOPED_TABS.includes(tab) ? (
        <View style={[styles.monthBar, pageWidthStyle]}>
          <PeriodStepper
            label={monthLabel(selectedMonth)}
            hint={selectedMonth === monthKey ? t.month.thisMonth : t.month.tapForThisMonth}
            onPrev={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            onNext={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            nextDisabled={selectedMonth >= monthKey}
            onPressLabel={selectedMonth === monthKey ? undefined : () => setSelectedMonth(monthKey)}
            prevLabel={t.month.previous}
            nextLabel={t.month.next}
          />
        </View>
      ) : null}

      <View style={styles.tabBody}>
          <ScrollView
            style={styles.tabScroll}
            contentContainerStyle={[styles.container, pageWidthStyle, { padding: pagePadding, gap: contentGap, paddingBottom: scrollPaddingBottom(tabScrollFooterPad) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
        {tab === 'subscription' ? (
            c ? (
              <>
                <CustomerSubscriptionTab
                  customer={c}
                  customerId={id}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  isMobile={isMobile}
                  isTablet={isTablet}
                  isDesktop={isDesktop}
                  scheme={scheme}
                  onViewDetailedBill={onPressBilling}
                />
                <CustomerDayChangesCard customer={c} month={selectedMonth} />
              </>
            ) : (
              <DeferredTabPlaceholder label={t.tabs.subscription} sectionCard={sectionCard} textMain={textMain} textSub={textSub} />
            )
        ) : null}
        {tab === 'overview' && c ? (
          <CustomerDetailOverview
            customer={c}
            assignedDeliveryBoy={summary.assignedDeliveryBoy}
            deliveryRoute={summary.routeName}
            billingType={billingTypeDisplay(c)}
            addressTags={overviewAddressTags(c)}
            onEditSection={openEditSection}
            wide={!isMobile}
          />
        ) : null}

        {tab === 'billing' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {t.billing.summaryTitle}
                </Text>
                <Text variant="bodySmall" style={[textSub, { marginBottom: 8 }]}>
                  {t.billing.summaryHint}
                </Text>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.subscriptionAmount}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.baseAmount)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.carryForward}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.carryForwardIn)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.discount}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingDiscount)}
                  </Text>
                </View>
                {billingOfferLinesForMonth.map((line) => (
                  <View key={`offer_${line.offerId}`} style={styles.kvRow}>
                    <Text variant="bodySmall" style={[textSub, styles.kvLabelWrap]}>
                      {offerWords.billLine(offerText(line.title, lang))}
                    </Text>
                    <Text variant="bodyMedium" style={[textMain, styles.offerAmount]}>
                      {`−${money(line.amount)}`}
                    </Text>
                  </View>
                ))}
                {billingSummaryForSelectedMonth.offerDiscount > 0 ? (
                  <>
                    <View style={styles.kvRow}>
                      <Text variant="bodySmall" style={[textSub, styles.bold]}>
                        {offerWords.offerDiscounts}
                      </Text>
                      <Text variant="bodyMedium" style={[textMain, styles.bold, styles.offerAmount]}>
                        {`−${money(billingSummaryForSelectedMonth.offerDiscount)}`}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={textSub}>
                      {t.billing.offerHint}
                    </Text>
                  </>
                ) : null}
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.advance}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(c?.advanceBalance)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.finalPayable}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.invoiceTotal)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.paidApplied}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.paidApplied)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.pendingCarry}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(billingSummaryForSelectedMonth.pending)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.billDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {billCalcDateForMonth(billingMonth)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.dueDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {dueDateForMonth(billingMonth)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.lastPaymentDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {c?.lastPaymentDate ? formatIso(c.lastPaymentDate) : '—'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.status}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {labelOf(t.billStatus, billingSummaryForSelectedMonth.status)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.cycleDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {t.billing.monthEnd}
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {t.billing.deliveredTitle}
                </Text>
                <Text variant="bodySmall" style={textSub}>
                  {t.billing.deliveredHint(monthLabel(billingMonth))}
                </Text>

                <View style={styles.tableWrap}>
                  <TableScroll fit={fitTables}>
                    <View style={[styles.tableMin, fitTables ? styles.tableFit : { minWidth: 860 }]}>
                      <TableRow
                        header
                        cells={[
                          { text: t.billing.columns.date, grow: true },
                          { text: t.billing.columns.type },
                          { text: t.billing.columns.product, grow: true },
                          { text: t.billing.columns.pack, grow: true },
                          { text: t.billing.columns.qty },
                          { text: t.billing.columns.pricePerDelivery },
                          { text: t.billing.columns.deliveredLast },
                          { text: t.billing.columns.qtyDelivered },
                          { text: t.billing.columns.amount },
                        ]}
                      />

                      {billingDeliveredProductRowsForMonth.length ? (
                        billingDeliveredProductRowsForMonth.map((r) => (
                          <TableRow
                            key={r.key}
                            cells={[
                              { text: fmtYmd(r.dateYmd), grow: true },
                              { text: r.type, lines: 2 },
                              // Combos read with their contents, so let long names wrap.
                              { text: r.productName, grow: true, lines: 3 },
                              { text: r.packSizeLabel, grow: true },
                              { text: String(r.qty) },
                              { text: r.pricePerDelivery },
                              { text: r.deliveredLast },
                              { text: String(r.qtyDelivered) },
                              { text: r.amount, lines: 2 },
                            ]}
                          />
                        ))
                      ) : (
                        <TableRow
                          cells={[
                            { text: t.billing.noDelivered, grow: true },
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
                  {t.billing.historyTitle}
                </Text>
                <View style={styles.tableWrap}>
                  <TableScroll fit={fitTables}>
                    <View style={[styles.tableMin, fitTables && styles.tableFit]}>
                      <TableRow
                        header
                        cells={[
                          { text: t.billing.historyColumns.month, grow: true },
                          { text: t.billing.historyColumns.base },
                          ...(offers.all.length ? [{ text: t.billing.historyColumns.offers }] : []),
                          { text: t.billing.historyColumns.carryForward },
                          { text: t.billing.historyColumns.total },
                          { text: t.billing.historyColumns.paid },
                          { text: t.billing.historyColumns.pending },
                          { text: t.billing.historyColumns.billDate },
                          { text: t.billing.historyColumns.dueDate },
                          { text: t.billing.historyColumns.status },
                        ]}
                      />
                      {billingTimeline.map((r) => (
                        <TableRow
                          key={r.month}
                          cells={[
                            { text: monthLabel(r.month), grow: true },
                            { text: money(r.baseAmount) },
                            ...(offers.all.length ? [{ text: r.offerDiscount > 0 ? `−${money(r.offerDiscount)}` : money(0) }] : []),
                            { text: money(r.carryForwardIn) },
                            { text: money(r.invoiceTotal) },
                            { text: money(r.paidApplied) },
                            { text: money(r.pending) },
                            { text: fmtYmd(r.billCalcDateYmd) },
                            { text: fmtYmd(r.dueDateYmd) },
                            { text: labelOf(t.billStatus, r.status), tone: badgeTone(r.status) },
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
            {c && (c.paymentRequests ?? []).some((r) => r.status === 'Pending') ? (
              <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
                <Card.Content style={styles.sectionContent}>
                  <Text variant="titleSmall" style={[styles.bold, textMain]}>
                    {t.payments.toConfirmTitle}
                  </Text>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.toConfirmHint}
                  </Text>
                  <PaymentRequestReview customers={[c]} showCustomer={false} onResult={showToast} />
                </Card.Content>
              </Card>
            ) : null}
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {t.payments.summaryTitle}
                </Text>


                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.billingPeriod}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {monthLabel(paymentMonth)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.paymentStatus}
                  </Text>
                  {(() => {
                    const st = paymentSummaryForSelectedMonth.status;
                    const display = labelOf(t.billStatus, st === 'Pending' ? 'Unpaid' : st);
                    const tone = badgeTone(st);
                    return (
                      <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text variant="labelSmall" style={{ color: tone.fg, fontWeight: '800' }}>
                          {display}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.totalBill}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.invoiceTotal)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.paidAmount}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.paidApplied)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.pendingAmount}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {money(paymentSummaryForSelectedMonth.pending)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.billing.billDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {fmtYmd(paymentSummaryForSelectedMonth.billCalcDateYmd)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.dueDate}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {fmtYmd(paymentSummaryForSelectedMonth.dueDateYmd)}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text variant="bodySmall" style={textSub}>
                    {t.payments.paymentMode}
                  </Text>
                  <Text variant="bodyMedium" style={textMain}>
                    {paymentsForSelectedMonth[0]?.paymentMode ? labelOf(text.paymentModes, paymentsForSelectedMonth[0].paymentMode) : '—'}
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
                    {t.payments.markPaidFull}
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
                          // Keep the month key: `paymentsUnpaidMonths` matches this exact string to find reopened months.
                          action: `Payment marked unpaid for ${paymentMonth}`,
                          updatedBy: 'Admin',
                        },
                      ];
                      try {
                        await updateCustomer.mutateAsync({
                          id: c.id,
                          data: {
                            payments: next as any,
                            audit: nextAudit as any,
                          },
                        });
                        showToast(t.payments.markedUnpaid(monthLabel(paymentMonth)));
                      } catch (e) {
                        showToast(t.payments.couldNotReopen(errorMessage(e)));
                      }
                    }}
                  >
                    {t.payments.markUnpaid}
                  </Button>
                </View>
              </Card.Content>
            </Card>

            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {t.payments.historyTitle}
                </Text>
                {!paymentHistoryRowsForSelectedMonth.length ? (
                  <AdminListEmptyState
                    icon="cash-remove"
                    title={t.payments.emptyTitle}
                    text={t.payments.emptyText}
                  />
                ) : isMobile ? (
                  // Phones read payments as cards; the fifteen-column table needs ~1400px.
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {paymentHistoryRowsForSelectedMonth.map((r) => (
                      <View key={r.id} style={[styles.complaintCard, sectionCard]}>
                        <View style={styles.complaintTop}>
                          <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={1}>
                            {r.paymentAmount}
                          </Text>
                          <DetailStatusPill tone={paymentTone(r.paymentStatus)} label={t.billStatus[r.paymentStatus]} />
                        </View>
                        <Text variant="bodySmall" style={textSub} numberOfLines={2}>
                          {[r.paymentDate, r.paymentMode, r.collectedBy !== '—' ? t.payments.by(r.collectedBy) : '']
                            .filter((x) => x && x !== '—')
                            .join(' · ')}
                        </Text>
                        <View style={styles.paymentCardGrid}>
                          <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                            {t.payments.previousDue(r.previousDueAmount)}
                          </Text>
                          <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                            {t.payments.adjusted(r.amountAdjusted)}
                          </Text>
                          <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                            {t.payments.remaining(r.remainingDueAmount)}
                          </Text>
                          {r.advanceAmountAdded !== '—' ? (
                            <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                              {t.payments.advance(r.advanceAmountAdded)}
                            </Text>
                          ) : null}
                        </View>
                        {r.paymentNotes !== '—' ? (
                          <Text variant="bodySmall" style={textMain} numberOfLines={3}>
                            {r.paymentNotes}
                          </Text>
                        ) : null}
                        {r.transactionId !== '—' || r.receiptNumber !== '—' ? (
                          <Text variant="labelSmall" style={textSub} numberOfLines={2}>
                            {[r.transactionId !== '—' ? t.payments.reference(r.transactionId) : '', r.receiptNumber !== '—' ? t.payments.receipt(r.receiptNumber) : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.tableWrap}>
                  <TableScroll fit={fitTables}>
                    <View style={[styles.tableMin, fitTables ? styles.tableFit : { minWidth: 1400 }]}>
                      <TableRow
                        header
                        cells={[
                          { text: t.payments.columns.paymentDate, grow: true, lines: 2 },
                          { text: t.payments.columns.paymentAmount, lines: 2 },
                          { text: t.payments.columns.paymentMode, lines: 2 },
                          { text: t.payments.columns.reference, grow: true, lines: 2 },
                          { text: t.payments.columns.collectedBy, grow: true, lines: 2 },
                          { text: t.payments.columns.billMonth, grow: true, lines: 2 },
                          { text: t.payments.columns.paymentStatus, lines: 2 },
                          { text: t.payments.columns.previousDue, lines: 2 },
                          { text: t.payments.columns.amountAdjusted, lines: 2 },
                          { text: t.payments.columns.remainingDue, lines: 2 },
                          { text: t.payments.columns.advanceAdded, lines: 2 },
                          { text: t.payments.columns.notes, grow: true, lines: 2 },
                          { text: t.payments.columns.receiptNumber, lines: 2 },
                          { text: t.payments.columns.createdBy, grow: true, lines: 2 },
                          { text: t.payments.columns.createdAt, grow: true, lines: 2 },
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
                              { text: t.billStatus[r.paymentStatus] },
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
                      ) : null}
                    </View>
                  </TableScroll>
                </View>
                )}
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {tab === 'deliveryHistory' ? (
          <View style={styles.sectionStack}>
            <Card style={[styles.sectionCard, sectionCard]} mode="elevated">
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleSmall" style={[styles.bold, textMain]}>
                  {t.delivery.title}
                </Text>

                <Text variant="bodySmall" style={textSub}>
                  {t.delivery.hint}
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
                  onPressDay={(ymd) => {
                    startTransition(() => setDeliverySelectedDayYmd(ymd));
                  }}
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
                  {t.complaints.title}
                </Text>
                <Text variant="bodySmall" style={textSub}>
                  {t.complaints.hint}
                </Text>
                {(() => {
                  const list = [...(c?.complaints ?? [])].sort((a, b) =>
                    String(b.complaintDate ?? '').localeCompare(String(a.complaintDate ?? '')),
                  );

                  if (!list.length) {
                    return (
                      <AdminListEmptyState
                        icon="emoticon-happy-outline"
                        title={t.complaints.emptyTitle}
                        text={t.complaints.emptyText}
                      />
                    );
                  }

                  // Phones read the complaints as cards; the table needs ~980px and would scroll sideways.
                  if (isMobile) {
                    return (
                      <View style={{ gap: 10, marginTop: 4 }}>
                        {list.map((cmp) => {
                          const st = String((cmp as any).status ?? 'Pending');
                          return (
                            <View key={cmp.id} style={[styles.complaintCard, sectionCard]}>
                              <View style={styles.complaintTop}>
                                <Text variant="titleSmall" style={[styles.bold, textMain]} numberOfLines={2}>
                                  {String((cmp as any).type ?? t.complaints.complaint)}
                                </Text>
                                <DetailStatusPill tone={complaintTone(st)} label={labelOf(t.complaints.statuses, st)} />
                              </View>
                              <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                                {[
                                  t.complaints.raised(fmtDate((cmp as any).complaintDate)),
                                  (cmp as any).resolutionDate ? t.complaints.resolved(fmtDate((cmp as any).resolutionDate)) : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Text>
                              {String((cmp as any).description ?? '').trim() ? (
                                <Text variant="bodyMedium" style={textMain} numberOfLines={4}>
                                  {String((cmp as any).description)}
                                </Text>
                              ) : null}
                              {String((cmp as any).resolvedBy ?? '').trim() ? (
                                <Text variant="bodySmall" style={textSub} numberOfLines={1}>
                                  {t.complaints.resolvedBy(labelOf(t.complaints.authors, String((cmp as any).resolvedBy)))}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    );
                  }

                  return (
                    <View style={styles.tableWrap}>
                      <TableScroll fit={fitTables}>
                        <View style={[styles.tableMin, fitTables ? styles.tableFit : { minWidth: 980 }]}>
                          <TableRow
                            header
                            cells={[
                              { text: t.complaints.columns.date, grow: true },
                              { text: t.complaints.columns.type, grow: true },
                              { text: t.complaints.columns.status },
                              { text: t.complaints.columns.resolutionDate },
                              { text: t.complaints.columns.description, grow: true, lines: 2 },
                              { text: t.complaints.columns.resolvedBy, grow: true, lines: 2 },
                            ]}
                          />
                          {list.map((cmp) => {
                            const st = String((cmp as any).status ?? 'Pending');
                            return (
                              <TableRow
                                key={cmp.id}
                                cells={[
                                  { text: fmtDate((cmp as any).complaintDate), grow: true },
                                  { text: String((cmp as any).type ?? '—'), grow: true, lines: 2 },
                                  { text: labelOf(t.complaints.statuses, st), tone: badgeTone(st) },
                                  { text: fmtDate((cmp as any).resolutionDate) },
                                  { text: String((cmp as any).description ?? '—') || '—', grow: true, lines: 3 },
                                  { text: labelOf(t.complaints.authors, String((cmp as any).resolvedBy ?? '—')), grow: true, lines: 2 },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </TableScroll>
                    </View>
                  );
                })()}

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
                        {t.complaints.adminActionsTitle}
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
                                  {fmtDate(cmp.complaintDate)} · {labelOf(t.complaints.statuses, cmp.status)}
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
                                {t.complaints.addAction}
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
                                      {fmtDateTime(String((a as any).createdAt ?? ''))} · {labelOf(t.complaints.authors, String((a as any).createdBy ?? 'Admin'))}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text variant="bodySmall" style={textSub}>
                                {t.complaints.noActions}
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
      </View>

      {tab === 'overview' ? (
        <View style={[styles.overviewFooter, { paddingBottom: scrollPaddingBottom(12) }]}>
          <Pressable
            onPress={onPressSubscription}
            accessibilityRole="button"
            style={({ pressed }) => [styles.overviewFooterInner, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[...dairyGradient.colors]}
              start={dairyGradient.start}
              end={dairyGradient.end}
              style={[styles.addSubscriptionBtn, primaryButtonElevation()]}
            >
              <Text style={styles.addSubscriptionBtnText}>{t.addOrderSubscription}</Text>
              <MaterialCommunityIcons name="arrow-right" size={22} color={dairyTactileColors.onPrimary} />
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      <Portal>
        <Dialog
          visible={complaintActionDialogOpen}
          onDismiss={() => {
            setComplaintActionDialogOpen(false);
            setComplaintActionTargetId(null);
            setComplaintActionNote('');
          }}
          style={[scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight, complaintDialogStyle]}
        >
          <Dialog.Title>{t.complaints.dialogTitle}</Dialog.Title>
          <ScrollView style={{ maxHeight: dialogScrollMaxH }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            <Dialog.Content>
              <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                {t.complaints.dialogHint}
              </Text>

              <View style={{ marginTop: 10, gap: 8 }}>
                <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                  {t.complaints.status}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(['Open', 'In Progress', 'Resolved', 'Closed'] as const).map((st) => (
                    <Button
                      key={st}
                      mode={complaintActionStatus === st ? 'contained' : 'outlined'}
                      onPress={() => setComplaintActionStatus(st)}
                    >
                      {t.complaints.statuses[st]}
                    </Button>
                  ))}
                </View>

                <DeferredTextInput
                  ref={complaintNoteInputRef}
                  {...formFieldAttrs('complaint-admin-note')}
                  mode="outlined"
                  label={t.complaints.adminNote}
                  value={complaintActionNote}
                  onChangeText={setComplaintActionNote}
                  placeholder={t.complaints.notePlaceholder}
                  multiline
                />
              </View>
            </Dialog.Content>
          </ScrollView>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setComplaintActionDialogOpen(false);
                setComplaintActionTargetId(null);
                setComplaintActionNote('');
              }}
            >
              {t.cancel}
            </Button>
            <Button
              mode="contained"
              disabled={!c || !complaintActionTargetId || updateCustomer.isPending}
              loading={updateCustomer.isPending}
              onPress={async () => {
                if (!c || !complaintActionTargetId) return;
                const note = (complaintNoteInputRef.current?.flush() ?? complaintActionNote).trim();
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
                    message: note ? note : `Status updated to ${complaintActionStatus}`,
                    createdBy: 'Admin',
                  },
                ];

                try {
                  await updateCustomer.mutateAsync({
                    id: c.id,
                    data: {
                      complaints: nextComplaints as any,
                      complaintActions: nextActions as any,
                    },
                  });
                } catch (e) {
                  // Keep the dialog (and the typed note) open so the admin can retry.
                  showToast(t.complaints.couldNotSave(errorMessage(e)));
                  return;
                }

                showToast(t.complaints.updated(t.complaints.statuses[complaintActionStatus]));
                setComplaintActionDialogOpen(false);
                setComplaintActionTargetId(null);
                setComplaintActionNote('');
              }}
            >
              {t.complaints.saveAction}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={paymentModeDialogOpen}
          onDismiss={() => {
            setPaymentModeDialogOpen(false);
            setPaymentModeDialogContext(null);
          }}
          style={[scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight, paymentDialogStyle]}
        >
          <Dialog.Title>{t.markPaid.title}</Dialog.Title>
          <ScrollView style={{ maxHeight: dialogScrollMaxH }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            <Dialog.Content>
              <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                {t.markPaid.hint}
              </Text>
              <Text variant="bodySmall" style={[scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight, { marginTop: 6 }]}>
                {paymentModeDialogContext
                  ? t.markPaid.context(monthLabel(paymentModeDialogContext.month), money(paymentModeDialogContext.pendingAmount))
                  : ''}
              </Text>

              {paymentModeDialogContext ? (
                <>
                  <View style={{ marginTop: 12, gap: 8 }}>
                    <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                      {t.payments.paymentMode}
                    </Text>
                    {ADMIN_PAYMENT_MODES.map((m) => {
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
                          <Text variant="bodyMedium">{text.paymentModes[m]}</Text>
                          {active ? <MaterialCommunityIcons name="check" size={18} color={COLORS.accent} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={{ marginTop: 14, gap: 8 }}>
                    <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                      {t.markPaid.paymentType}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      <Button
                        mode={paymentDialogPayKind === 'full' ? 'contained' : 'outlined'}
                        onPress={() => {
                          setPaymentDialogPayKind('full');
                          setPaymentDialogPartialAmount(String(paymentModeDialogContext.pendingAmount));
                        }}
                      >
                        {t.markPaid.full}
                      </Button>
                      <Button
                        mode={paymentDialogPayKind === 'partial' ? 'contained' : 'outlined'}
                        onPress={() => {
                          setPaymentDialogPayKind('partial');
                          setPaymentDialogPartialAmount(String(Math.max(1, Math.min(paymentModeDialogContext.pendingAmount, Number(paymentDialogPartialAmount || 1)))));
                        }}
                      >
                        {t.markPaid.partial}
                      </Button>
                    </View>

                    {paymentDialogPayKind === 'partial' ? (
                      <DeferredTextInput
                        ref={partialAmountInputRef}
                        {...formFieldAttrs('payment-partial-amount')}
                        mode="outlined"
                        keyboardType="numeric"
                        label={t.markPaid.amountPaidNow}
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
                              {t.markPaid.payingNow}
                            </Text>
                            <Text variant="bodyMedium" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                              {money(paidNow)}
                            </Text>
                          </View>
                          <View style={styles.kvRow}>
                            <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                              {t.markPaid.remainingCarry}
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
          </ScrollView>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setPaymentModeDialogOpen(false);
                setPaymentModeDialogContext(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button
              mode="contained"
              disabled={!c || updateCustomer.isPending || !paymentModeDialogContext}
              loading={updateCustomer.isPending}
              onPress={async () => {
                if (!c || !paymentModeDialogContext) return;
                const pending = Math.round(Math.max(0, paymentModeDialogContext.pendingAmount));
                // Flush the debounced amount: the last keystrokes may not have reached state yet.
                const partialText =
                  paymentDialogPayKind === 'partial'
                    ? partialAmountInputRef.current?.flush() ?? paymentDialogPartialAmount
                    : paymentDialogPartialAmount;
                const raw = Number(String(partialText ?? '').trim());
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
                // What is owed after this payment, by the same timeline the customer sees in My bills.
                const afterPayment = { ...c, payments: nextPayments as any };
                const settled = summarizeBilling(afterPayment, buildBillingTimeline(afterPayment, monthKey, { offers: offers.all }), todayYmdLocal());
                try {
                  await updateCustomer.mutateAsync({
                    id: c.id,
                    data: {
                      payments: nextPayments as any,
                      lastPaymentDate: nowIso,
                      pendingAmount: settled.outstanding,
                      advanceBalance: settled.advance,
                      audit: nextAudit as any,
                    },
                  });
                } catch (e) {
                  showToast(t.markPaid.couldNotRecord(errorMessage(e)));
                  return;
                }
                notifyPaymentRecorded({
                  customerId: c.id,
                  amount: payAmount,
                  paymentMode: selectedPaymentMode,
                  dateYmd: todayYmdLocal(),
                  outstandingAfter: settled.outstanding,
                });
                const remaining = Math.max(0, Math.round(pending - payAmount));
                showToast(
                  paymentDialogPayKind === 'full'
                    ? t.markPaid.paidFull(monthLabel(month), money(payAmount), money(remaining))
                    : t.markPaid.paidPartial(monthLabel(month), money(payAmount), money(remaining)),
                );
                setPaymentModeDialogOpen(false);
                setPaymentModeDialogContext(null);
              }}
            >
              {t.markPaid.confirm}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={!!deliverySelectedDayYmd}
          onDismiss={() => setDeliverySelectedDayYmd(null)}
          style={[
            scheme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight,
            styles.deliveryDialogSurface,
            deliveryDialogStyle,
          ]}
        >
          <View style={styles.deliveryDialogClip}>
            <Dialog.Title style={styles.deliveryDialogTitle}>{t.delivery.dayTitle}</Dialog.Title>
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
                    {t.delivery.date}
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
                    {t.delivery.productsAmount}
                  </Text>
                  {deliverySelectedDayModel.plans.map(({ plan: p, quantity }, idx) => (
                    <Text
                      key={`dp_${idx}`}
                      variant="bodySmall"
                      style={[styles.deliveryProductLine, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}
                    >
                      {t.delivery.subscriptionLine(
                        `${p.productName} ${p.quantityLabel}${quantity > 1 ? ` × ${quantity}` : ''}`,
                        money(Math.round((planLineTotal(p as any) / usualQuantity(p)) * quantity)),
                      )}
                    </Text>
                  ))}
                  {deliverySelectedDayModel.addons.map((a) => (
                    <Text
                      key={`da_${a.id}`}
                      variant="bodySmall"
                      style={[styles.deliveryProductLine, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}
                    >
                      {t.delivery.addOnLine(addOnLabel(a, lang), money(addOnLineTotal(a)))}
                      {a.offer
                        ? `\n${[
                            offerWords.billLine(offerText(a.offer.title, lang)),
                            orderSavings(a) > 0 ? t.billing.saved(money(orderSavings(a))) : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}`
                        : ''}
                    </Text>
                  ))}
                  {!deliverySelectedDayModel.plans.length && !deliverySelectedDayModel.addons.length ? (
                    <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
                      {t.delivery.noOrders}
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    {t.delivery.totalAmount}
                  </Text>
                  <Text variant="bodyLarge" style={[styles.deliveryDayValue, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}>
                    ₹{deliverySelectedDayModel.total}
                  </Text>
                </View>

                <View style={[styles.deliveryDayRule, scheme === 'dark' ? styles.deliveryDayRuleDark : styles.deliveryDayRuleLight]} />

                <View style={styles.deliveryDaySection}>
                  <Text variant="labelSmall" style={[styles.deliveryDayLabel, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
                    {t.complaints.status}
                  </Text>
                  <Text variant="bodyMedium" style={[styles.deliveryDayValue, scheme === 'dark' ? styles.textOnDark : styles.textOnLight]}>
                    {labelOf(t.delivery.states, deliverySelectedDayModel.status)}
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
                    {t.delivery.markDelivered}
                  </Button>
                  <Button
                    compact
                    mode="outlined"
                    loading={updateCustomer.isPending}
                    disabled={updateCustomer.isPending || (!deliverySelectedDayModel.plans.length && !deliverySelectedDayModel.addons.length)}
                    onPress={() => void setDeliveryStatusForDay(deliverySelectedDayModel.ymd, 'Missed')}
                    style={styles.deliveryActionBtn}
                  >
                    {t.delivery.markNotDelivered}
                  </Button>
                </View>
              </ScrollView>
            ) : (
              <Text variant="bodySmall" style={textSub}>
                {t.loading}
              </Text>
            )}
            </Dialog.Content>
            <Dialog.Actions style={styles.deliveryDialogActions}>
              <Button compact onPress={() => setDeliverySelectedDayYmd(null)}>
                {t.close}
              </Button>
            </Dialog.Actions>
          </View>
        </Dialog>

        <AppSnackbar
          visible={toast.visible}
          message={toast.message}
          onDismiss={dismissToast}
          duration={3500}
        />
      </Portal>

    </View>
    </DairyTactileScreenBackground>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  bg: { flex: 1 },
  tabBody: { flex: 1, minHeight: 0 },
  /** Shared month stepper under the tabs. */
  monthBar: { paddingHorizontal: amraleSpacing.marginMobile, paddingBottom: amraleSpacing.sm },
  tabScroll: { flex: 1 },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: amraleSpacing.marginMobile,
    paddingBottom: amraleSpacing.sm,
    gap: amraleSpacing.sm,
  },
  detailHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
  },
  headerSpacer: { width: 44 },

  statusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: amraleSpacing.lg, gap: amraleSpacing.sm },
  statusTitle: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    color: dairyTactileColors.onSurface,
    textAlign: 'center',
  },
  statusBody: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: dairyTactileColors.onSurfaceVariant,
    textAlign: 'center',
  },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: amraleSpacing.sm, marginTop: amraleSpacing.xs },
  iconBtn: { width: 44, height: 44, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },

  tabsBar: { paddingHorizontal: amraleSpacing.marginMobile, paddingBottom: amraleSpacing.sm, marginTop: amraleSpacing.sm },

  container: { padding: 16, paddingBottom: 24, gap: 12 },

  // Header CRM card removed; details live in Overview tab.
  kv: { flexGrow: 1, flexBasis: 160, minWidth: 0, gap: 4 },
  // Wraps the value under a long label on narrow phones instead of pushing it past the card edge.
  kvRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 2 },
  bold: { fontWeight: '900' },
  kvLabelWrap: { flexShrink: 1 },
  offerAmount: { color: '#15803D' },

  tabsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabsRowScroll: { flexDirection: 'row', gap: 8 },
  tabsRowScrollMobile: { paddingHorizontal: 16, gap: 6 },
  tabPill: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  tabPillBase: { paddingHorizontal: 12 },
  // Every breakpoint keeps a ≥44px touch target.
  tabPillDesktop: { minHeight: 44 },
  tabPillTablet: { minHeight: 44, paddingHorizontal: 10 },
  tabPillMobile: { minHeight: 44, paddingHorizontal: 12 },
  tabPillActive: {
    backgroundColor: dairyTactileColors.primaryContainer,
    borderColor: dairyTactileColors.primaryContainer,
  },
  tabPillInactive: {
    backgroundColor: dairyTactileColors.surfaceContainer,
    borderColor: dairyTactileColors.outlineVariant,
  },
  tabTextActive: { color: dairyTactileColors.onPrimary, fontSize: 13 },
  tabTextInactive: { color: dairyTactileColors.onSurface, fontSize: 13, opacity: 0.85 },
  tabText14: { fontSize: 14 },
  tabText13: { fontSize: 13 },

  // A solid bar (not a transparent strip) so the scroll area clearly ends above it instead of looking cut off.
  overviewFooter: {
    paddingHorizontal: amraleSpacing.marginMobile,
    paddingTop: amraleSpacing.sm + 2,
    backgroundColor: dairyTactileColors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.outlineVariant,
  },
  /** Sticky CTA stays a centered pill (not an edge-to-edge bar) on tablets/desktops. */
  overviewFooterInner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  addSubscriptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: amraleRadius.pill,
    paddingHorizontal: amraleSpacing.lg,
  },
  addSubscriptionBtnText: {
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: dairyTactileColors.onPrimary,
  },

  sectionStack: { gap: 12 },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    ...platformShadow({ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }),
  },
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
    ...platformShadow({
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    }),
  },

  memoItem: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', backgroundColor: 'rgba(148,163,184,0.06)', paddingHorizontal: 10 },
  memoDot: { width: 12, height: 12, borderRadius: 999, borderWidth: 1, marginTop: 4 },
  memoTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },

  /** Complaint card on phones, where the six-column table would scroll sideways. */
  complaintCard: {
    gap: 6,
    padding: 12,
    borderRadius: amraleRadius.lg,
    borderWidth: 1,
  },
  complaintTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  /** Two-up amounts inside a payment card on phones. */
  paymentCardGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  tableWrap: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', overflow: 'hidden' },
  // flexGrow: a table narrower than its card (tablets) spans the card instead of hugging the left edge.
  tableScroll: { flexGrow: 1 },
  tableMin: { minWidth: 640, flexGrow: 1 },
  tableFitWrap: { width: '100%' },
  tableFit: { minWidth: 0, width: '100%' },
  tableRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  tableRowFit: { gap: 6, paddingHorizontal: 8 },
  tableHeader: { backgroundColor: 'rgba(148,163,184,0.10)', borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.18)' },
  tableHeaderText: { color: 'rgba(30,41,59,0.70)', fontWeight: '900' },
  tableBodyText: { color: COLORS.text },
  cell: { width: 92, flexShrink: 0 },
  cellGrow: { flex: 1, width: 'auto', minWidth: 140 },
  // Desktop fit mode: every column shares the row width (text wraps/ellipsizes); "grow" columns get a larger share.
  cellFit: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  cellGrowFit: { flexGrow: 1.5 },

  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  monthNavBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(148,163,184,0.06)' },
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
    minHeight: 44,
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

  deliveryDialogSurface: { alignSelf: 'center', marginHorizontal: 12, borderRadius: 14 },
  deliveryDialogClip: { overflow: 'hidden', borderRadius: 14 },
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

