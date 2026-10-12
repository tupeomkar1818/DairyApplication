import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilkSplashDecor } from './MilkSplashDecor';
import { RESPONSIVE_CONTAINER_MAX_WIDTH } from '@/src/components/shared/ResponsiveContainer';
import { amraleColors, amraleSpacing } from '@/src/theme/dairyTactile';

/** Below this window height (phone landscape, Android with the keyboard open) the footer scrolls with the content. */
const PINNED_FOOTER_MIN_HEIGHT = 560;

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** When true, content starts at top (e.g. FAQ) instead of vertically centered */
  alignTop?: boolean;
};

/** Light login layout — centered card, milk splash, pinned footer (mockup) */
export function LoginLightShell({ children, footer, alignTop = false }: Props) {
  const { height } = useWindowDimensions();
  // A pinned footer eats ~100px; on short screens let it scroll so the card isn't squeezed into what's left.
  const pinFooter = height >= PINNED_FOOTER_MIN_HEIGHT;
  const footerNode = footer ? <View style={[styles.footer, !pinFooter && styles.footerInScroll]}>{footer}</View> : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <MilkSplashDecor variant="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, alignTop && styles.scrollTop]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Reading pages (FAQ / Contact / Privacy) get a wider column than the 400px login card. */}
          <View style={[styles.main, alignTop && styles.mainReading]}>{children}</View>
          {pinFooter ? null : footerNode}
        </ScrollView>
        {pinFooter ? footerNode : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: amraleColors.surface,
    // MilkSplashDecor bleeds past the edges; clip it so it never widens the page on phones.
    overflow: 'hidden',
  },
  flex: { flex: 1, zIndex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: amraleSpacing.lg,
    paddingTop: amraleSpacing.lg,
    paddingBottom: amraleSpacing.md,
  },
  scrollTop: {
    justifyContent: 'flex-start',
  },
  main: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  mainReading: {
    maxWidth: RESPONSIVE_CONTAINER_MAX_WIDTH.reading,
  },
  footer: {
    paddingHorizontal: amraleSpacing.lg,
    paddingBottom: amraleSpacing.lg,
    paddingTop: amraleSpacing.sm,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  /** Inside the scroll content, which already provides the side/bottom padding. */
  footerInScroll: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    paddingTop: amraleSpacing.lg,
  },
});
