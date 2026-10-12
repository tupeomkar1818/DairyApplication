import { useMemo } from 'react';

import { RESPONSIVE_CONTAINER_MAX_WIDTH } from '@/src/components/shared/ResponsiveContainer';
import { useResponsiveLayout } from '@/src/utils/responsiveLayout';

/**
 * Widths for the delivery-app screens.
 *
 * On a phone or a portrait tablet these screens are one column capped at form width — the same reading width as the
 * admin forms. Once the window is wide enough they take the full centered content width and lay their content out in
 * columns, so a big screen shows more of the run instead of one narrow strip with empty gutters on both sides.
 */

/** Side padding inside the screen body. */
export const DELIVERY_PAD = 16;
/** Gap between columns and between cards. */
export const DELIVERY_GAP = 12;
/** Width of the fixed side column (the load sheet) on wide screens. */
export const DELIVERY_ASIDE_WIDTH = 320;
/**
 * Width at which these screens switch to columns. Below the laptop breakpoint on purpose: a landscape tablet
 * has room for a side column, and leaving it as one narrow strip wastes most of the screen.
 */
export const DELIVERY_WIDE_MIN = 900;

export type DeliveryLayout = {
  /** Laptop and up: content is laid out in columns. */
  isWide: boolean;
  /** Max width for the screen body (and its app bar, so the two line up). */
  maxWidth: number;
  /** Usable width inside the body padding. */
  innerWidth: number;
  /** Width of the main column (the whole inner width unless a side column is shown). */
  mainWidth: number;
  /** Columns for cards in the main column. */
  columns: number;
  /** Width of one card cell, so the last row lines up with the rows above it. */
  cardWidth: number;
};

export function useDeliveryLayout(options?: { aside?: boolean; minCardWidth?: number }): DeliveryLayout {
  const { width, contentMaxWidth } = useResponsiveLayout();
  const aside = options?.aside ?? false;
  const minCardWidth = options?.minCardWidth ?? 360;

  return useMemo(() => {
    const isWide = width >= DELIVERY_WIDE_MIN;
    const maxWidth = isWide ? contentMaxWidth : RESPONSIVE_CONTAINER_MAX_WIDTH.form;
    const innerWidth = Math.max(0, Math.min(width, maxWidth) - DELIVERY_PAD * 2);
    const mainWidth = isWide && aside ? Math.max(0, innerWidth - DELIVERY_ASIDE_WIDTH - DELIVERY_GAP) : innerWidth;

    const columns = isWide ? Math.max(1, Math.min(3, Math.floor((mainWidth + DELIVERY_GAP) / (minCardWidth + DELIVERY_GAP)))) : 1;
    const cardWidth = Math.floor((mainWidth - DELIVERY_GAP * (columns - 1)) / columns);

    return { isWide, maxWidth, innerWidth, mainWidth, columns, cardWidth };
  }, [aside, contentMaxWidth, minCardWidth, width]);
}
