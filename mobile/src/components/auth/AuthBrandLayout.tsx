import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthFooterLinks } from '@/src/components/auth/AuthFooterLinks';
import { LanguageToggle } from '@/src/components/shared/LanguageToggle';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing, amraleTypography, dairyGradient } from '@/src/theme/dairyTactile';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** From this width the brand sits in its own panel beside the form. */
export const AUTH_SPLIT_MIN_WIDTH = 900;

const BENEFITS: { icon: IconName; key: 'freshMilk' | 'changeOrder' | 'onePlace' }[] = [
  { icon: 'weather-sunset-up', key: 'freshMilk' },
  { icon: 'calendar-edit', key: 'changeOrder' },
  { icon: 'receipt-text-outline', key: 'onePlace' },
];

/**
 * The sign-in screens' frame (login, OTP): a blue brand header with the card overlapping it on a phone, a brand panel
 * beside the card on a wide screen, and the help links underneath.
 */
export function AuthBrandLayout({
  children,
  onBack,
  backLabel,
}: {
  /** The white card. */
  children: ReactNode;
  /** Shows a back button on the brand header. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const t = useStrings('auth');
  const c = useStrings('common');
  const { width } = useWindowDimensions();
  const split = width >= AUTH_SPLIT_MIN_WIDTH;
  const backText = backLabel ?? c.actions.back;

  const back = onBack ? (
    <Pressable
      onPress={onBack}
      hitSlop={8}
      style={({ pressed }) => [styles.back, !split && styles.backIconOnly, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={backText}
    >
      <MaterialCommunityIcons name="arrow-left" size={20} color={amraleColors.white} />
      {/* On a phone the label would run into the logo; the arrow alone says it (the label stays for screen readers). */}
      {split ? <Text style={styles.backText}>{backText}</Text> : null}
    </Pressable>
  ) : null;

  const brand = (
    <View style={[styles.brand, split && styles.brandSplit]}>
      <View style={[styles.logoFrame, split && styles.logoFrameSplit]}>
        <Image source={require('@/assets/images/amrale-logo.png')} style={styles.logo} resizeMode="cover" accessibilityLabel={t.brand.logoLabel} />
      </View>
      <Text style={[styles.brandName, split && styles.brandNameSplit]} accessibilityRole="header">
        {c.appName}
      </Text>
      <Text style={[styles.brandTagline, split && styles.brandTaglineSplit]}>{t.brand.tagline}</Text>
      {split ? (
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.key} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <MaterialCommunityIcons name={b.icon} size={20} color={amraleColors.white} />
              </View>
              <Text style={styles.benefitText}>{t.brand.benefits[b.key]}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <AuthFooterLinks
        variant="light"
        onNeedHelp={() => router.push('/(auth)/faq')}
        onContactAdmin={() => router.push('/(auth)/contact-admin')}
        onPrivacyPolicy={() => router.push('/(auth)/privacy-policy')}
      />
      <Text style={styles.copyright}>{t.brand.copyright(String(new Date().getFullYear()))}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {split ? (
          <View style={styles.splitRow}>
            <LinearGradient colors={dairyGradient.colors} start={dairyGradient.start} end={dairyGradient.end} style={styles.splitBrand}>
              <SafeAreaView edges={['top']} style={styles.splitBrandInner}>
                {back ? <View style={styles.splitBack}>{back}</View> : null}
                <View style={styles.splitLanguage}>
                  <LanguageToggle tone="onDark" />
                </View>
                {brand}
              </SafeAreaView>
            </LinearGradient>
            <ScrollView contentContainerStyle={styles.splitForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.splitFormInner}>
                {children}
                {footer}
              </View>
            </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <LinearGradient colors={dairyGradient.colors} start={dairyGradient.start} end={dairyGradient.end} style={styles.hero}>
              <SafeAreaView edges={['top']}>
                {back ? <View style={styles.stackBack}>{back}</View> : null}
                {/* Before signing in is when a reader most needs their language, so the switch sits on the header. */}
                <View style={styles.stackLanguage}>
                  <LanguageToggle tone="onDark" />
                </View>
                {brand}
              </SafeAreaView>
            </LinearGradient>
            <View style={styles.stackBody}>
              {children}
              {footer}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The white card the sign-in screens put their form in. */
export function AuthCard({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <View style={[styles.card, width >= AUTH_SPLIT_MIN_WIDTH && styles.cardSplit]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: amraleColors.surface },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },

  // Phone / narrow: brand header, card overlapping its lower edge.
  stack: { flexGrow: 1 },
  hero: {
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.lg,
    paddingBottom: 72,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  stackBack: { position: 'absolute', left: -8, top: -4, zIndex: 1 },
  stackLanguage: { alignItems: 'flex-end', marginBottom: amraleSpacing.sm, zIndex: 1 },
  stackBody: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: amraleSpacing.md,
    marginTop: -52,
    justifyContent: 'space-between',
    gap: amraleSpacing.lg,
  },

  // Wide: brand panel beside the form.
  splitRow: { flex: 1, flexDirection: 'row' },
  splitBrand: { width: '44%', minWidth: 400, maxWidth: 600 },
  splitBrandInner: { flex: 1, justifyContent: 'center', paddingHorizontal: 56, paddingVertical: amraleSpacing.xl },
  splitBack: { position: 'absolute', left: 40, top: 32 },
  splitLanguage: { position: 'absolute', right: 40, top: 32 },
  splitForm: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: amraleSpacing.xl, paddingVertical: amraleSpacing.xl },
  splitFormInner: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: amraleSpacing.lg },

  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: amraleRadius.pill,
  },
  backIconOnly: { width: 40, paddingHorizontal: 0, justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  backText: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 14, color: amraleColors.white },

  brand: { alignItems: 'center' },
  brandSplit: { alignItems: 'flex-start' },
  logoFrame: {
    width: 84,
    height: 84,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
    shadowColor: '#001a4d',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logoFrameSplit: { width: 112, height: 112, borderRadius: 28 },
  // The artwork has a wide blue margin of its own; zoom past it so the mark fills the tile.
  logo: { width: '100%', height: '100%', transform: [{ scale: 1.35 }] },
  brandName: {
    marginTop: 12,
    fontFamily: amraleTypography.fontFamily.bold,
    fontSize: 24,
    color: amraleColors.white,
    textAlign: 'center',
  },
  brandNameSplit: { marginTop: 24, fontSize: 36, textAlign: 'left' },
  brandTagline: {
    marginTop: 4,
    fontFamily: amraleTypography.fontFamily.medium,
    fontSize: 14,
    color: amraleColors.whiteMuted,
    textAlign: 'center',
  },
  brandTaglineSplit: { fontSize: 17, textAlign: 'left' },
  benefits: { marginTop: 40, gap: 18 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  benefitText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 16, color: amraleColors.white },

  card: {
    width: '100%',
    backgroundColor: amraleColors.white,
    borderRadius: amraleRadius.xxl,
    paddingHorizontal: 20,
    paddingVertical: amraleSpacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(53, 81, 161, 0.08)',
    shadowColor: amraleColors.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  cardSplit: { paddingHorizontal: 28, paddingVertical: 32 },

  footer: { alignItems: 'center', paddingBottom: amraleSpacing.md, gap: amraleSpacing.sm },
  copyright: {
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 12,
    color: amraleColors.textSubtle,
    textAlign: 'center',
  },
});
