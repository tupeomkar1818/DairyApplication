import { platformShadow } from '@/src/theme/platformStyles';

/** DairyTactile Modern — Amrale Dairy design tokens */

export const dairyTactileColors = {
  surface: '#f7f9ff',
  surfaceDim: '#cadcf2',
  surfaceBright: '#f7f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#edf4ff',
  surfaceContainer: '#e3efff',
  surfaceContainerHigh: '#d9eaff',
  surfaceContainerHighest: '#d3e4fa',
  onSurface: '#0b1d2d',
  onSurfaceVariant: '#424653',
  inverseSurface: '#213243',
  inverseOnSurface: '#e8f1ff',
  outline: '#737785',
  outlineVariant: '#c3c6d6',
  surfaceTint: '#0958ca',
  primary: '#003f98',
  onPrimary: '#ffffff',
  primaryContainer: '#0055c7',
  onPrimaryContainer: '#c5d4ff',
  inversePrimary: '#b0c6ff',
  secondary: '#5c5f60',
  onSecondary: '#ffffff',
  secondaryContainer: '#e1e3e4',
  onSecondaryContainer: '#626566',
  tertiary: '#3e454f',
  onTertiary: '#ffffff',
  tertiaryContainer: '#555c67',
  onTertiaryContainer: '#ced4e1',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#f7f9ff',
  onBackground: '#0b1d2d',
  surfaceVariant: '#d3e4fa',
  dairyGradientStart: '#0055c7',
  dairyGradientEnd: '#146df4',
  glassAccent: 'rgba(255, 255, 255, 0.7)',
  surfaceTintBlue: 'rgba(37, 117, 252, 0.08)',
} as const;

/** @deprecated Use `dairyTactileColors` — kept for gradual migration */
export const amraleColors = {
  blue: dairyTactileColors.primaryContainer,
  white: dairyTactileColors.surfaceContainerLowest,
  surface: dairyTactileColors.surface,
  text: dairyTactileColors.onSurface,
  textMuted: dairyTactileColors.onSurfaceVariant,
  textSubtle: dairyTactileColors.outline,
  whiteMuted: 'rgba(255, 255, 255, 0.78)',
  whiteSubtle: 'rgba(255, 255, 255, 0.55)',
  inputBg: 'rgba(255, 255, 255, 0.12)',
  inputBorder: 'rgba(255, 255, 255, 0.28)',
  inputBgLight: dairyTactileColors.surfaceContainerLow,
  inputBorderLight: dairyTactileColors.outlineVariant,
  inputBorderFocus: dairyTactileColors.primaryContainer,
  error: dairyTactileColors.error,
  errorOnDark: '#FFB4B4',
  buttonDisabled: 'rgba(255, 255, 255, 0.45)',
  buttonDisabledFilled: 'rgba(0, 85, 199, 0.45)',
  cardShadow: 'rgba(0, 85, 199, 0.14)',
} as const;

export const dairyGradient = {
  colors: [dairyTactileColors.dairyGradientStart, dairyTactileColors.dairyGradientEnd] as const,
  start: { x: 0, y: 0 } as const,
  end: { x: 1, y: 1 } as const,
};

export const amraleSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** DairyTactile spec (8px rhythm) */
  base: 8,
  gutter: 20,
  marginMobile: 16,
  marginDesktop: 40,
  cardGap: 12,
} as const;

export const amraleRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 24,
  pill: 9999,
} as const;

export const amraleTypography = {
  fontFamily: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
  headlineLg: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
  },
  headlineLgMobile: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.52,
  },
  headlineMd: {
    fontSize: 24,
    lineHeight: 31,
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 29,
  },
  bodyMd: {
    fontSize: 16,
    lineHeight: 26,
  },
  labelMd: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.7,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
  },
} as const;

/** Dual-stack tactile elevation (RN supports one shadow; tuned for primary glow) */
export function tactileCardElevation() {
  return platformShadow({
    shadowColor: dairyTactileColors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
  });
}

export function primaryButtonElevation() {
  return platformShadow({
    shadowColor: dairyTactileColors.primaryContainer,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  });
}
