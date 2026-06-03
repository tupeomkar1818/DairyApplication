import { Platform, type TextInputProps, type ViewStyle } from 'react-native';

export type PlatformShadowOptions = {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0]! + normalized[0]!, 16),
      g: parseInt(normalized[1]! + normalized[1]!, 16),
      b: parseInt(normalized[2]! + normalized[2]!, 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

function toRgbaString(color: string, opacity: number): string {
  const trimmed = color.trim();
  const rgbaMatch = trimmed.match(/rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbaMatch) {
    const alpha = Number(rgbaMatch[4]) * opacity;
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  }
  const rgbMatch = trimmed.match(/rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
  }
  if (trimmed.startsWith('#')) {
    const rgb = hexToRgb(trimmed);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }
  return `rgba(0, 0, 0, ${opacity})`;
}

/** Native shadow* props on iOS/Android; `boxShadow` on web (avoids RN Web deprecation warnings). */
export function platformShadow({
  shadowColor = '#000000',
  shadowOffset = { width: 0, height: 0 },
  shadowOpacity = 0.1,
  shadowRadius = 8,
  elevation,
}: PlatformShadowOptions = {}): ViewStyle {
  if (Platform.OS !== 'web') {
    return {
      shadowColor,
      shadowOffset,
      shadowOpacity,
      shadowRadius,
      ...(elevation != null ? { elevation } : {}),
    };
  }

  const { width, height } = shadowOffset;
  return {
    boxShadow: `${width}px ${height}px ${shadowRadius}px ${toRgbaString(shadowColor, shadowOpacity)}`,
  };
}

/** Prefer over `pointerEvents` prop — RN Web deprecates the prop in favor of style. */
export const pointerEventsNone: ViewStyle = {
  pointerEvents: 'none',
};

export type FormFieldAttrs = Pick<TextInputProps, 'nativeID' | 'autoComplete'> & {
  /** HTML `name` — set on web for autofill and DevTools form audits. */
  name?: string;
};

function sanitizeFieldName(fieldName: string): string {
  const trimmed = fieldName.trim();
  if (!trimmed) return 'form-field';
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/** `nativeID` (DOM id) everywhere; adds `name` on web for browser autofill. */
export function formFieldAttrs(
  fieldName: string,
  options?: { autoComplete?: TextInputProps['autoComplete'] },
): FormFieldAttrs {
  const id = sanitizeFieldName(fieldName);
  const base: FormFieldAttrs = {
    nativeID: id,
    ...(options?.autoComplete != null ? { autoComplete: options.autoComplete } : {}),
  };
  if (Platform.OS === 'web') {
    return { ...base, name: id };
  }
  return base;
}
