/** DairyTactile Modern — Amrale Dairy design tokens */

export const amraleColors = {
  blue: '#3551A1',
  white: '#FFFFFF',
  surface: '#F7F8FC',
  text: '#1A2B4B',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  whiteMuted: 'rgba(255, 255, 255, 0.78)',
  whiteSubtle: 'rgba(255, 255, 255, 0.55)',
  inputBg: 'rgba(255, 255, 255, 0.12)',
  inputBorder: 'rgba(255, 255, 255, 0.28)',
  inputBgLight: '#EEF2FB',
  inputBorderLight: '#D4DCF0',
  inputBorderFocus: 'rgba(255, 255, 255, 0.65)',
  error: '#E11D48',
  errorOnDark: '#FFB4B4',
  buttonDisabled: 'rgba(255, 255, 255, 0.45)',
  buttonDisabledFilled: 'rgba(53, 81, 161, 0.45)',
  cardShadow: 'rgba(53, 81, 161, 0.12)',
} as const;

export const amraleSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const amraleRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const amraleTypography = {
  fontFamily: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semiBold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
} as const;
