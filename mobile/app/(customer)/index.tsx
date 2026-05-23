import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Text } from 'react-native-paper';
import { LogoutConfirmDialog } from '@/src/components/auth/LogoutConfirmDialog';
import { DashboardCoverSlot } from '@/src/components/dashboard/DashboardCoverSlot';
import { useConfirmLogout } from '@/src/hooks/auth';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { profileRouteForRole } from '@/src/utils/profileRoutes';
import { useDashboardSettings } from '@/src/hooks/adminDashboard';
import { useCustomers } from '@/src/hooks/customers';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';

const COLORS = {
  primary: '#2563EB',
  secondary: '#60A5FA',
  accent: '#22C55E',
  bg: '#F8FAFC',
  text: '#1E293B',
};

type QuickAction = { key: string; title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; tint: string };

export default function CustomerDashboard() {
  const { confirmLogout, isLoggingOut, logoutDialogProps } = useConfirmLogout();
  const { headerPaddingTop, scrollPaddingBottom } = useScreenSafeInsets();
  const scheme = useColorScheme();
  const session = useAuthSession();
  const customers = useCustomers();
  const settingsQuery = useDashboardSettings();
  const cover = settingsQuery.data?.settings.cover;

  const orderingAllowed = useMemo(() => {
    const mobile = session.data?.mobileNumber ?? '';
    if (!mobile) return true;
    const c = customers.data?.items?.find((x) => x.mobile === mobile);
    if (!c) return true;
    return c.status === 'Active';
  }, [customers.data?.items, session.data?.mobileNumber]);

  const actions = useMemo<QuickAction[]>(
    () => [
      { key: 'order', title: 'Order Milk', icon: 'cart-plus', tint: COLORS.primary },
      { key: 'status', title: 'Delivery Status', icon: 'truck-delivery-outline', tint: COLORS.accent },
      { key: 'bill', title: 'Monthly Bill', icon: 'receipt-text-outline', tint: COLORS.secondary },
      { key: 'support', title: 'Support', icon: 'lifebuoy', tint: COLORS.primary },
    ],
    []
  );

  return (
    <View style={[styles.bg, scheme === 'dark' ? styles.bgDark : styles.bgLight]}>
      <View style={[styles.appBar, scheme === 'dark' ? styles.appBarDark : styles.appBarLight, { paddingTop: headerPaddingTop }]}>
        <Text variant="titleLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
          Amrale Dairy
        </Text>
        <View style={styles.appBarIcons}>
          <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push(profileRouteForRole(session.data?.role ?? 'customer') as never)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <MaterialCommunityIcons name="account-circle-outline" size={22} color={scheme === 'dark' ? 'white' : COLORS.text} />
          </Pressable>
          <Pressable
            onPress={confirmLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed, isLoggingOut && styles.disabled]}
          >
            <MaterialCommunityIcons name="logout" size={20} color={scheme === 'dark' ? 'white' : COLORS.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollOuter, { paddingBottom: scrollPaddingBottom(90) }]}>
        <DashboardCoverSlot cover={cover} loading={settingsQuery.isLoading} />

        <View style={styles.container}>
        <View style={styles.welcomeBlock}>
          <Text variant="titleLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
            Welcome Customer
          </Text>
          <Text variant="bodyMedium" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
            Quick access to orders, bills and delivery updates.
          </Text>
        </View>

        {!orderingAllowed ? (
          <View style={[styles.blockCard, scheme === 'dark' ? styles.cardDark : styles.cardLight]}>
            <Text variant="titleSmall" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
              Account inactive
            </Text>
            <Text variant="bodySmall" style={scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight}>
              Ordering is disabled because your account is inactive (pending bill). Please contact admin to reactivate.
            </Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {actions.map((a) => (
            <Pressable
              key={a.key}
              disabled={!orderingAllowed}
              onPress={() => {
                if (!orderingAllowed) return;
                // Ordering screens will be routed here later.
              }}
              style={({ pressed }) => [pressed && styles.pressed, !orderingAllowed && styles.disabled]}
            >
              <Card style={[styles.actionCard, scheme === 'dark' ? styles.cardDark : styles.cardLight]} mode="elevated">
                <Card.Content style={styles.actionContent}>
                  <View style={[styles.actionIcon, { backgroundColor: `${a.tint}1A` }]}>
                    <MaterialCommunityIcons name={a.icon} size={22} color={a.tint} />
                  </View>
                  <Text variant="labelLarge" style={scheme === 'dark' ? styles.textOnDark : styles.textOnLight}>
                    {a.title}
                  </Text>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </View>
        </View>
      </ScrollView>

      <LogoutConfirmDialog {...logoutDialogProps} />

      <View style={[styles.bottomNav, scheme === 'dark' ? styles.bottomNavDark : styles.bottomNavLight]}>
        <View style={styles.navItem}>
          <MaterialCommunityIcons name="home-variant-outline" size={22} color={COLORS.primary} />
          <Text variant="labelSmall" style={[styles.navText, { color: COLORS.primary }]}>
            Home
          </Text>
        </View>
        <View style={styles.navItem}>
          <MaterialCommunityIcons name="cart-outline" size={22} color={scheme === 'dark' ? 'rgba(255,255,255,0.78)' : 'rgba(30,41,59,0.60)'} />
          <Text variant="labelSmall" style={[styles.navText, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
            Orders
          </Text>
        </View>
        <View style={styles.navItem}>
          <MaterialCommunityIcons name="account-outline" size={22} color={scheme === 'dark' ? 'rgba(255,255,255,0.78)' : 'rgba(30,41,59,0.60)'} />
          <Text variant="labelSmall" style={[styles.navText, scheme === 'dark' ? styles.subtleOnDark : styles.subtleOnLight]}>
            Profile
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgLight: { backgroundColor: COLORS.bg },
  bgDark: { backgroundColor: '#0B1220' },

  appBar: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appBarLight: { backgroundColor: 'transparent' },
  appBarDark: { backgroundColor: 'transparent' },
  appBarIcons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },

  scrollOuter: { paddingBottom: 90 },
  container: { padding: 16, gap: 14 },
  welcomeBlock: { gap: 6 },

  blockCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  actionCard: { width: '48%', borderRadius: 18, borderWidth: 1 },
  cardLight: { backgroundColor: 'white', borderColor: 'rgba(37,99,235,0.10)' },
  cardDark: { backgroundColor: 'rgba(15,23,42,0.70)', borderColor: 'rgba(255,255,255,0.10)' },
  actionContent: { gap: 10 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 10, paddingHorizontal: 20, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  bottomNavLight: { backgroundColor: 'rgba(255,255,255,0.95)', borderTopColor: 'rgba(37,99,235,0.10)' },
  bottomNavDark: { backgroundColor: 'rgba(15,23,42,0.92)', borderTopColor: 'rgba(255,255,255,0.10)' },
  navItem: { alignItems: 'center', gap: 2 },
  navText: { marginTop: 2 },

  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(255,255,255,0.96)' },
  subtleOnLight: { color: 'rgba(30,41,59,0.60)' },
  subtleOnDark: { color: 'rgba(255,255,255,0.78)' },
});

