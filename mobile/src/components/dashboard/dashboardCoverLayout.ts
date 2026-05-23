/**
 * Full-bleed cover height: matches image aspect at viewport width so the whole banner is visible.
 */
export function computeDashboardCoverHeight(
  viewportWidth: number,
  imageAspectRatio?: number,
): number {
  if (viewportWidth <= 0) return 160;

  if (imageAspectRatio && imageAspectRatio > 0) {
    const naturalHeight = viewportWidth / imageAspectRatio;
    return Math.round(Math.min(420, Math.max(100, naturalHeight)));
  }

  const fallbackRatio =
    viewportWidth >= 1024 ? 0.22 : viewportWidth >= 640 ? 0.28 : viewportWidth >= 400 ? 0.34 : 0.38;

  return Math.round(Math.min(360, Math.max(140, viewportWidth * fallbackRatio)));
}
