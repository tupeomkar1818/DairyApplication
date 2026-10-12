import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

/**
 * Max content widths per layout kind. Phones always get the full width; on tablets and laptops content is
 * centered and capped so cards, inputs and buttons don't stretch edge to edge.
 * - `list`: catalog lists / detail dashboards (follows `contentMaxWidth`: 1200, or 1320 on large monitors)
 * - `form`: add/edit forms and their sticky footers
 * - `reading`: long text (FAQ, privacy policy, profile)
 * - `sheet`: bottom sheets, narrow pickers and sticky single-button bars
 */
export type ResponsiveContainerVariant = 'list' | 'form' | 'reading' | 'sheet';

export const RESPONSIVE_CONTAINER_MAX_WIDTH = {
  form: 720,
  reading: 760,
  sheet: 560,
} as const;

export function useResponsiveContainerMaxWidth(variant: ResponsiveContainerVariant = 'list'): number {
  const { contentMaxWidth } = useResponsiveLayout();
  return variant === 'list' ? contentMaxWidth : RESPONSIVE_CONTAINER_MAX_WIDTH[variant];
}

/** Style that centers a block and caps its width (use when a wrapper View isn't practical, e.g. contentContainerStyle). */
export function useResponsiveContainerStyle(variant: ResponsiveContainerVariant = 'list'): ViewStyle {
  const maxWidth = useResponsiveContainerMaxWidth(variant);
  return { width: '100%', maxWidth, alignSelf: 'center' };
}

type Props = ViewProps & {
  variant?: ResponsiveContainerVariant;
  /** Stretch vertically (`flex: 1`) — for wrappers around lists/scroll views. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Centered, width-capped block; full width on phones. */
export function ResponsiveContainer({ variant = 'list', fill = false, style, children, ...rest }: Props) {
  const containerStyle = useResponsiveContainerStyle(variant);
  return (
    <View {...rest} style={[containerStyle, fill && styles.fill, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
