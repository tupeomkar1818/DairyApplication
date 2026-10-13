import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AmraleAuthShell, AmraleLogo } from '@/src/components/auth';
import { useAuthSession } from '@/src/hooks/auth';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

function roleToRoute(role: string) {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/(admin)';
    case 'desk':
      return '/(desk)';
    case 'customer':
      return '/(customer)';
    case 'delivery_boy':
      return '/(delivery)';
    default:
      return '/(auth)/login';
  }
}

export default function SplashRoute() {
  const t = useStrings('auth');
  const fade = useRef(new Animated.Value(0)).current;
  const sessionQuery = useAuthSession();
  const sessionResolved = sessionQuery.isFetched;
  const sessionRole = sessionQuery.data?.role;
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    const t = setTimeout(() => setMinDelayElapsed(true), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Decide only after the session read has finished — a slow read must not bounce a signed-in user to login.
    if (!minDelayElapsed || !sessionResolved || navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace(sessionRole ? roleToRoute(sessionRole) : '/(auth)/login');
  }, [minDelayElapsed, sessionResolved, sessionRole]);

  return (
    <AmraleAuthShell>
      <View style={styles.frame}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <AmraleLogo size="splash" />
          <Text style={styles.tagline}>{t.splash.tagline}</Text>
        </Animated.View>
        <View style={styles.loader}>
          <ActivityIndicator color={amraleColors.white} size="small" />
        </View>
      </View>
    </AmraleAuthShell>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    // Reserve the loader's strip so the centered logo + tagline can never slide underneath it.
    paddingBottom: 64,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  tagline: {
    marginTop: 20,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: amraleColors.whiteMuted,
    textAlign: 'center',
  },
  loader: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
