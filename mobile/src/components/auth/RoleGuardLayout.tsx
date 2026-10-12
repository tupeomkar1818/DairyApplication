import { Redirect, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { UserRole } from '@/src/domain/shared/enums';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { amraleColors } from '@/src/theme/dairyTactile';

type Props = {
  /** Only a signed-in user with this role may enter the route group. */
  role: UserRole;
  /** Rendered next to the stack once the role is confirmed — background helpers for that app (they render nothing). */
  children?: ReactNode;
};

/**
 * Route-group guard used by `app/(admin|customer|delivery)/_layout.tsx`.
 * Waits for the session read, then renders the group's stack or redirects to login.
 */
export function RoleGuardLayout({ role, children }: Props) {
  const session = useAuthSession();

  if (session.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={amraleColors.blue} size="large" />
      </View>
    );
  }

  if (session.data?.role !== role) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: amraleColors.surface,
  },
});
