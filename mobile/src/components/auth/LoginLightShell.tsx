import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilkSplashDecor } from './MilkSplashDecor';
import { amraleColors, amraleSpacing } from '@/src/theme/dairyTactile';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** When true, content starts at top (e.g. FAQ) instead of vertically centered */
  alignTop?: boolean;
};

/** Light login layout — centered card, milk splash, pinned footer (mockup) */
export function LoginLightShell({ children, footer, alignTop = false }: Props) {
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
          <View style={styles.main}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: amraleColors.surface,
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
  footer: {
    paddingHorizontal: amraleSpacing.lg,
    paddingBottom: amraleSpacing.lg,
    paddingTop: amraleSpacing.sm,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
});
