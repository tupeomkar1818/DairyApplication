import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints (width in px):
 * - Mobile: &lt; 640
 * - Tablet: 640–1023
 * - Laptop/desktop: 1024–1439
 * - Large monitor: ≥ 1440
 */
export const RESPONSIVE = {
  tabletMin: 640,
  desktopMin: 1024,
  largeMin: 1440,
} as const;

export type ResponsiveLayout = {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
  /** Max width for centered admin content */
  contentMaxWidth: number;
  /** Card grid columns for list screens */
  listColumns: 1 | 2 | 3;
  /** Safe max height for dialogs (viewport-relative) */
  dialogMaxHeight: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const isMobile = width < RESPONSIVE.tabletMin;
    const isTablet = width >= RESPONSIVE.tabletMin && width < RESPONSIVE.desktopMin;
    const isDesktop = width >= RESPONSIVE.desktopMin && width < RESPONSIVE.largeMin;
    const isLarge = width >= RESPONSIVE.largeMin;
    const contentMaxWidth = Math.min(
      width - 24,
      isLarge ? 1320 : width >= RESPONSIVE.desktopMin ? 1200 : width - 16,
    );
    const listColumns = (width >= RESPONSIVE.desktopMin ? 3 : width >= RESPONSIVE.tabletMin ? 2 : 1) as 1 | 2 | 3;
    const dialogMaxHeight = Math.max(280, Math.min(Math.round(height * 0.9), height - 24));
    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isLarge,
      contentMaxWidth,
      listColumns,
      dialogMaxHeight,
    };
  }, [width, height]);
}

/**
 * Size for a react-native-paper `Dialog` (or any centered modal card): capped width on tablets/desktops, a small
 * side gutter on phones, and a viewport-relative max height so tall content scrolls instead of overflowing.
 * Paper's Dialog only sets `marginHorizontal: 26` and no max width, so without this it spans the whole window.
 */
export function responsiveDialogStyle(
  width: number,
  height: number,
  maxWidth = 480,
): { alignSelf: 'center'; width: number; maxHeight: number; marginHorizontal: number } {
  return {
    alignSelf: 'center',
    width: Math.max(260, Math.min(width - 32, maxWidth)),
    maxHeight: Math.max(280, Math.min(Math.round(height * 0.9), height - 24)),
    marginHorizontal: 0,
  };
}

export function useResponsiveDialogStyle(maxWidth = 480) {
  const { width, height } = useWindowDimensions();
  return useMemo(() => responsiveDialogStyle(width, height, maxWidth), [width, height, maxWidth]);
}

/**
 * Card width for a horizontal grid inside a full-bleed page (list screens).
 */
export function computeListCardWidth(
  width: number,
  columns: number,
  opts?: { gap?: number; pagePadding?: number; maxInner?: number },
): number {
  const gap = opts?.gap ?? 12;
  const pagePadding = opts?.pagePadding ?? 32;
  const maxInner = opts?.maxInner ?? 1120;
  const inner = Math.min(width - pagePadding, maxInner);
  const c = Math.max(1, columns);
  return Math.max(120, Math.floor((inner - gap * (c - 1)) / c));
}
