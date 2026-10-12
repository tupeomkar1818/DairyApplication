import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { buildTodayEntries, filterTodayEntries, todayYmd } from '@/src/components/admin/dashboardMetrics';
import { LogoutConfirmDialog } from '@/src/components/auth/LogoutConfirmDialog';
import { DashboardCoverSlot } from '@/src/components/dashboard/DashboardCoverSlot';
import { lastVisibleDeliveryDay, orderCutoffLabel } from '@/src/components/delivery/deliveryWindow';
import { useDeliveryLayout } from '@/src/components/delivery/layout';
import { buildLoadSheet, loadSheetItemCount } from '@/src/components/delivery/loadSheet';
import { buildMySalaryMonth, formatRupees } from '@/src/components/delivery/mySalary';
import { NotificationBell } from '@/src/components/notifications/NotificationBell';
import { ResponsiveContainer } from '@/src/components/shared/ResponsiveContainer';
import { ORDER_CUTOFF_HOUR } from '@/src/domain/customers/daySchedule';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useConfirmLogout } from '@/src/hooks/auth';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useMyCustomers, useMyDeliveryBoy } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { strings } from '@/src/i18n/strings';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyTactileColors } from '@/src/theme/dairyTactile';
import { formatDay } from '@/src/utils/format';
import { profileRouteForRole } from '@/src/utils/profileRoutes';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function greetingFor(now: Date): string {
  const t = strings('delivery').home;
  const h = now.getHours();
  if (h < 12) return t.greetingMorning;
  if (h < 17) return t.greetingAfternoon;
  return t.greetingEvening;
}

