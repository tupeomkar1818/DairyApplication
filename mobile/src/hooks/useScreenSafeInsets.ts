import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_MIN_TOP = 12;

/**
 * Consistent safe-area padding for full-screen layouts (status bar + home indicator).
 * Use `headerPaddingTop` on app bars; use `scrollPaddingBottom` on ScrollView/FlatList content.
 */
export function useScreenSafeInsets(minTop = DEFAULT_MIN_TOP) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, minTop);

  return {
    insets,
    top,
    bottom: insets.bottom,
    headerPaddingTop: top,
    scrollPaddingBottom: (extra = 16) => extra + insets.bottom,
  };
}
