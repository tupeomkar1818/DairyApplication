import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { router } from 'expo-router';
import { Text } from 'react-native-paper';

import { LogoutConfirmDialog } from '@/src/components/auth/LogoutConfirmDialog';
import { DashboardCoverSlot } from '@/src/components/dashboard/DashboardCoverSlot';
import { usePickDashboardCover } from '@/src/components/dashboard/usePickDashboardCover';
import { useConfirmLogout } from '@/src/hooks/auth';
import { profileRouteForRole } from '@/src/utils/profileRoutes';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useProducts } from '@/src/hooks/products';
import { useCustomers } from '@/src/hooks/customers';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { amraleColors, amraleRadius, amraleSpacing } from '@/src/theme/dairyTactile';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

type StatCard = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  variant: 'primary' | 'default';
  iconTint?: string;
};

type QuickAction = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

export default function AdminDashboard() {
  const { confirmLogout, isLoggingOut, logoutDialogProps } = useConfirmLogout();
  const session = useAuthSession();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const { width, isMobile, isTablet, contentMaxWidth } = useResponsiveLayout();
  const settingsQuery = useDashboardSettings();
  const { pickCover, isUpdating: isCoverUpdating } = usePickDashboardCover();

  const products = useProducts();
  const customers = useCustomers();
  const deliveryBoys = useDeliveryBoys();

  const pagePad = amraleSpacing.md;
  const cardGap = 12;
  const innerW = Math.max(0, Math.min(contentMaxWidth, width) - pagePad * 2);
  const mobileColW = (innerW - cardGap) / 2;

  const productCount = products.data?.total ?? 0;
  const customerCount = customers.data?.total ?? 0;
  const deliveryBoyCount = deliveryBoys.data?.total ?? 0;
  const todayOrdersCount = 0;

  const stats = useMemo<StatCard[]>(
    () => [
      { key: 'products', label: 'Total Products', value: String(productCount), icon: 'package-variant-closed', variant: 'primary' },
      { key: 'customers', label: 'Total Customers', value: String(customerCount), icon: 'account-group-outline', variant: 'default' },
      { key: 'delivery', label: 'Delivery Boys', value: String(deliveryBoyCount), icon: 'truck-delivery-outline', variant: 'default' },
      {
        key: 'orders',
        label: 'Today Orders',
        value: String(todayOrdersCount),
        icon: 'clipboard-list-outline',
        variant: 'default',
        iconTint: '#E11D48',
      },
    ],
    [customerCount, deliveryBoyCount, productCount, todayOrdersCount],
  );

  const actions = useMemo<QuickAction[]>(
    () => [
      { key: 'products', title: 'Products', subtitle: 'Catalog & Stock', icon: 'basket-outline' },
      { key: 'customers', title: 'Customers', subtitle: 'User Database', icon: 'account-group-outline' },
      { key: 'delivery', title: 'Delivery', subtitle: 'Route Mapping', icon: 'map-marker-outline' },
      { key: 'reports', title: 'Reports', subtitle: 'Sales Analytics', icon: 'chart-bar' },
    ],
    [],
  );

  const cover = settingsQuery.data?.settings.cover;

  const navigateAction = (key: string) => {
    switch (key) {
      case 'products':
        router.push('/(admin)/products');
        return;
      case 'customers':
        router.push('/(admin)/customers');
        return;
      case 'delivery':
        router.push('/(admin)/delivery');
        return;
      default:
        return;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: headerPaddingTop }]}>
        <Text variant="titleLarge" style={styles.brandTitle} numberOfLines={1}>
          Amrale Dairy
        </Text>
        <View style={styles.appBarIcons}>
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={amraleColors.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push(profileRouteForRole(session.data?.role ?? 'admin') as never)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={amraleColors.text} />
          </Pressable>
          <Pressable
            onPress={confirmLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, isLoggingOut && styles.disabled]}
          >
            <MaterialCommunityIcons name="logout" size={20} color={amraleColors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom(24) }}
        showsVerticalScrollIndicator={false}
      >
        <DashboardCoverSlot
          cover={cover}
          loading={settingsQuery.isLoading}
          editable
          onPressEdit={pickCover}
          isUpdating={isCoverUpdating}
        />

        <View
          style={[
            styles.scroll,
            {
              paddingHorizontal: pagePad,
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
        <View style={styles.welcomeBlock}>
          <Text variant="headlineSmall" style={styles.welcomeTitle}>
            Welcome Admin
          </Text>
          <Text variant="bodyMedium" style={styles.welcomeHint}>
            Manage Products, Customers, and Delivery Team
          </Text>
        </View>

        <View style={[styles.statsGrid, { gap: cardGap }]}>
          {stats.map((s) => (
            <View
              key={s.key}
              style={[
                styles.statCard,
                s.variant === 'primary' ? styles.statCardPrimary : styles.statCardDefault,
                isMobile ? { width: mobileColW, maxWidth: '48%' } : isTablet ? styles.statCardTablet : styles.statCardDesktop,
              ]}
            >
              <View style={styles.statTop}>
                <View style={[styles.statIconWrap, s.variant === 'primary' ? styles.statIconWrapPrimary : styles.statIconWrapDefault]}>
                  <MaterialCommunityIcons
                    name={s.icon}
                    size={20}
                    color={s.variant === 'primary' ? amraleColors.white : s.iconTint ?? amraleColors.blue}
                  />
                </View>
                <Text
                  variant="headlineMedium"
                  style={[styles.statValue, s.variant === 'primary' ? styles.statValueOnPrimary : styles.statValueDefault]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {s.value}
                </Text>
              </View>
              <Text
                variant="labelLarge"
                style={[styles.statLabel, s.variant === 'primary' ? styles.statLabelOnPrimary : styles.statLabelDefault]}
                numberOfLines={2}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="labelMedium" style={styles.sectionTitle}>
          QUICK ACTIONS
        </Text>

        <View style={[styles.actionsWrap, !isMobile && styles.actionsGrid]}>
          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => navigateAction(a.key)}
              style={({ pressed }) => [
                styles.actionCard,
                !isMobile && styles.actionCardGrid,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={a.icon} size={22} color={amraleColors.blue} />
              </View>
              <View style={styles.actionText}>
                <Text variant="titleSmall" style={styles.actionTitle}>
                  {a.title}
                </Text>
                <Text variant="bodySmall" style={styles.actionSubtitle}>
                  {a.subtitle}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={amraleColors.textSubtle} />
            </Pressable>
          ))}
        </View>
        </View>
      </ScrollView>

      <LogoutConfirmDialog {...logoutDialogProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: amraleColors.surface,
  },
  appBar: {
    paddingHorizontal: amraleSpacing.md,
    paddingBottom: amraleSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: amraleColors.white,
  },
  brandTitle: {
    color: amraleColors.blue,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  appBarIcons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },

  scroll: { gap: amraleSpacing.md, paddingTop: amraleSpacing.md },

  welcomeBlock: { gap: 4 },
  welcomeTitle: { color: amraleColors.text, fontWeight: '800' },
  welcomeHint: { color: amraleColors.textMuted },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  statCard: {
    borderRadius: amraleRadius.xl,
    padding: 14,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  statCardPrimary: {
    backgroundColor: amraleColors.blue,
  },
  statCardDefault: {
    backgroundColor: amraleColors.white,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  statCardTablet: { width: '23%', minWidth: 140, flexGrow: 1 },
  statCardDesktop: { width: '23%', minWidth: 148, flexGrow: 1, maxWidth: '24%' },
  statTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconWrapPrimary: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  statIconWrapDefault: { backgroundColor: 'rgba(53, 81, 161, 0.10)' },
  statValue: { fontWeight: '800', flex: 1, textAlign: 'right' },
  statValueOnPrimary: { color: amraleColors.white },
  statValueDefault: { color: amraleColors.blue },
  statLabel: { marginTop: 10 },
  statLabelOnPrimary: { color: 'rgba(255, 255, 255, 0.92)' },
  statLabelDefault: { color: amraleColors.textMuted },

  sectionTitle: {
    color: amraleColors.blue,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  actionsWrap: { gap: 10 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  actionCardGrid: {
    width: '48%',
    minWidth: 260,
    flexGrow: 1,
    maxWidth: '48%',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(53, 81, 161, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 2, minWidth: 0 },
  actionTitle: { color: amraleColors.text, fontWeight: '700' },
  actionSubtitle: { color: amraleColors.textMuted },
});
