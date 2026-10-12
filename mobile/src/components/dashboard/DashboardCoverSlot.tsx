import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DashboardCoverBanner } from '@/src/components/dashboard/DashboardCoverBanner';
import { computeDashboardCoverLayout } from '@/src/components/dashboard/dashboardCoverLayout';
import type { DashboardCoverImage } from '@/src/domain/adminDashboard/entities';
import { amraleColors, amraleRadius, amraleSpacing } from '@/src/theme/dairyTactile';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

type Props = {
  cover?: DashboardCoverImage;
  loading?: boolean;
  editable?: boolean;
  onPressEdit?: () => void;
  isUpdating?: boolean;
};

/** Full-viewport-width cover strip — sits outside padded dashboard scroll content. */
export function DashboardCoverSlot({ cover, loading, editable, onPressEdit, isUpdating }: Props) {
  const { width: screenWidth, height: screenHeight } = useResponsiveLayout();

  if (loading || !cover) {
    const layout = computeDashboardCoverLayout(screenWidth, screenHeight, cover?.aspectRatio);
    return (
      <View
        style={[
          styles.placeholder,
          // Same box the loaded banner will take, so the content below does not jump when the image arrives.
          // Phones use '100%' of the scroll content (= viewport minus any web scrollbar) to avoid side overflow.
          layout.rounded
            ? { width: layout.width, height: layout.height, borderRadius: amraleRadius.lg, marginTop: amraleSpacing.md }
            : { width: '100%', height: layout.height },
        ]}
      >
        <ActivityIndicator color={amraleColors.blue} />
      </View>
    );
  }

  return (
    <DashboardCoverBanner
      cover={cover}
      editable={editable}
      onPressEdit={onPressEdit}
      isUpdating={isUpdating}
      fullBleed
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignSelf: 'center',
    backgroundColor: amraleColors.inputBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
