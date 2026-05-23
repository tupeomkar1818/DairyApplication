import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ProductListSection } from '@/src/components/admin/ProductListSection';
import { ScreenHeader } from '@/src/components/shared';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors } from '@/src/theme/dairyTactile';

export default function AdminProductsScreen() {
  const { headerPaddingTop, bottom } = useScreenSafeInsets();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Products" onBack={() => router.back()} paddingTop={headerPaddingTop} />

      <ProductListSection bottomInset={bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: amraleColors.surface,
  },
});
