type Clamp = { min: number; max: number };

function clamp(n: number, { min, max }: Clamp) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Responsive font size based on window width.
 * - Uses 375 as the base width (typical mobile design width).
 * - Uses moderate scaling to avoid huge jumps on desktop.
 * - Always clamps to a safe range.
 */
export function rf(
  baseFontSize: number,
  width: number,
  opts: { factor?: number; clamp?: Clamp } = {},
): number {
  const factor = opts.factor ?? 0.5;
  const scale = width / 375;
  const next = baseFontSize + (baseFontSize * (scale - 1)) * factor;
  const c = opts.clamp ?? { min: Math.max(10, baseFontSize - 2), max: baseFontSize + 8 };
  return Math.round(clamp(next, c));
}

