import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ContactAdminCard } from '@/src/components/contactAdmin/ContactAdminCard';
import { LoginLightShell } from '@/src/components/auth';
import { ScreenHeader } from '@/src/components/shared';
import { useContactAdmin } from '@/src/hooks/contactAdmin';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

export default function ContactAdminScreen() {
  const t = useStrings('help');
  const c = useStrings('common');
  const { data, isLoading, isError, refetch, isRefetching } = useContactAdmin();

  return (
    <LoginLightShell alignTop>
      <ScreenHeader
        title={t.contact.title}
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
          <Text style={styles.errorText}>{t.contact.loadError}</Text>
          <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryLabel}>{isRefetching ? c.states.loading : t.retry}</Text>
          </Pressable>
        </View>
      ) : data?.contact ? (
        <ContactAdminCard contact={data.contact} />
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
    minHeight: 44,
    justifyContent: 'center',
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
