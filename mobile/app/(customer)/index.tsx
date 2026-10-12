import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildBillingTimeline, summarizeBilling } from '@/src/components/admin/billingTimeline';
import { buildTodayEntries, shiftYmd, todayYmd } from '@/src/components/admin/dashboardMetrics';
import { LogoutConfirmDialog } from '@/src/components/auth/LogoutConfirmDialog';
import { DashboardCoverSlot } from '@/src/components/dashboard/DashboardCoverSlot';
import { NotificationBell } from '@/src/components/notifications/NotificationBell';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { addOnItemCount, addOnsForDate } from '@/src/domain/customers/addOns';
import {
  dayEditabilityForCustomer,
  deliverablePlansOn,
  isDaySkipped,
  orderCutoffLabel,
  plannedLinesOn,
} from '@/src/domain/customers/daySchedule';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import {
  announcementsForCustomer,
  announcementText,
  isUnreadBy,
  personalize,
  recentAnnouncements,
} from '@/src/domain/announcements/announcements';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useAnnouncements } from '@/src/hooks/announcements/useAnnouncements';
import { conversationFor, unreadFor } from '@/src/domain/chat/chat';
import { useChat } from '@/src/hooks/chat/useChat';
import { useConfirmLogout } from '@/src/hooks/auth';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useNow } from '@/src/hooks/useNow';
import { ContactDairyNote } from '@/src/components/customer/ContactDairyNote';
import { OrderReminderPrompt, ReminderPermissionCard } from '@/src/components/customer/OrderReminderPrompt';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { useLanguage, useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { formatDay, formatMoney } from '@/src/utils/format';
import { profileRouteForRole } from '@/src/utils/profileRoutes';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { liveOffersFor, offerText } from '@/src/domain/offers/offers';
import type { Lang } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type DayState = 'delivered' | 'missed' | 'skipped' | 'coming' | 'nothing';

/** How each day state looks; its label is `customer.home.dayState[state]`, read at render. */
const DAY_STATE: Record<DayState, { icon: IconName; fg: string; bg: string }> = {
  delivered: { icon: 'check-circle', fg: '#16623a', bg: '#dcf3e5' },
  missed: { icon: 'alert-circle', fg: '#9f1d1d', bg: '#fde2e1' },
  skipped: { icon: 'pause-circle', fg: '#4d5b6b', bg: '#eef1f5' },
  coming: { icon: 'truck-delivery', fg: '#0b4fae', bg: '#e3efff' },
  nothing: { icon: 'calendar-blank', fg: '#4d5b6b', bg: '#eef1f5' },
};

type DayLine = { key: string; label: string; count: number; addOn: boolean };

type DaySummary = {
  ymd: string;
  state: DayState;
  lines: DayLine[];
  amount: number;
};

/** What goes to this customer on a day, by the same rules as My days, the run sheet and the bill. */
function summarizeDay(customer: CustomerResponse, ymd: string, lang: Lang): DaySummary {
  const rows = (customer.deliveries ?? []).filter((d) => String(d.deliveryDate ?? '').slice(0, 10) === ymd);
  const lines: DayLine[] = [
    ...plannedLinesOn(customer, ymd).map(({ plan, quantity }) => ({
      key: `plan_${plan.id}`,
      label: [plan.productName, plan.quantityLabel].filter(Boolean).join(' · '),
      count: quantity,
      addOn: false,
    })),
    ...addOnsForDate(customer, ymd).map((o) => ({
      key: `addon_${o.id}`,
      // A combo reads as its offer name in the reader's language.
      label: o.comboItems?.length
        ? offerText(o.offer?.title, lang) || String(o.productName ?? '')
        : [o.productName, o.quantityLabel].filter(Boolean).join(' · '),
      count: addOnItemCount(o),
      addOn: true,
    })),
  ];
  const state: DayState = rows.some((d) => d.status === 'Delivered')
    ? 'delivered'
    : rows.some((d) => d.status === 'Missed')
      ? 'missed'
      : lines.length
        ? 'coming'
        : isDaySkipped(customer.subscriptionExceptions, ymd)
          ? 'skipped'
          : 'nothing';
  return { ymd, state, lines, amount: buildTodayEntries([customer], ymd)[0]?.amount ?? 0 };
}

function greetingFor(now: Date): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function StatePill({ state, labelOverride }: { state: DayState; labelOverride?: string }) {
  const t = useStrings('customer').home;
  const look = DAY_STATE[state];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]}>
      <MaterialCommunityIcons name={look.icon} size={14} color={look.fg} />
      <Text style={[styles.pillText, { color: look.fg }]}>{labelOverride ?? t.dayState[state]}</Text>
    </View>
  );
}

