import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import type { DashboardCoverImage } from '@/src/domain/adminDashboard/entities';
import { computeDashboardCoverLayout } from '@/src/components/dashboard/dashboardCoverLayout';
import { resolveDashboardCoverSource } from '@/src/components/dashboard/dashboardCover';
import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius, amraleSpacing } from '@/src/theme/dairyTactile';
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
  const t = useStrings('admin').cover;
  const { width: screenWidth, height: screenHeight } = useResponsiveLayout();
  const layout = computeDashboardCoverLayout(screenWidth, screenHeight, cover.aspectRatio);

  return (
    <Pressable
      onPress={editable ? onPressEdit : undefined}
      disabled={!editable || isUpdating}
      style={({ pressed }) => [
        styles.shell,
        fullBleed ? styles.shellFullBleed : null,
        // Phones stay edge to edge ('100%' avoids overflowing by the width of a desktop web scrollbar); wider
        // screens get the banner at its own aspect ratio, centered and rounded, so the artwork is never cropped.
        layout.rounded
          ? { width: layout.width, height: layout.height, borderRadius: amraleRadius.lg, marginTop: amraleSpacing.md }
          : { width: '100%', height: layout.height },
        pressed && editable && styles.pressed,
      ]}
      accessibilityRole={editable ? 'button' : 'image'}
      accessibilityLabel={editable ? t.changeA11y : t.imageA11y}
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
            // One icon only: the second (camera) badge sat half outside the circle and read as a rendering glitch.
            <MaterialCommunityIcons name="image-edit-outline" size={18} color={amraleColors.white} />
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
    ...StyleSheet.absoluteFill,
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
});
