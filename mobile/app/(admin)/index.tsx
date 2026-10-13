import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { monthLabel } from '@/src/components/admin/customerSubscriptionMonthUtils';
import {
  computeDashboardAlerts,
  computeMoneyMetrics,
  computePayrollDue,
  computeTeamToday,
  computeTodayMetrics,
  monthKeyOf,
  todayYmd,
  type DashboardAlertKey,
} from '@/src/components/admin/dashboardMetrics';
import { LogoutConfirmDialog } from '@/src/components/auth/LogoutConfirmDialog';
import { DashboardCoverSlot } from '@/src/components/dashboard/DashboardCoverSlot';
import { usePickDashboardCover } from '@/src/components/dashboard/usePickDashboardCover';
import { NotificationBell } from '@/src/components/notifications/NotificationBell';
import { AppSnackbar } from '@/src/components/shared/AppSnackbar';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useConfirmLogout } from '@/src/hooks/auth';
import { useStrings } from '@/src/i18n/useStrings';
import { isOwner } from '@/src/domain/shared/enums';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useCustomers } from '@/src/hooks/customers';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { conversationSummaries } from '@/src/domain/chat/chat';
import { useChat } from '@/src/hooks/chat/useChat';
import { useProducts } from '@/src/hooks/products';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';
import { profileRouteForRole } from '@/src/utils/profileRoutes';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';
import { formatDay } from '@/src/utils/format';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { offerStatus } from '@/src/domain/offers/offers';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Tile = {
  key: string;
  label: string;
  value: string;
  icon: IconName;
  /** Icon colour; every tile shares the same card surface. */
  tint: string;
  /** Optional second line, e.g. "2 customers". */
  hint?: string;
  /** Screen this tile opens; tiles without one are read-only. */
  href?: string;
};

type ManageRow = {
  key: string;
  title: string;
  subtitle: string;
  icon: IconName;
  /** List screen the row opens. */
  href?: string;
  /** Add screen behind the "+" shortcut. */
  addHref?: string;
  /** No screen yet — shown as SOON, and tapping says so. */
  soon?: boolean;
};

const TINT = {
  blue: amraleColors.blue,
  teal: '#0F766E',
  amber: '#B45309',
  rose: '#BE123C',
  green: '#15803D',
} as const;

/** Where each alert leads; its label is `admin.dashboard.alerts[key]`, looked up at render. */
const ALERT_COPY: Record<DashboardAlertKey, { icon: IconName; href: string }> = {
  paymentsToConfirm: { icon: 'cash-clock', href: '/(admin)/payment-requests' },
  openComplaints: { icon: 'message-alert-outline', href: '/(admin)/customers' },
  customersWithoutRoute: { icon: 'map-marker-off-outline', href: '/(admin)/customers' },
  plansOnInactiveProducts: { icon: 'package-variant-closed', href: '/(admin)/products' },
  customersWithoutPlan: { icon: 'clipboard-alert-outline', href: '/(admin)/customers' },
  boysWithoutRoute: { icon: 'truck-outline', href: '/(admin)/delivery' },
  attendanceUnmarked: { icon: 'calendar-question', href: '/(admin)/delivery' },
};

/** Long money strings step down a size so they never clip in a half-width phone tile. */
function valueSizeStyle(value: string) {
  if (value.length <= 6) return null;
  if (value.length <= 9) return { fontSize: 20, lineHeight: 26 };
  return { fontSize: 17, lineHeight: 22 };
}

