/** OTP validity and resend cooldown — shared by auth, profile, and future backend. */
export const OTP_EXPIRY_MS = 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function msUntilIso(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - Date.now());
}

export function formatOtpCountdownMmSs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function otpResendCooldownMessage(resendAvailableAt: string): string {
  return `Resend OTP in ${formatOtpCountdownMmSs(msUntilIso(resendAvailableAt))}`;
}
