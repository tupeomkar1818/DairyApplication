import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilkSplashDecor } from './MilkSplashDecor';
import { amraleColors, amraleSpacing } from '@/src/theme/dairyTactile';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  showSplashDecor?: boolean;
};

export function AmraleAuthShell({ children, scroll = false, showSplashDecor = true }: Props) {
  const body = (
    <View style={styles.inner}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.root}>
      {showSplashDecor ? <MilkSplashDecor /> : null}
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.contentLayer}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: amraleColors.blue,
  },
  contentLayer: { flex: 1, zIndex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: amraleSpacing.lg,
    paddingVertical: amraleSpacing.xl,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: amraleSpacing.lg,
    paddingVertical: amraleSpacing.xl,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
});
