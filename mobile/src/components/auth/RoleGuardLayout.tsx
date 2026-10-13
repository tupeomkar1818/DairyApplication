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

  // Nobody is signed in: they have to.
  if (!session.data) {
    return <Redirect href="/(auth)/login" />;
  }

  // Somebody *is* signed in, just not one of these. That is not a reason to show them a sign-in screen — and it
  // happens for an ordinary reason: three of the apps have a screen called `reports`, so opening /reports cold (a
  // link, or a refresh on the web) can land in the wrong group's stack before anyone has done anything wrong. The
  // splash is the screen whose job is working out where somebody belongs, so it takes them to their own app.
  // The owner goes wherever a manager goes. That is the whole of the hierarchy, and it is written here for the
  // same reason the server writes it in one place: spelled out per screen, one forgotten line locks the dairy out
  // of its own app.
  const mayEnter = session.data.role === role || (session.data.role === 'super_admin' && role === 'admin');
  if (!mayEnter) {
    return <Redirect href="/(auth)/splash" />;
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
