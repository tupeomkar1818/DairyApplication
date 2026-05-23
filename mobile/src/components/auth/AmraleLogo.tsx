import { Image, StyleSheet, View, ViewStyle } from 'react-native';

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

export function AmraleLogo({ size = 'auth', rounded = false, style }: Props) {
  const dimensions = SIZES[size];

  if (rounded || size === 'login') {
    return (
      <View style={[styles.roundedFrame, dimensions, style]} accessibilityRole="image" accessibilityLabel="Amrale Dairy logo">
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
        accessibilityLabel="Amrale Dairy logo"
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
