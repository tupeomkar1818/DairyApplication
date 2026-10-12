import { describe, expect, it } from 'vitest';

import { computeDashboardCoverLayout } from '@/src/components/dashboard/dashboardCoverLayout';

/** The banner must never crop: width / height should stay within a pixel of the image's aspect ratio. */
function renderedRatio(size: { width: number; height: number }): number {
  return size.width / size.height;
}

describe('computeDashboardCoverLayout', () => {
  it('fills the width edge to edge on a phone', () => {
    const layout = computeDashboardCoverLayout(375, 812, 2.4);
    expect(layout.rounded).toBe(false);
    expect(layout.width).toBe(375);
    expect(layout.height).toBe(156);
  });

  it('keeps the image aspect ratio at every size, so nothing is cropped', () => {
    for (const [w, h] of [
      [320, 640],
      [375, 812],
      [768, 1024],
      [1280, 800],
      [1920, 1080],
    ] as const) {
      const layout = computeDashboardCoverLayout(w, h, 2.4);
      expect(renderedRatio(layout)).toBeCloseTo(2.4, 1);
    }
  });

  it('caps the height to a third of a short window instead of growing with width', () => {
    const layout = computeDashboardCoverLayout(1440, 700, 2.4);
    expect(layout.height).toBeLessThanOrEqual(Math.round(700 * 0.32));
    expect(layout.width).toBeLessThanOrEqual(1120);
  });

  it('centres a rounded card on tablets and desktops', () => {
    expect(computeDashboardCoverLayout(768, 1024, 2.4).rounded).toBe(true);
    expect(computeDashboardCoverLayout(1440, 900, 2.4).rounded).toBe(true);
  });

  it('never exceeds the content column on a very wide window', () => {
    const layout = computeDashboardCoverLayout(2560, 1440, 2.4);
    expect(layout.width).toBeLessThanOrEqual(1120);
  });

  it('falls back to a wide strip when the cover has no aspect ratio yet', () => {
    const phone = computeDashboardCoverLayout(375, 812, undefined);
    const desktop = computeDashboardCoverLayout(1440, 900, undefined);
    expect(renderedRatio(phone)).toBeCloseTo(2.8, 1);
    expect(renderedRatio(desktop)).toBeCloseTo(4.5, 1);
  });

  it('survives a zero width (first render before layout)', () => {
    expect(computeDashboardCoverLayout(0, 0, 2.4)).toEqual({ width: 0, height: 160, rounded: false });
  });
});
