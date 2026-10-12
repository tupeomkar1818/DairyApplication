import { StyleSheet } from 'react-native';

import { amraleColors, amraleRadius, amraleSpacing, amraleTypography } from '@/src/theme/dairyTactile';

/** Shared type and controls for the sign-in cards (login, OTP), so the two screens read as one flow. */
export const authFormStyles = StyleSheet.create({
  title: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 24, color: amraleColors.text },
  subtitle: {
    marginTop: 6,
    fontFamily: amraleTypography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: amraleColors.textMuted,
  },
  strong: { fontFamily: amraleTypography.fontFamily.bold, color: amraleColors.text },
  link: { fontFamily: amraleTypography.fontFamily.semiBold, fontSize: 13, color: amraleColors.blue },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: amraleSpacing.md,
    padding: 10,
    borderRadius: amraleRadius.md,
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
  },
  errorBoxText: { flex: 1, fontFamily: amraleTypography.fontFamily.medium, fontSize: 13, color: amraleColors.error },

  button: {
    marginTop: 20,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: amraleRadius.lg,
    backgroundColor: amraleColors.blue,
    shadowColor: amraleColors.blue,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /** Still tappable (to show what is missing), but reads as not ready until the input is complete. */
  buttonIdle: { backgroundColor: amraleColors.buttonDisabledFilled, shadowOpacity: 0, elevation: 0 },
  buttonDone: { backgroundColor: '#15803D', shadowColor: '#15803D' },
  buttonPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  buttonText: { fontFamily: amraleTypography.fontFamily.bold, fontSize: 16, letterSpacing: 0.3, color: amraleColors.white },

  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  noteText: { fontFamily: amraleTypography.fontFamily.regular, fontSize: 12, color: amraleColors.textSubtle },
  divider: { height: 1, backgroundColor: amraleColors.inputBorderLight, marginVertical: 18 },
});
