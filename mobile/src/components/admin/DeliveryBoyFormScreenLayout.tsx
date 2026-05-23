import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HelperText, Text } from 'react-native-paper';

import { COLORS } from '@/src/components/admin/DeliveryBoyBasicForm';
import { RESPONSIVE } from '@/src/utils/responsiveLayout';
import { rf } from '@/src/utils/responsiveTypography';

export type DeliveryBoyFormFooterRender = (opts: { isMobile: boolean }) => React.ReactNode;

export type DeliveryBoyFormScreenLayoutProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
  formError: string | null;
  children: React.ReactNode;
  footer: DeliveryBoyFormFooterRender;
};

export function DeliveryBoyFormScreenLayout({ title, subtitle, onBack, formError, children, footer }: DeliveryBoyFormScreenLayoutProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < RESPONSIVE.tabletMin;
  const isTablet = width >= RESPONSIVE.tabletMin && width < RESPONSIVE.desktopMin;
  const horizontalPad = isMobile ? 10 : isTablet ? 14 : 20;
  const topPad = Math.max(insets.top, 8) + 4;
  const availableWidth = Math.max(0, width - horizontalPad * 2);

  const footerMaxWidth = isMobile
    ? availableWidth
    : isTablet
      ? Math.min(availableWidth, Math.round(width * 0.78))
      : Math.min(availableWidth, Math.max(420, Math.min(500, Math.round(width * 0.34))));

  const textMain = isDark ? styles.textOnDark : styles.textOnLight;
  const textSub = isDark ? styles.subtleOnDark : styles.subtleOnLight;
  const titleSize = rf(22, width, { clamp: { min: 18, max: 26 } });
  const subtitleSize = rf(12, width, { clamp: { min: 11, max: 14 } });

  return (
    <View style={[styles.page, isDark ? styles.pageDark : styles.pageLight, styles.pageClip]}>
      <View style={[styles.header, isDark ? styles.headerDark : styles.headerLight, { paddingTop: topPad, paddingBottom: 12 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={isDark ? '#F8FAFC' : COLORS.text} />
          </Pressable>

          <View style={styles.titleSlot}>
            <Text
              variant="titleLarge"
              style={[textMain, styles.headerTitle, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.15) }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <Text
              variant="bodySmall"
              style={[textSub, styles.headerSubtitle, { fontSize: subtitleSize, lineHeight: Math.round(subtitleSize * 1.4) }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: horizontalPad,
              paddingBottom: 20 + insets.bottom,
            },
          ]}
        >
          {children}
          {formError ? (
            <HelperText type="error" padding="none" style={[styles.formError, { maxWidth: 420, alignSelf: 'center', width: '100%' }]}>
              {formError}
            </HelperText>
          ) : null}
          <View style={[styles.footerAtEnd, { maxWidth: footerMaxWidth }]}>{footer({ isMobile })}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageClip: { overflow: 'hidden' },
  pageLight: { backgroundColor: '#EEF1F5' },
  pageDark: { backgroundColor: '#070B14' },
  flex: { flex: 1 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLight: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerDark: {
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12 },
  titleSlot: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  headerTitle: { fontWeight: '700', letterSpacing: -0.2, fontSize: 22, textAlign: 'left', alignSelf: 'stretch' },
  headerSubtitle: { lineHeight: 18, opacity: 0.88, textAlign: 'left', marginTop: 2, alignSelf: 'stretch' },
  scrollContent: { paddingTop: 6, alignItems: 'center' },
  formError: { marginTop: 2, marginBottom: 0 },
  footerAtEnd: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 10,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  textOnLight: { color: COLORS.text },
  textOnDark: { color: 'rgba(248,250,252,0.98)' },
  subtleOnLight: { color: 'rgba(51,65,85,0.85)' },
  subtleOnDark: { color: 'rgba(148,163,184,0.95)' },
});
