import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DashboardCoverBanner } from '@/src/components/dashboard/DashboardCoverBanner';
import { computeDashboardCoverHeight } from '@/src/components/dashboard/dashboardCoverLayout';
import type { DashboardCoverImage } from '@/src/domain/adminDashboard/entities';
import { amraleColors } from '@/src/theme/dairyTactile';
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
  const { width: screenWidth } = useResponsiveLayout();

  if (loading || !cover) {
    return (
      <View
        style={[
          styles.placeholder,
          {
            width: screenWidth,
            height: computeDashboardCoverHeight(screenWidth, cover?.aspectRatio),
          },
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