function money(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/** Every row addressed to the dairy — stable, so the inbox hook does not refilter on each render. */
const ADMIN_INBOX = { audience: 'Admin' } as const;

export default function AdminDashboard() {
  // Each language's dictionary is its own object, so `t` in memo deps also tracks a language change.
  const t = useStrings('admin');
  const tc = useStrings('common');
  const { confirmLogout, isLoggingOut, logoutDialogProps } = useConfirmLogout();
  const session = useAuthSession();
  const inbox = useNotifications(ADMIN_INBOX);
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, contentMaxWidth } = useResponsiveLayout();
  const settingsQuery = useDashboardSettings();
  const { pickCover, isUpdating: isCoverUpdating, error: coverError, clearError: clearCoverError } = usePickDashboardCover();
  const [snack, setSnack] = useState<string | null>(null);
  const dismissSnack = useCallback(() => {
    setSnack(null);
    clearCoverError();
  }, [clearCoverError]);
  const snackMessage = snack ?? coverError;

  const products = useProducts();
  const customers = useCustomers();
  const offers = useOffers();
  const deliveryBoys = useDeliveryBoys();

  const pagePad = amraleSpacing.md;
  const cardGap = 12;
  /**
   * Widths are computed from the content column rather than set in percentages, so the last row of a grid never
   * leaves a ragged gap: 2 tiles per row on phones, 4 once the column is wide enough for 140px tiles; list rows
   * go two-up from ~700px.
   */
  const innerW = Math.max(0, Math.min(contentMaxWidth, width) - pagePad * 2);
  const tileColumns = innerW >= 620 ? 4 : 2;
  const tileWidth = (innerW - cardGap * (tileColumns - 1)) / tileColumns;
  const rowColumns = innerW >= 700 ? 2 : 1;
  const rowWidth = rowColumns === 1 ? innerW : (innerW - cardGap) / 2;

  const ymd = useMemo(() => todayYmd(), []);
  const monthKey = monthKeyOf(ymd);
  const customerItems = customers.data?.items;
  const productItems = products.data?.items;
  const boyItems = deliveryBoys.data?.items;

  const today = useMemo(() => computeTodayMetrics(customerItems ?? [], ymd), [customerItems, ymd]);
  const team = useMemo(() => computeTeamToday(boyItems ?? [], ymd), [boyItems, ymd]);
  const moneyMetrics = useMemo(
    () => computeMoneyMetrics(customerItems ?? [], monthKey, 'expected', undefined, offers.all),
    [customerItems, monthKey, offers.all],
  );
  const payrollDue = useMemo(() => computePayrollDue(boyItems ?? [], monthKey), [boyItems, monthKey]);
  const alerts = useMemo(
    () =>
      computeDashboardAlerts({
        customers: customerItems ?? [],
        products: productItems ?? [],
        boys: boyItems ?? [],
        ymd,
      }),
    [customerItems, productItems, boyItems, ymd],
  );

  const todayTiles = useMemo<Tile[]>(
    () => [
      {
        key: 'due',
        label: t.dashboard.tiles.due,
        value: String(today.due),
        icon: 'clipboard-list-outline',
        tint: TINT.blue,
        href: '/(admin)/today?bucket=due',
      },
      {
        key: 'delivered',
        label: t.dashboard.tiles.delivered,
        value: String(today.delivered),
        icon: 'check-circle-outline',
        tint: TINT.green,
        href: '/(admin)/today?bucket=delivered',
      },
      {
        key: 'missed',
        label: t.dashboard.tiles.missed,
        value: String(today.notDelivered),
        icon: 'close-circle-outline',
        tint: TINT.rose,
        href: '/(admin)/today?bucket=missed',
      },
      {
        key: 'addons',
        label: t.dashboard.tiles.addons,
        value: String(today.addOnOrders),
        icon: 'basket-plus-outline',
        tint: TINT.amber,
        href: '/(admin)/today?bucket=addons',
      },
    ],
    [today, t],
  );

  const monthTiles = useMemo<Tile[]>(
    () => [
      {
        key: 'expected',
        label: t.dashboard.tiles.expected,
        value: money(moneyMetrics.expected),
        icon: 'file-document-outline',
        tint: TINT.blue,
        href: '/(admin)/month?bucket=expected',
      },
      {
        key: 'collected',
        label: t.dashboard.tiles.collected,
        value: money(moneyMetrics.collected),
        icon: 'cash-check',
        tint: TINT.green,
        href: '/(admin)/month?bucket=collected',
      },
      {
        key: 'outstanding',
        label: t.dashboard.tiles.outstanding,
        value: money(moneyMetrics.outstanding),
        icon: 'cash-clock',
        tint: TINT.rose,
        href: '/(admin)/month?bucket=outstanding',
        hint: moneyMetrics.outstandingCustomers
          ? t.dashboard.outstandingCustomers(moneyMetrics.outstandingCustomers)
          : undefined,
      },
      {
        key: 'payroll',
        label: t.dashboard.tiles.payroll,
        value: money(payrollDue),
        icon: 'account-cash-outline',
        tint: TINT.teal,
        href: '/(admin)/month?bucket=payroll',
        // Payroll is earned per marked attendance day, the same rule the Salary tab uses.
        hint: t.dashboard.earnedSoFar,
      },
    ],
    [moneyMetrics, payrollDue, t],
  );

  const pendingPayments = useMemo(
    () => (customerItems ?? []).reduce((n, c) => n + (c.paymentRequests ?? []).filter((r) => r.status === 'Pending').length, 0),
    [customerItems],
  );

  const tOffers = useStrings('offerAdmin');
  const tCounter = useStrings('counter');
  const liveOffers = useMemo(() => offers.all.filter((o) => offerStatus(o, todayYmd()) === 'live').length, [offers.all]);

  const chat = useChat();
  const unreadChats = useMemo(
    () => conversationSummaries(chat.all).reduce((sum, s) => sum + s.unreadForAdmin, 0),
    [chat.all],
  );

  const manageRows = useMemo<ManageRow[]>(
    () => [
      {
        key: 'products',
        title: t.dashboard.rows.products.title,
        subtitle: t.dashboard.rows.products.subtitle,
        icon: 'basket-outline',
        href: '/(admin)/products',
        addHref: '/(admin)/products-add',
      },
      {
        key: 'customers',
        title: t.dashboard.rows.customers.title,
        subtitle: t.dashboard.rows.customers.subtitle,
        icon: 'account-group-outline',
        href: '/(admin)/customers',
        addHref: '/(admin)/customers-add',
      },
      {
        key: 'delivery',
        title: t.dashboard.rows.delivery.title,
        subtitle: t.dashboard.rows.delivery.subtitle,
        icon: 'truck-delivery-outline',
        href: '/(admin)/delivery',
        addHref: '/(admin)/delivery-add',
      },
      {
        key: 'chats',
        title: t.dashboard.rows.chats.title,
        subtitle: unreadChats ? t.dashboard.unreadMessages(unreadChats) : t.dashboard.rows.chats.subtitle,
        icon: 'chat-processing-outline',
        href: '/(admin)/admin-chats',
      },
      {
        key: 'announcements',
        title: t.dashboard.rows.announcements.title,
        subtitle: t.dashboard.rows.announcements.subtitle,
        icon: 'bullhorn-outline',
        href: '/(admin)/admin-announcements',
        addHref: '/(admin)/admin-announcement-compose',
      },
      {
        key: 'offers',
        title: tOffers.dashboard.title,
        subtitle: liveOffers ? tOffers.dashboard.live(liveOffers) : tOffers.dashboard.subtitle,
        icon: 'tag-multiple-outline',
        href: '/(admin)/admin-offers',
        addHref: '/(admin)/offer-edit',
      },
      {
        key: 'payments',
        title: t.dashboard.rows.payments.title,
        subtitle: pendingPayments ? t.dashboard.paymentsToConfirm(pendingPayments) : t.dashboard.rows.payments.subtitle,
        icon: 'cash-check',
        href: '/(admin)/payment-requests',
      },
      {
        key: 'counter',
        title: tCounter.day.title,
        subtitle: tCounter.day.subtitle,
        icon: 'cash-register',
        href: '/(admin)/counter-day',
      },
      ...(isOwner(session.data?.role)
        ? [
            {
              key: 'staff',
              title: tCounter.staff.deskTitle,
              subtitle: tCounter.staff.deskSubtitle,
              icon: 'account-tie-outline' as const,
              href: '/(admin)/staff' as const,
            },
          ]
        : []),
      {
        key: 'reports',
        title: t.dashboard.rows.reports.title,
        subtitle: t.dashboard.rows.reports.subtitle,
        icon: 'chart-bar',
        href: '/(admin)/reports',
      },
    ],
    [unreadChats, pendingPayments, liveOffers, t, tOffers, tCounter, session.data?.role],
  );

  const cover = settingsQuery.data?.settings.cover;
  const isLoadingData = customers.isLoading || products.isLoading || deliveryBoys.isLoading;

  function renderTiles(tiles: Tile[]) {
    return (
      <View style={[styles.tileGrid, { gap: cardGap }]}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            onPress={tile.href ? () => router.push(tile.href as never) : undefined}
            disabled={!tile.href}
            style={({ pressed }) => [styles.tile, { width: tileWidth }, tile.href && pressed && styles.tilePressed]}
            accessibilityRole={tile.href ? 'button' : undefined}
            accessibilityLabel={tile.href ? `${tile.label}: ${tile.value}` : undefined}
          >
            <View style={styles.tileTopRow}>
              <View style={[styles.tileIcon, { backgroundColor: `${tile.tint}1F` }]}>
                <MaterialCommunityIcons name={tile.icon} size={20} color={tile.tint} />
              </View>
              {tile.href ? <MaterialCommunityIcons name="chevron-right" size={20} color={amraleColors.textSubtle} /> : null}
            </View>
            {/* The value sits on its own line: money like "₹1,24,500" has no room beside the icon on a phone. */}
            <Text style={[styles.tileValue, valueSizeStyle(isLoadingData ? '—' : tile.value)]} numberOfLines={1}>
              {isLoadingData ? '—' : tile.value}
            </Text>
            <Text style={styles.tileLabel} numberOfLines={2}>
              {tile.label}
            </Text>
            {tile.hint ? (
              <Text style={styles.tileHint} numberOfLines={1}>
                {tile.hint}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.brandTitle} numberOfLines={1}>
          {tc.appName}
        </Text>
        <View style={styles.appBarIcons}>
          <NotificationBell unread={inbox.unread} onPress={() => router.push('/(admin)/admin-notifications')} />
          <Pressable
            onPress={() => router.push(profileRouteForRole(session.data?.role ?? 'admin') as never)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.dashboard.viewProfile}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={amraleColors.text} />
          </Pressable>
          <Pressable
            onPress={confirmLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, isLoggingOut && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={tc.actions.logout}
          >
            <MaterialCommunityIcons name="logout" size={20} color={amraleColors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom(24) }} showsVerticalScrollIndicator={false}>
        <DashboardCoverSlot
          cover={cover}
          loading={settingsQuery.isLoading}
          editable
          onPressEdit={pickCover}
          isUpdating={isCoverUpdating}
        />

        <View style={[styles.body, { paddingHorizontal: pagePad, maxWidth: contentMaxWidth }]}>
          <View style={styles.welcomeBlock}>
            <Text style={styles.welcomeTitle}>{t.dashboard.welcomeTitle}</Text>
            <Text style={styles.welcomeHint}>{t.dashboard.welcomeHint}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tc.dates.today}</Text>
              <Text style={styles.sectionMeta} numberOfLines={1}>
                {formatDay(todayYmd(), { weekday: true })}
              </Text>
            </View>
            {renderTiles(todayTiles)}
            {/* Opens the same three groups as a list, with the boys behind each number. */}
            <Pressable
              onPress={() => router.push('/(admin)/team-today' as never)}
              style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed]}
              accessibilityRole="button"
              accessibilityLabel={t.dashboard.teamA11y(team.present, team.absent, team.unmarked)}
            >
              <MaterialCommunityIcons name="account-hard-hat-outline" size={16} color={amraleColors.textSubtle} />
              <Text style={styles.teamText} numberOfLines={2}>
                {t.dashboard.teamLine(team.present, team.absent, team.unmarked)}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={amraleColors.textSubtle} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tc.dates.thisMonth}</Text>
              <Text style={styles.sectionMeta} numberOfLines={1}>
                {monthLabel(monthKey)}
              </Text>
            </View>
            {renderTiles(monthTiles)}
          </View>

          {alerts.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.dashboard.needsAttention}</Text>
              <View style={[styles.rowGrid, { gap: cardGap }]}>
                {alerts.map((a) => {
                  const copy = ALERT_COPY[a.key];
                  const label = t.dashboard.alerts[a.key];
                  return (
                    <Pressable
                      key={a.key}
                      onPress={() => router.push(copy.href as never)}
                      style={({ pressed }) => [styles.row, { width: rowWidth }, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`${label}: ${a.count}`}
                    >
                      <View style={[styles.rowIcon, styles.rowIconAlert]}>
                        <MaterialCommunityIcons name={copy.icon} size={20} color={TINT.rose} />
                      </View>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {label}
                      </Text>
                      <View style={styles.countChip}>
                        <Text style={styles.countChipText}>{a.count}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.dashboard.manage}</Text>
            <View style={[styles.rowGrid, { gap: cardGap }]}>
              {manageRows.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => (m.href ? router.push(m.href as never) : setSnack(t.dashboard.comingSoon(m.title)))}
                  style={({ pressed }) => [styles.row, { width: rowWidth }, pressed && styles.pressed]}
                  accessibilityLabel={m.title}
                >
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={m.icon} size={22} color={amraleColors.blue} />
                  </View>
                  <View style={styles.rowText}>
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {m.title}
                      </Text>
                      {m.soon ? (
                        <View style={styles.soonChip}>
                          <Text style={styles.soonChipText}>{t.dashboard.soon}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {m.subtitle}
                    </Text>
                  </View>
                  {m.addHref ? (
                    // Shortcut to the add form, so one row serves both "browse" and "create".
                    <Pressable
                      onPress={() => router.push(m.addHref as never)}
                      style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t.dashboard.addA11y(m.title)}
                      hitSlop={6}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={amraleColors.white} />
                    </Pressable>
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <LogoutConfirmDialog {...logoutDialogProps} />
      <AppSnackbar visible={!!snackMessage} message={snackMessage ?? ''} onDismiss={dismissSnack} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: amraleColors.surface },
  appBar: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: amraleColors.white,
    borderBottomWidth: 1,
    borderBottomColor: amraleColors.inputBorderLight,
  },
  brandTitle: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    color: amraleColors.blue,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  appBarIcons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  body: { width: '100%', alignSelf: 'center', paddingTop: amraleSpacing.md, gap: amraleSpacing.lg },
  welcomeBlock: { gap: 4 },
  welcomeTitle: {
    color: amraleColors.text,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  welcomeHint: {
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sectionTitle: {
    color: amraleColors.text,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  sectionMeta: {
    flexShrink: 1,
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
  },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  tile: {
    borderRadius: amraleRadius.lg,
    padding: 14,
    minHeight: 104,
    gap: 8,
    justifyContent: 'space-between',
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  tileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 38, height: 38, borderRadius: amraleRadius.md, alignItems: 'center', justifyContent: 'center' },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  tileValue: {
    color: amraleColors.text,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  tileLabel: {
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  tileHint: {
    color: amraleColors.textSubtle,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
  },
  teamRowPressed: { opacity: 0.9 },
  teamText: {
    flex: 1,
    minWidth: 0,
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },

  rowGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: amraleRadius.md,
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconAlert: { backgroundColor: 'rgba(190, 18, 60, 0.10)' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    color: amraleColors.text,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  rowSubtitle: {
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  countChip: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: amraleRadius.pill,
    backgroundColor: 'rgba(190, 18, 60, 0.10)',
  },
  countChipText: {
    textAlign: 'center',
    color: TINT.rose,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: amraleRadius.pill,
    backgroundColor: amraleColors.inputBgLight,
  },
  soonChipText: {
    color: amraleColors.textMuted,
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
});
