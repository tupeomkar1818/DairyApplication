import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { amraleColors } from '@/src/theme/dairyTactile';

type Props = {
  variant?: 'dark' | 'light';
};

/** Sculptural milk-splash accents — Pure & Vital brand imagery (no native SVG dep) */
export function MilkSplashDecor({ variant = 'dark' }: Props) {
  const { width, height } = useWindowDimensions();
  const isLight = variant === 'light';
  const accent = isLight ? amraleColors.blue : amraleColors.white;

  const blob = (opacity: number) => ({
    backgroundColor: accent,
    opacity,
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      <LinearGradient
        colors={[`${accent}22`, `${accent}08`, 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.6, y: 0.4 }}
        style={[styles.glow, { left: -width * 0.2, bottom: height * 0.05, width: width * 0.9, height: height * 0.45 }]}
      />
      <LinearGradient
        colors={[`${accent}1A`, 'transparent']}
        start={{ x: 1, y: 1 }}
        end={{ x: 0.3, y: 0.5 }}
        style={[styles.glow, { right: -width * 0.15, bottom: height * 0.08, width: width * 0.75, height: height * 0.38 }]}
      />
      <LinearGradient
        colors={[`${accent}14`, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={[styles.glow, { top: -height * 0.02, right: width * 0.08, width: width * 0.5, height: height * 0.28 }]}
      />

      <View
        style={[
          styles.blob,
          {
            left: -width * 0.12,
            bottom: height * 0.1,
            width: width * 0.5,
            height: height * 0.16,
          },
          blob(isLight ? 0.05 : 0.07),
        ]}
      />
      <View
        style={[
          styles.blob,
          {
            right: -width * 0.1,
            bottom: height * 0.12,
            width: width * 0.42,
            height: height * 0.12,
          },
          blob(isLight ? 0.04 : 0.06),
        ]}
      />
      <View
        style={[
          styles.blob,
          {
            top: height * 0.04,
            right: width * 0.2,
            width: width * 0.22,
            height: height * 0.08,
          },
          blob(isLight ? 0.05 : 0.08),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
});