function DayCard({
  title,
  day,
  note,
  emptyText,
  stateLabel,
}: {
  title: string;
  day: DaySummary;
  note?: string;
  emptyText: string;
  stateLabel?: string;
}) {
  const t = useStrings('customer').home;
  return (
    <Pressable
      onPress={() => router.push('/(customer)/my-days')}
      style={({ pressed }) => [styles.card, styles.dayCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.dayCardA11y(title, formatDay(day.ymd), stateLabel ?? t.dayState[day.state])}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dayTitleCol}>
          <Text style={styles.dayTitle}>{title}</Text>
          <Text style={styles.dayDate}>{formatDay(day.ymd, { weekday: true })}</Text>
        </View>
        <StatePill state={day.state} labelOverride={stateLabel} />
      </View>

      {day.lines.length ? (
        <View style={styles.lines}>
          {day.lines.map((line) => (
            <View key={line.key} style={styles.line}>
              <View style={[styles.lineDot, line.addOn && styles.lineDotAddOn]} />
              <Text style={styles.lineLabel} numberOfLines={2}>
                {line.label}
              </Text>
              {line.addOn ? <Text style={styles.addOnTag}>{t.addOnTag}</Text> : null}
              <Text style={styles.lineCount}>× {line.count}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}

      <View style={styles.dayFooter}>
        {day.lines.length ? <Text style={styles.dayAmount}>{formatMoney(day.amount)}</Text> : <View />}
        <View style={styles.linkRow}>
          <Text style={styles.linkText}>{note ?? t.viewDay}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={amraleColors.blue} />
        </View>
      </View>
    </Pressable>
  );
}

type Shortcut = {
  key: string;
  title: string;
  subtitle: string;
  icon: IconName;
  fg: string;
  bg: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function CustomerDashboard() {
  // `t` changes with the language, so memos that build text list it in their deps.
  const t = useStrings('customer').home;
  const c = useStrings('common');
  const lang = useLanguage();
  const { confirmLogout, isLoggingOut, logoutDialogProps } = useConfirmLogout();
  const { headerPaddingTop, scrollPaddingBottom, bottom: bottomInset } = useScreenSafeInsets();
  const { isMobile, contentMaxWidth } = useResponsiveLayout();
  const session = useAuthSession();
  const settingsQuery = useDashboardSettings();
  const cover = settingsQuery.data?.settings.cover;
  const [snack, setSnack] = useState<string | null>(null);
  const dismissSnack = useCallback(() => setSnack(null), []);

  const { customer, isLoading } = useMyCustomer();
  const inbox = useNotifications(customer ? { audience: 'Customer', customerId: customer.id } : null);

  // Ticks while open, so tomorrow's card closes at 9 pm without a reload.
  const now = useNow();
  const ymd = todayYmd(now);
  const tomorrowYmd = useMemo(() => shiftYmd(ymd, 1), [ymd]);

  // An inactive account (usually an unpaid bill) cannot order; bills and help stay open.
  const orderingAllowed = !customer || customer.status !== 'Inactive';

  const today = useMemo(() => (customer ? summarizeDay(customer, ymd, lang) : null), [customer, ymd, lang]);
  const tomorrow = useMemo(() => (customer ? summarizeDay(customer, tomorrowYmd, lang) : null), [customer, tomorrowYmd, lang]);
  const tomorrowEditability = useMemo(
    () => (customer ? dayEditabilityForCustomer(customer, tomorrowYmd, now) : null),
    [customer, now, tomorrowYmd],
  );
  const tomorrowEditable = !!tomorrowEditability?.editable;
  const tomorrowNeedsDairy = !!tomorrowEditability && !tomorrowEditability.editable && !!tomorrowEditability.contactAdmin;

  const offers = useOffers();
  const billing = useMemo(
    () => (customer ? summarizeBilling(customer, buildBillingTimeline(customer, ymd.slice(0, 7), { offers: offers.all }), ymd) : null),
    [customer, ymd, offers.all],
  );

  // The customer's live offers, newest first; the banner shows the first one in the reader's language.
  const liveOffers = useMemo(() => (customer ? liveOffersFor(offers.all, customer, ymd) : []), [customer, offers.all, ymd]);
  const offerBanner = useMemo(() => {
    const first = liveOffers[0];
    if (!first) return null;
    const o = strings('offers', lang);
    return {
      title: offerText(first.title, lang),
      validity: first.endYmd ? o.validTill(formatDay(first.endYmd, { lang })) : o.untilEnded,
      count: liveOffers.length,
    };
  }, [liveOffers, lang]);
  const ot = useStrings('offerCustomer').home;

  const runningPlans = useMemo(() => (customer ? deliverablePlansOn(customer, ymd).length : 0), [customer, ymd]);

  const announcements = useAnnouncements();
  const announcementSummary = useMemo(() => {
    const words = t.shortcuts;
    if (!customer) return words.announcementsDefault;
    // The same last-90-days list the Announcements screen shows.
    const mine = recentAnnouncements(announcementsForCustomer(announcements.all, customer.id));
    const unread = mine.filter((a) => isUnreadBy(a, customer.id)).length;
    if (unread) return words.announcementsNew(unread);
    return mine[0] ? personalize(announcementText(mine[0]).title, customer.name) : words.announcementsDefault;
  }, [announcements.all, customer, t]);

  const chat = useChat();
  const chatSummary = useMemo(() => {
    const words = t.shortcuts;
    if (!customer) return words.chatDefault;
    const unread = unreadFor(conversationFor(chat.all, customer.id), 'customer').length;
    return unread ? words.chatNewReplies(unread) : words.chatDefault;
  }, [chat.all, customer, t]);

  const firstName = (customer?.name ?? '').trim().split(/\s+/)[0] ?? '';

  const shortcuts: Shortcut[] = [
    {
      key: 'subscription',
      title: t.shortcuts.subscription,
      subtitle: runningPlans ? t.shortcuts.subscriptionRunning(runningPlans) : t.shortcuts.subscriptionStart,
      icon: 'calendar-sync-outline',
      fg: amraleColors.blue,
      bg: dairyTactileColors.surfaceContainer,
      onPress: () => router.push('/(customer)/subscription'),
      disabled: !orderingAllowed,
    },
    {
      key: 'days',
      title: t.shortcuts.days,
      subtitle: t.shortcuts.daysSub,
      icon: 'calendar-month-outline',
      fg: '#16623a',
      bg: '#dcf3e5',
      onPress: () => router.push('/(customer)/my-days'),
      disabled: !orderingAllowed,
    },
    {
      key: 'bills',
      title: t.shortcuts.bills,
      subtitle: billing
        ? billing.outstanding > 0
          ? t.shortcuts.billsToPay(formatMoney(billing.outstanding))
          : t.shortcuts.billsAllPaid
        : t.shortcuts.billsDefault,
      icon: 'receipt-text-outline',
      fg: '#9A4F00',
      bg: '#FFEBD2',
      onPress: () => router.push('/(customer)/bills'),
    },
    {
      key: 'offers',
      title: ot.shortcut,
      subtitle: liveOffers.length ? ot.shortcutLive(liveOffers.length) : ot.shortcutSub,
      icon: 'tag-heart-outline',
      fg: '#a3246b',
      bg: '#fbe3f0',
      onPress: () => router.push('/(customer)/offers' as never),
    },
    {
      key: 'reports',
      title: t.shortcuts.reports,
      subtitle: t.shortcuts.reportsSub,
      icon: 'file-chart-outline',
      fg: '#0F766E',
      bg: '#DDF3F0',
      onPress: () => router.push('/(customer)/reports' as never),
    },
    {
      key: 'announcements',
      title: t.shortcuts.announcements,
      subtitle: announcementSummary,
      icon: 'bullhorn-outline',
      fg: '#a3246b',
      bg: '#fbe3f0',
      onPress: () => router.push('/(customer)/announcements'),
    },
    {
      key: 'chat',
      title: t.shortcuts.chat,
      subtitle: chatSummary,
      icon: 'chat-processing-outline',
      fg: '#0b4fae',
      bg: '#e3efff',
      onPress: () => router.push('/(customer)/chat'),
    },
    {
      key: 'support',
      title: t.shortcuts.support,
      subtitle: t.shortcuts.supportSub,
      icon: 'lifebuoy',
      fg: '#6b3fa0',
      bg: '#efe6fb',
      onPress: () => router.push('/(auth)/contact-admin'),
    },
  ];

  const tomorrowNote = tomorrowEditable ? t.changeByTonight(orderCutoffLabel()) : t.viewDay;

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <View style={[styles.appBarRow, { maxWidth: contentMaxWidth }]}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {c.appName}
          </Text>
          <View style={styles.appBarIcons}>
            <NotificationBell
              unread={inbox.unread}
              size={22}
              color={amraleColors.text}
              onPress={() => router.push('/(customer)/notifications')}
            />
            <Pressable
              onPress={() => router.push(profileRouteForRole(session.data?.role ?? 'customer') as never)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.viewProfile}
            >
              <MaterialCommunityIcons name="account-circle-outline" size={24} color={amraleColors.text} />
            </Pressable>
            <Pressable
              onPress={confirmLogout}
              disabled={isLoggingOut}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, isLoggingOut && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={c.actions.logout}
            >
              <MaterialCommunityIcons name="logout" size={22} color={amraleColors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(24) }} showsVerticalScrollIndicator={false}>
        <DashboardCoverSlot cover={cover} loading={settingsQuery.isLoading} />

        <View style={[styles.container, { maxWidth: contentMaxWidth }]}>
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={2}>
              {firstName ? t.greetingWithName(t.greeting[greetingFor(now)], firstName) : t.greeting[greetingFor(now)]}
            </Text>
            <Text style={styles.greetingSub}>{t.subtitle}</Text>
          </View>

          {!orderingAllowed ? (
            <View style={styles.inactiveBanner}>
              <MaterialCommunityIcons name="account-lock-outline" size={22} color="#9f1d1d" />
              <View style={styles.inactiveText}>
                <Text style={styles.inactiveTitle}>{t.inactiveTitle}</Text>
                <Text style={styles.inactiveBody}>{t.inactiveBody}</Text>
              </View>
            </View>
          ) : null}

          {isLoading ? (
            <View style={[styles.card, styles.loadingCard]}>
              <Text style={styles.emptyText}>{t.loadingDay}</Text>
            </View>
          ) : !customer ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.notFoundTitle}</Text>
              <Text style={styles.emptyText}>{t.notFoundBody}</Text>
            </View>
          ) : (
            <>
              {offerBanner ? (
                <Pressable
                  onPress={() => router.push('/(customer)/offers' as never)}
                  style={({ pressed }) => [styles.card, styles.offerCard, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={ot.bannerA11y(offerBanner.title, offerBanner.validity)}
                >
                  <View style={styles.offerIcon}>
                    <MaterialCommunityIcons name="tag-heart-outline" size={24} color="#a3246b" />
                  </View>
                  <View style={styles.offerText}>
                    <Text style={styles.offerLabel}>
                      {ot.bannerTitle(offerBanner.count)}
                    </Text>
                    <Text style={styles.offerTitle} numberOfLines={2}>
                      {offerBanner.title}
                    </Text>
                    <Text style={styles.offerHint} numberOfLines={1}>
                      {offerBanner.count > 1
                        ? `${offerBanner.validity} · ${ot.bannerMore(offerBanner.count - 1)}`
                        : offerBanner.validity}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={amraleColors.textSubtle} />
                </Pressable>
              ) : null}

              <View style={[styles.dayRow, !isMobile && styles.dayRowWide]}>
                {today ? (
                  <View style={!isMobile ? styles.dayCol : undefined}>
                    <DayCard title={c.dates.today} day={today} emptyText={t.todayEmpty} />
                  </View>
                ) : null}
                {tomorrow ? (
                  <View style={!isMobile ? styles.dayCol : undefined}>
                    <DayCard
                      title={c.dates.tomorrow}
                      day={tomorrow}
                      note={tomorrowNote}
                      stateLabel={tomorrow.state === 'coming' ? t.tomorrowPlanned : undefined}
                      emptyText={tomorrowEditable ? t.tomorrowEmptyEditable : t.tomorrowEmpty}
                    />
                    {customer ? (
                      <View style={styles.closedNote}>
                        <OrderReminderPrompt customer={customer} tomorrowYmd={tomorrowYmd} now={now} />
                      </View>
                    ) : null}
                    {tomorrowNeedsDairy ? (
                      <View style={styles.closedNote}>
                        <ContactDairyNote dayYmd={tomorrowYmd} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <ReminderPermissionCard />

              {billing ? (
                <Pressable
                  onPress={() => router.push('/(customer)/bills')}
                  style={({ pressed }) => [styles.card, styles.billCard, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t.bill.a11y(formatMoney(billing.outstanding))}
                >
                  <View style={[styles.billIcon, billing.overdue > 0 && styles.billIconAlert]}>
                    <MaterialCommunityIcons
                      name={billing.overdue > 0 ? 'alert-circle-outline' : 'wallet-outline'}
                      size={24}
                      color={billing.overdue > 0 ? '#9f1d1d' : amraleColors.blue}
                    />
                  </View>
                  <View style={styles.billText}>
                    <Text style={styles.billLabel}>{t.bill.toPay}</Text>
                    <Text style={styles.billValue}>{formatMoney(billing.outstanding)}</Text>
                    <Text style={[styles.billHint, billing.overdue > 0 && styles.billHintAlert]} numberOfLines={2}>
                      {billing.overdue > 0
                        ? t.bill.overdue(formatMoney(billing.overdue))
                        : billing.outstanding > 0
                          ? t.bill.includesThisMonth
                          : billing.advance > 0
                            ? t.bill.advance(formatMoney(billing.advance))
                            : t.bill.allPaid}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={amraleColors.textSubtle} />
                </Pressable>
              ) : null}
            </>
          )}

          <Text style={styles.sectionTitle}>{t.shortcutsTitle}</Text>
          <View style={styles.grid}>
            {shortcuts.map((s) => (
              <Pressable
                key={s.key}
                onPress={s.onPress}
                disabled={s.disabled}
                style={({ pressed }) => [
                  styles.card,
                  styles.shortcut,
                  isMobile ? styles.shortcutHalf : styles.shortcutQuarter,
                  pressed && styles.pressed,
                  s.disabled && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t.shortcutA11y(s.title, s.subtitle)}
              >
                <View style={[styles.shortcutIcon, { backgroundColor: s.bg }]}>
                  <MaterialCommunityIcons name={s.icon} size={22} color={s.fg} />
                </View>
                <Text style={styles.shortcutTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={styles.shortcutSub} numberOfLines={2}>
                  {s.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <LogoutConfirmDialog {...logoutDialogProps} />

      <AppSnackbar visible={!!snack} message={snack ?? ''} onDismiss={dismissSnack} bottomOffset={bottomInset} />
    </View>
  );
}

const styles = StyleSheet.create({
  closedNote: { marginTop: 8 },
  screen: { flex: 1, backgroundColor: amraleColors.surface },

  appBar: { paddingHorizontal: amraleSpacing.md, paddingBottom: 10, backgroundColor: amraleColors.surface },
  appBarRow: { width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandTitle: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    color: amraleColors.blue,
  },
  appBarIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },

  container: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: amraleSpacing.md,
    paddingTop: amraleSpacing.md,
    gap: amraleSpacing.md,
  },

  greeting: { gap: 4 },
  greetingTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 22, lineHeight: 28, color: amraleColors.text },
  greetingSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },

  inactiveBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: amraleSpacing.md,
    borderRadius: amraleRadius.lg,
    backgroundColor: '#fde2e1',
  },
  inactiveText: { flex: 1, minWidth: 0, gap: 2 },
  inactiveTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: '#9f1d1d' },
  inactiveBody: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: '#7a1c1c' },

  card: {
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
    padding: amraleSpacing.md,
  },
  cardTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, marginBottom: 4 },
  loadingCard: { alignItems: 'center' },

  dayRow: { gap: amraleSpacing.md },
  dayRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  dayCol: { flex: 1, minWidth: 0 },
  dayCard: { gap: 12, flexGrow: 1 },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  dayTitleCol: { flexShrink: 1, gap: 2 },
  dayTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 17, color: amraleColors.text },
  dayDate: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: amraleRadius.pill,
  },
  pillText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12 },
  lines: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: amraleColors.blue },
  lineDotAddOn: { backgroundColor: '#E08A00' },
  lineLabel: { flex: 1, minWidth: 0, fontFamily: amraleTypography.fontFamily.medium, fontSize: 14, color: amraleColors.text },
  addOnTag: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 11,
    color: '#9A4F00',
    backgroundColor: '#FFEBD2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: amraleRadius.pill,
    overflow: 'hidden',
  },
  lineCount: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.textMuted },
  emptyText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, lineHeight: 20, color: amraleColors.textMuted },
  dayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: dairyTactileColors.surfaceContainer,
    marginTop: 'auto',
  },
  dayAmount: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  linkText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue, flexShrink: 1 },

  offerCard: { flexDirection: 'row', alignItems: 'center', gap: amraleSpacing.md, backgroundColor: '#fff7fb', borderColor: '#f3c6de' },
  offerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbe3f0' },
  offerText: { flex: 1, minWidth: 0, gap: 1 },
  offerLabel: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 12, color: '#a3246b' },
  offerTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, lineHeight: 21, color: amraleColors.text },
  offerHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },

  billCard: { flexDirection: 'row', alignItems: 'center', gap: amraleSpacing.md },
  billIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dairyTactileColors.surfaceContainer,
  },
  billIconAlert: { backgroundColor: '#fde2e1' },
  billText: { flex: 1, minWidth: 0, gap: 1 },
  billLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.textMuted },
  billValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 24, lineHeight: 30, color: amraleColors.text },
  billHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },
  billHintAlert: { fontFamily: amraleTypography.fontFamily.semiBold, color: '#9f1d1d' },

  sectionTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.text, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut: { gap: 8 },
  // Two per row on phones, four on wider screens; the gap is taken out of each tile's share.
  shortcutHalf: { flexBasis: '46%', flexGrow: 1 },
  shortcutQuarter: { flexBasis: '30%', flexGrow: 1 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  shortcutSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, lineHeight: 18, color: amraleColors.textMuted },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