/** The delivery partner's home: today's round at a glance, tomorrow's load, this month's pay, and shortcuts. */
export default function DeliveryDashboard() {
  const t = useStrings('delivery');
  const common = useStrings('common');
  const { confirmLogout, isLoggingOut, logoutDialogProps } = useConfirmLogout();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const layout = useDeliveryLayout();
  // Four stats fit on one line from a large phone up; smaller screens get two per line so labels never collide.
  const statsTwoUp = useWindowDimensions().width < 480;
  const session = useAuthSession();
  const settingsQuery = useDashboardSettings();
  const cover = settingsQuery.data?.settings.cover;

  const { customers: myCustomers, isLoading: mineLoading } = useMyCustomers();
  const { boy, allBoys } = useMyDeliveryBoy();
  const inboxAddress = useMemo(() => (boy ? { audience: 'DeliveryBoy' as const, deliveryBoyId: boy.id } : null), [boy]);
  const inbox = useNotifications(inboxAddress);

  const now = useMemo(() => new Date(), []);
  const ymd = useMemo(() => todayYmd(now), [now]);
  const tomorrowYmd = useMemo(() => lastVisibleDeliveryDay(ymd), [ymd]);
  const thisMonth = ymd.slice(0, 7);

  // Today's round.
  const entries = useMemo(() => buildTodayEntries(myCustomers, ymd), [myCustomers, ymd]);
  const itemsToCarry = useMemo(() => loadSheetItemCount(buildLoadSheet(entries)), [entries]);
  const delivered = useMemo(() => filterTodayEntries(entries, 'delivered').length, [entries]);
  const missed = useMemo(() => filterTodayEntries(entries, 'missed').length, [entries]);
  const toDeliver = Math.max(0, entries.length - delivered - missed);
  const marked = delivered + missed;
  const progress = entries.length ? marked / entries.length : 0;

  // Tomorrow — the furthest a delivery partner looks ahead.
  const tomorrowEntries = useMemo(() => buildTodayEntries(myCustomers, tomorrowYmd), [myCustomers, tomorrowYmd]);
  const tomorrowItems = useMemo(() => loadSheetItemCount(buildLoadSheet(tomorrowEntries)), [tomorrowEntries]);
  const tomorrowSettled = now.getHours() >= ORDER_CUTOFF_HOUR;

  const salary = useMemo(() => buildMySalaryMonth(boy as never, allBoys as never, thisMonth), [allBoys, boy, thisMonth]);

  const firstName = (boy?.fullName ?? '').trim().split(/\s+/)[0] ?? '';
  const variant = layout.isWide ? 'list' : 'form';

  const openRun = (date?: string) => router.push(date ? { pathname: '/(delivery)/run', params: { date } } : '/(delivery)/run');

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <ResponsiveContainer variant={variant} style={styles.appBarRow}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {common.appName}
          </Text>
          <NotificationBell
            unread={inbox.unread}
            size={22}
            color={amraleColors.text}
            onPress={() => router.push('/(delivery)/delivery-notifications')}
          />
          <Pressable
            onPress={() => router.push(profileRouteForRole(session.data?.role ?? 'delivery_boy') as never)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.home.viewProfile}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={amraleColors.text} />
          </Pressable>
          <Pressable
            onPress={confirmLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, isLoggingOut && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={common.actions.logout}
          >
            <MaterialCommunityIcons name="logout" size={22} color={amraleColors.text} />
          </Pressable>
        </ResponsiveContainer>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(24) }} showsVerticalScrollIndicator={false}>
        <DashboardCoverSlot cover={cover} loading={settingsQuery.isLoading} />

        <ResponsiveContainer variant={variant} style={styles.body}>
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle} numberOfLines={2}>
              {firstName ? t.home.greetingWithName(greetingFor(now), firstName) : greetingFor(now)}
            </Text>
            <Text style={styles.greetingSub}>{t.home.subtitle}</Text>
          </View>

          {/* Today's round */}
          <Pressable
            onPress={() => openRun()}
            style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.home.runA11y(marked, entries.length)}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroTitleCol}>
                <Text style={styles.heroLabel}>{t.todaysRun}</Text>
                <Text style={styles.heroDate}>{formatDay(ymd, { weekday: true })}</Text>
              </View>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={amraleColors.white} />
              </View>
            </View>

            {mineLoading ? (
              <Text style={styles.heroHint}>{t.home.loadingStops}</Text>
            ) : entries.length === 0 ? (
              <Text style={styles.heroValueSmall}>{t.home.noDeliveriesToday}</Text>
            ) : (
              <>
                <Text style={styles.heroValue}>
                  {marked}
                  <Text style={styles.heroValueOf}>{t.home.ofStopsDone(entries.length)}</Text>
                </Text>
                <View style={styles.progressTrack} accessibilityElementsHidden>
                  <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <View style={styles.heroStats}>
                  <HeroStat label={t.home.toDeliver} value={toDeliver} half={statsTwoUp} />
                  <HeroStat label={t.home.delivered} value={delivered} half={statsTwoUp} />
                  <HeroStat label={t.home.notDelivered} value={missed} half={statsTwoUp} />
                  <HeroStat label={t.home.itemsToCarry} value={itemsToCarry} half={statsTwoUp} />
                </View>
              </>
            )}

            <View style={styles.heroButton}>
              <Text style={styles.heroButtonText}>{toDeliver > 0 ? t.home.continueRun : t.openRunSheet}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={amraleColors.blue} />
            </View>
          </Pressable>

          <View style={[styles.cardRow, layout.isWide && styles.cardRowWide]}>
            {/* Tomorrow */}
            <Pressable
              onPress={() => openRun(tomorrowYmd)}
              style={({ pressed }) => [styles.card, layout.isWide && styles.cardHalf, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.home.tomorrowA11y(t.units.stops(tomorrowEntries.length))}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: '#e3efff' }]}>
                  <MaterialCommunityIcons name="calendar-arrow-right" size={20} color="#0b4fae" />
                </View>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle}>{t.tomorrowsOrders}</Text>
                  <Text style={styles.cardSub}>{formatDay(tomorrowYmd, { weekday: true })}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
              </View>
              <Text style={styles.cardValue}>
                {mineLoading
                  ? '—'
                  : tomorrowEntries.length
                    ? `${t.units.stops(tomorrowEntries.length)} · ${t.units.items(tomorrowItems)}`
                    : t.home.nothingPlanned}
              </Text>
              <Text style={styles.cardNote}>
                {tomorrowSettled
                  ? t.home.tomorrowClosed
                  : t.home.tomorrowOpenUntil(orderCutoffLabel())}
              </Text>
            </Pressable>

            {/* This month's pay */}
            <Pressable
              onPress={() => router.push('/(delivery)/salary')}
              style={({ pressed }) => [styles.card, layout.isWide && styles.cardHalf, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.home.salaryA11y(formatRupees(salary.earned))}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: '#dcf3e5' }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={20} color="#16623a" />
                </View>
                <View style={styles.cardTitleCol}>
                  <Text style={styles.cardTitle}>{t.home.mySalary}</Text>
                  <Text style={styles.cardSub}>{t.home.thisMonthSoFar}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
              </View>
              <Text style={styles.cardValue}>{formatRupees(salary.earned)}</Text>
              <Text style={styles.cardNote}>{t.home.presentAbsent(salary.presentDays, salary.absentDays)}</Text>
            </Pressable>
          </View>

          <View style={[styles.cardRow, layout.isWide && styles.cardRowWide]}>
            <LinkRow
              icon="calendar-check-outline"
              title={t.home.attendanceTitle}
              hint={t.home.attendanceHint}
              onPress={() => router.push('/(delivery)/attendance')}
              wide={layout.isWide}
            />
            <LinkRow
              icon="history"
              title={t.home.historyTitle}
              hint={t.home.historyHint}
              onPress={() => router.push('/(delivery)/day-orders')}
              wide={layout.isWide}
            />
          </View>

          <View style={[styles.cardRow, layout.isWide && styles.cardRowWide]}>
            <LinkRow
              icon="file-chart-outline"
              title={t.home.reportsTitle}
              hint={t.home.reportsHint}
              onPress={() => router.push('/(delivery)/reports' as never)}
              wide={layout.isWide}
            />
          </View>
        </ResponsiveContainer>
      </ScrollView>

      <LogoutConfirmDialog {...logoutDialogProps} />
    </View>
  );
}

