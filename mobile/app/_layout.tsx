import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

import { useDailyOrderReminders } from '@/src/hooks/notifications/useDailyOrderReminders';
import { useStorageQuerySync } from '@/src/hooks/useStorageQuerySync';
import { loadSavedLanguage } from '@/src/i18n/languageStorage';
import { runFreshStartOnce } from '@/src/infrastructure/freshStart';
import { migrateLegacyDayOrders } from '@/src/infrastructure/legacyDayOrdersMigration';
import { amraleTypography } from '@/src/theme/dairyTactile';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    ...MaterialCommunityIcons.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // The one-time clean slate runs before any screen or background job reads data (see `runFreshStartOnce`), and the
  // saved language is applied before the first screen draws, so nothing flashes in English first.
  const [dataReady, setDataReady] = useState(false);
  useEffect(() => {
    void Promise.all([runFreshStartOnce(), loadSavedLanguage()]).finally(() => setDataReady(true));
  }, []);

  useEffect(() => {
    if (loaded && dataReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dataReady]);

  if (!loaded || !dataReady) {
    return null;
  }

  return <RootLayoutNav />;
}

/**
 * Light-only Paper theme (the tactile surfaces are light-only) whose type scale uses the app font. Paper defaulted
 * to the system font, so every screen built from Paper `Text` (billing, payments, complaints…) looked different.
 * Each weight maps to its own Plus Jakarta Sans face — web can't synthesise weights from a single loaded face well.
 */
const JAKARTA_BY_WEIGHT: Record<string, string> = {
  '400': amraleTypography.fontFamily.regular,
  normal: amraleTypography.fontFamily.regular,
  '500': amraleTypography.fontFamily.medium,
  '600': amraleTypography.fontFamily.semiBold,
  '700': amraleTypography.fontFamily.bold,
  bold: amraleTypography.fontFamily.bold,
};

const paperTheme = {
  ...MD3LightTheme,
  fonts: Object.fromEntries(
    Object.entries(MD3LightTheme.fonts).map(([key, font]) => {
      const weight = String((font as { fontWeight?: string }).fontWeight ?? '400');
      return [key, { ...font, fontFamily: JAKARTA_BY_WEIGHT[weight] ?? amraleTypography.fontFamily.regular }];
    }),
  ) as typeof MD3LightTheme.fonts,
};

/** Keeps every open app on the latest shared data (needs the query client, so it renders inside the provider). */
function StorageQuerySync() {
  useStorageQuerySync();
  return null;
}

function RootLayoutNav() {
  // One set of add-ons for every app: fold the admin's older day orders into the shared customer record.
  useEffect(() => {
    void migrateLegacyDayOrders();
  }, []);
  // Every evening at 6 pm, customers with a delivery tomorrow are reminded of it while they can still change it.
  useDailyOrderReminders();

  // The dairy tactile surfaces are light-only, so Paper (dialogs, inputs, text) and navigation stay on the light
  // theme; following the system dark mode put dark Paper components on light cards and made text unreadable.
  const colorScheme = 'light' as ReturnType<typeof useColorScheme>;

  return (
    <QueryClientProvider client={queryClient}>
      <StorageQuerySync />
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            {/* Role groups: each group's _layout guards access by session role. */}
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(delivery)" />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
