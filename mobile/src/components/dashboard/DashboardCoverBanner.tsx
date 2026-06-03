import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import type { DashboardCoverImage } from '@/src/domain/adminDashboard/entities';
import { computeDashboardCoverHeight } from '@/src/components/dashboard/dashboardCoverLayout';
import { resolveDashboardCoverSource } from '@/src/components/dashboard/dashboardCover';
import { amraleColors } from '@/src/theme/dairyTactile';
import { pointerEventsNone } from '@/src/theme/platformStyles';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

type Props = {
  cover: DashboardCoverImage;
  editable?: boolean;
  onPressEdit?: () => void;
  isUpdating?: boolean;
  /** Edge-to-edge across the device viewport (default). */
  fullBleed?: boolean;
};

export function DashboardCoverBanner({
  cover,
  editable,
  onPressEdit,
  isUpdating,
  fullBleed = true,
}: Props) {
  const { width: screenWidth } = useResponsiveLayout();
  const bannerHeight = computeDashboardCoverHeight(screenWidth, cover.aspectRatio);

  return (
    <Pressable
      onPress={editable ? onPressEdit : undefined}
      disabled={!editable || isUpdating}
      style={({ pressed }) => [
        styles.shell,
        fullBleed ? styles.shellFullBleed : null,
        { height: bannerHeight, width: fullBleed ? screenWidth : '100%' },
        pressed && editable && styles.pressed,
      ]}
      accessibilityRole={editable ? 'button' : 'image'}
      accessibilityLabel={editable ? 'Change dashboard cover image' : 'Dashboard cover image'}
    >
      <Image
        source={resolveDashboardCoverSource(cover)}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {editable ? (
        <View style={[styles.editBadge, pointerEventsNone]}>
          {isUpdating ? (
            <ActivityIndicator color={amraleColors.white} size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="image-edit-outline" size={16} color={amraleColors.white} />
              <View style={styles.editLabelWrap}>
                <MaterialCommunityIcons name="camera-outline" size={12} color={amraleColors.white} />
              </View>
            </>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: amraleColors.inputBgLight,
    position: 'relative',
  },
  shellFullBleed: {
    alignSelf: 'center',
    borderRadius: 0,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.92,
  },
  editBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 43, 75, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  editLabelWrap: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
});
