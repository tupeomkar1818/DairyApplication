import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { LoginLightShell } from '@/src/components/auth';
import { PrivacyPolicyContent } from '@/src/components/privacyPolicy/PrivacyPolicyContent';
import { ScreenHeader } from '@/src/components/shared';
import { usePrivacyPolicy } from '@/src/hooks/privacyPolicy';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export default function PrivacyPolicyScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = usePrivacyPolicy();

  return (
    <LoginLightShell alignTop>
      <ScreenHeader
        title="Privacy Policy"
        onBack={() => router.back()}
        backVariant="pill"
        titleColor={amraleColors.text}
        titleSize="md"
        showBorder={false}
        backgroundColor="transparent"
        style={styles.header}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={amraleColors.blue} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load privacy policy. Please try again.</Text>
          <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryLabel}>{isRefetching ? 'Loading…' : 'Retry'}</Text>
          </Pressable>
        </View>
      ) : data?.policy ? (
        <PrivacyPolicyContent policy={data.policy} />
      ) : null}
    </LoginLightShell>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: amraleSpacing.lg,
  },
  centered: {
    width: '100%',
    paddingVertical: amraleSpacing.xxl,
    alignItems: 'center',
    gap: amraleSpacing.md,
  },
  errorText: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    color: amraleColors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: amraleSpacing.lg,
    paddingVertical: amraleSpacing.sm,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
  },
  retryLabel: {
    fontFamily: amraleTypography.fontFamily.semiBold,
    fontSize: 14,
    color: amraleColors.white,
  },
  pressed: { opacity: 0.8 },
});
