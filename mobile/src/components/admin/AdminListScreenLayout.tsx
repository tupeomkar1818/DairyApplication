import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/src/components/shared';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors } from '@/src/theme/dairyTactile';

export type AdminListScreenLayoutProps = {
  title: string;
  children: (layout: { bottomInset: number }) => ReactNode;
  /** Renders after list content (e.g. modal hosts) */
  overlay?: ReactNode;
};

/** Shared shell for admin catalog list screens (Products, Customers, …) */
export function AdminListScreenLayout({ title, children, overlay }: AdminListScreenLayoutProps) {
  const { headerPaddingTop, bottom } = useScreenSafeInsets();

  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={() => router.back()} paddingTop={headerPaddingTop} />
      {children({ bottomInset: bottom })}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: amraleColors.surface,
  },
});
