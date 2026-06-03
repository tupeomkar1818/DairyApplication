import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';

import { dairyTactileColors } from '@/src/theme/dairyTactile';

export type AppSnackbarProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  duration?: number;
  actionLabel?: string;
};

/**
 * Toast/snackbar that uses Paper on native and a static bar on web so Animated
 * does not request `useNativeDriver` (unsupported on react-native-web).
 */
export function AppSnackbar({
  visible,
  message,
  onDismiss,
  duration = 3500,
  actionLabel = 'OK',
}: AppSnackbarProps) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (Platform.OS === 'web') {
    if (!visible || !message) return null;
    return (
      <View style={styles.webHost} accessibilityLiveRegion="polite">
        <View style={styles.webBar}>
          <Text variant="bodyMedium" style={styles.webMessage}>
            {message}
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.webAction, pressed && styles.webActionPressed]}
          >
            <Text variant="labelLarge" style={styles.webActionLabel}>
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={duration}
      action={{ label: actionLabel, onPress: onDismiss }}
    >
      {message}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  webHost: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  webBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 560,
    width: '92%',
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#323232',
    pointerEvents: 'auto',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.28)',
  },
  webMessage: {
    flex: 1,
    color: '#FFFFFF',
  },
  webAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  webActionPressed: {
    opacity: 0.75,
  },
  webActionLabel: {
    color: dairyTactileColors.inversePrimary,
    fontWeight: '700',
  },
});
