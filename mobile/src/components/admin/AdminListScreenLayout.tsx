import { router } from 'expo-router';
import { ReactNode, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ScreenHeader } from '@/src/components/shared';
import { useScreenSafeInsets } from '@/src/hooks/useScreenSafeInsets';
import { amraleColors, amraleSpacing } from '@/src/theme/dairyTactile';
import { computeListCardWidth, useResponsiveLayout } from '@/src/utils/responsiveLayout';

/** Horizontal padding inside the centered list column (search bar, cards). */
export const ADMIN_LIST_PAD = amraleSpacing.md;
/** Gap between grid cards (both axes). */
export const ADMIN_LIST_GAP = 12;

export type AdminListGrid = {
  isMobile: boolean;
  /** 1 on phones, 2 on tablets, 3 on laptops/desktops — use as FlatList `numColumns` and `key`. */
  columns: 1 | 2 | 3;
  /**
   * Centers a block at the list content width (full width on phones). Apply to the controls bar and to the FlatList
   * `contentContainerStyle` (the FlatList itself stays full-bleed so the whole window scrolls it on desktop web).
   */
  containerStyle: ViewStyle;
  /** Max width of the content inside the list padding, so header titles line up with the cards (undefined on phones). */
  innerMaxWidth: number | undefined;
  /** Style for one grid cell when `columns > 1`: shares the row, and a lone last card keeps the column width. */
  cellStyle: ViewStyle | undefined;
};

/** Shared responsive grid metrics for admin list screens (Customers, Products, Delivery Boys). */
export function useAdminListGrid(): AdminListGrid {
  const { width, isMobile, listColumns, contentMaxWidth } = useResponsiveLayout();
  return useMemo(() => {
    const containerWidth = isMobile ? width : Math.min(width, contentMaxWidth);
    const innerWidth = Math.max(0, containerWidth - ADMIN_LIST_PAD * 2);
    const cardMaxWidth = computeListCardWidth(containerWidth, listColumns, {
      gap: ADMIN_LIST_GAP,
      pagePadding: ADMIN_LIST_PAD * 2,
      maxInner: innerWidth,
    });
    return {
      isMobile,
      columns: listColumns,
      containerStyle: { width: '100%', maxWidth: isMobile ? undefined : contentMaxWidth, alignSelf: 'center' },
      innerMaxWidth: isMobile ? undefined : innerWidth,
      cellStyle: listColumns > 1 ? { flex: 1, minWidth: 0, maxWidth: cardMaxWidth } : undefined,
    };
  }, [width, isMobile, listColumns, contentMaxWidth]);
}

export type AdminListScreenLayoutProps = {
  title: string;
  children: (layout: { bottomInset: number }) => ReactNode;
  /** Renders after list content (e.g. modal hosts) */
  overlay?: ReactNode;
};

/** Shared shell for admin catalog list screens (Products, Customers, …) */
export function AdminListScreenLayout({ title, children, overlay }: AdminListScreenLayoutProps) {
  const { headerPaddingTop, bottom } = useScreenSafeInsets();
  const { innerMaxWidth } = useAdminListGrid();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={title}
        onBack={() => router.back()}
        paddingTop={headerPaddingTop}
        contentMaxWidth={innerMaxWidth}
      />
      {children({ bottomInset: bottom })}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: amraleColors.surface,
  },
});
