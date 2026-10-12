export type DashboardCoverLayout = {
  width: number;
  height: number;
  /** Tablets and desktops show the banner as a centered card; phones keep it edge to edge. */
  rounded: boolean;
};

/** Widest the banner may get on tablets/desktops — the same column the dashboard content uses. */
const MAX_CONTENT_WIDTH = 1120;
/** Side gutter when the banner is not full-bleed. */
const SIDE_GUTTER = 16;
const PHONE_MAX_WIDTH = 640;

/** Assumed shape when the stored cover has no aspect ratio yet: a wide strip, wider on bigger screens. */
function fallbackAspectRatio(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 4.5;
  if (viewportWidth >= PHONE_MAX_WIDTH) return 3.6;
  return 2.8;
}

/**
 * Banner size for a viewport. The whole image is always shown: the height is budgeted from the viewport height and
 * the width follows the image's own aspect ratio, so nothing is cropped on a wide window and the banner never eats
 * the screen on a short one.
 */
export function computeDashboardCoverLayout(
  viewportWidth: number,
  viewportHeight: number | undefined,
  imageAspectRatio?: number,
): DashboardCoverLayout {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return { width: 0, height: 160, rounded: false };
  }

  const isPhone = viewportWidth < PHONE_MAX_WIDTH;
  const ratio =
    imageAspectRatio && Number.isFinite(imageAspectRatio) && imageAspectRatio > 0
      ? imageAspectRatio
      : fallbackAspectRatio(viewportWidth);

  const availableWidth = isPhone
    ? viewportWidth
    : Math.max(240, Math.min(viewportWidth - SIDE_GUTTER * 2, MAX_CONTENT_WIDTH));

  // Height budget: a third of the window, and never taller than these absolute caps.
  const viewportBudget =
    viewportHeight && viewportHeight > 0 ? viewportHeight * (isPhone ? 0.34 : 0.32) : Infinity;
  const maxHeight = Math.max(120, Math.min(isPhone ? 280 : 320, viewportBudget));

  const height = Math.round(Math.min(maxHeight, availableWidth / ratio));
  // Phones stay edge to edge; wider screens take exactly the width the ratio asks for, so the card is never cropped.
  const width = isPhone ? availableWidth : Math.round(Math.min(availableWidth, height * ratio));

  return { width, height, rounded: !isPhone };
}
