import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AmraleAuthShell, AmraleLogo } from '@/src/components/auth';
import { useAuthSession, useAuthStore } from '@/src/hooks/auth';
import { amraleColors, amraleTypography } from '@/src/theme/dairyTactile';

function roleToRoute(role: string) {
  switch (role) {
    case 'admin':
      return '/(admin)';
    case 'customer':
      return '/(customer)';
    case 'delivery_boy':
      return '/(delivery)';
    default:
      return '/(auth)/login';
  }
}

export default function SplashRoute() {
  const fade = useRef(new Animated.Value(0)).current;
  const session = useAuthStore((s) => s.session);

  useAuthSession();

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (session) {
        router.replace(roleToRoute(session.role));
        return;
      }
      router.replace('/(auth)/login');
    }, 1400);
    return () => clearTimeout(t);
  }, [session]);

  return (
    <AmraleAuthShell>
      <View style={styles.frame}>
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <AmraleLogo size="splash" />
          <Text style={styles.tagline}>Pure & Vital · Since 1976</Text>
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
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