function HeroStat({ label, value, half }: { label: string; value: number; half: boolean }) {
  return (
    <View style={[styles.heroStat, half && styles.heroStatHalf]}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function LinkRow({
  icon,
  title,
  hint,
  onPress,
  wide,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
  wide: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, wide && styles.cardHalf, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <MaterialCommunityIcons name={icon} size={22} color={amraleColors.blue} />
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkHint} numberOfLines={2}>
          {hint}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },

  appBar: { paddingHorizontal: amraleSpacing.md, paddingBottom: 10, backgroundColor: amraleColors.surface },
  appBarRow: { flexDirection: 'row', alignItems: 'center' },
  brandTitle: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 22,
    color: amraleColors.blue,
  },
  iconBtn: { width: 44, height: 44, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: amraleSpacing.md, paddingTop: amraleSpacing.md, gap: 12 },

  greeting: { gap: 4, marginBottom: 2 },
  greetingTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 22, lineHeight: 28, color: amraleColors.text },
  greetingSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: amraleColors.textMuted },

  hero: { gap: 10, padding: 16, borderRadius: amraleRadius.xl, backgroundColor: amraleColors.blue },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  heroTitleCol: { flexShrink: 1, gap: 2 },
  heroLabel: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, color: amraleColors.white },
  heroDate: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 30, lineHeight: 36, color: amraleColors.white },
  heroValueOf: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 16, color: 'rgba(255,255,255,0.9)' },
  heroValueSmall: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, color: amraleColors.white },
  heroHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: amraleColors.white },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  heroStat: { flexBasis: '25%', flexGrow: 1, gap: 1 },
  heroStatHalf: { flexBasis: '50%' },
  heroStatValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 18, color: amraleColors.white },
  heroStatLabel: { fontFamily: amraleTypography.fontFamily.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: 2,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.white,
  },
  heroButtonText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.blue },

  cardRow: { gap: 12 },
  cardRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  cardHalf: { flex: 1, minWidth: 0 },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitleCol: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 15, color: amraleColors.text },
  cardSub: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textMuted },
  cardValue: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 20, lineHeight: 26, color: amraleColors.text, marginTop: 4 },
  cardNote: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, lineHeight: 17, color: amraleColors.textMuted },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.xl,
    borderWidth: 1,
    borderColor: dairyTactileColors.outlineVariant,
    backgroundColor: amraleColors.white,
  },
  linkText: { flex: 1, minWidth: 0, gap: 1 },
  linkTitle: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 15, color: amraleColors.text },
  linkHint: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 13, color: amraleColors.textMuted },

  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
