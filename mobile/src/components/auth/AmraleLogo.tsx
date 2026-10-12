import { Image, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';

import { useStrings } from '@/src/i18n/useStrings';
import { amraleColors, amraleRadius } from '@/src/theme/dairyTactile';

type Props = {
  size?: 'splash' | 'auth' | 'login';
  rounded?: boolean;
  style?: ViewStyle;
};

const SIZES = {
  splash: { width: 280, height: 340 },
  auth: { width: 220, height: 268 },
  login: { width: 112, height: 112 },
} as const;

/** Large logos may take at most this share of the window height (phone landscape is only ~375px tall). */
const MAX_HEIGHT_SHARE = 0.4;

export function AmraleLogo({ size = 'auth', rounded = false, style }: Props) {
  const t = useStrings('auth');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const base = SIZES[size];
  // The big splash/auth artwork is sized from the window so it never overflows a short (landscape) or narrow
  // screen; the small login mark stays fixed.
  const scale =
    size === 'login'
      ? 1
      : Math.min(1, (windowHeight * MAX_HEIGHT_SHARE) / base.height, Math.max(0, windowWidth - 48) / base.width);
  const dimensions =
    scale >= 1 ? base : { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };

  if (rounded || size === 'login') {
    return (
      <View style={[styles.roundedFrame, dimensions, style]} accessibilityRole="image" accessibilityLabel={t.brand.logoLabel}>
        <Image
          source={require('@/assets/images/amrale-logo.png')}
          style={styles.roundedImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={require('@/assets/images/amrale-logo.png')}
        style={[dimensions, styles.image]}
        resizeMode="contain"
        accessibilityLabel={t.brand.logoLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
  },
  roundedFrame: {
    borderRadius: amraleRadius.xxl,
    overflow: 'hidden',
    backgroundColor: amraleColors.blue,
    alignSelf: 'center',
    shadowColor: amraleColors.blue,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  roundedImage: {
    width: '100%',
    height: '100%',
  },
});
