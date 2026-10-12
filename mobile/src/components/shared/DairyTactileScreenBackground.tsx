import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { dairyTactileColors } from '@/src/theme/dairyTactile';
import { pointerEventsNone } from '@/src/theme/platformStyles';

type Props = {
  children: ReactNode;
};

/** Floating organic blobs + cool surface canvas for utility admin screens */
export function DairyTactileScreenBackground({ children }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, pointerEventsNone]} accessibilityElementsHidden>
        <LinearGradient
          colors={['rgba(0, 85, 199, 0.12)', 'rgba(20, 109, 244, 0.04)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.blob, { top: -height * 0.08, right: -width * 0.2, width: width * 0.75, height: height * 0.35 }]}
        />
        <LinearGradient
          colors={['rgba(176, 198, 255, 0.35)', 'transparent']}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.2, y: 0.3 }}
          style={[styles.blob, { bottom: height * 0.12, left: -width * 0.25, width: width * 0.7, height: height * 0.28 }]}
        />
        <View
          style={[
            styles.blob,
            styles.blobSoft,
            { top: height * 0.18, left: width * 0.55, width: width * 0.42, height: width * 0.42 },
          ]}
        />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: dairyTactileColors.surface,
    // The decorative blobs bleed past the edges on purpose; clip them so they never widen the page (on phones the
    // browser zoomed out to fit them, giving a sideways-scrolling, shrunken screen).
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobSoft: {
    backgroundColor: dairyTactileColors.surfaceTintBlue,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
