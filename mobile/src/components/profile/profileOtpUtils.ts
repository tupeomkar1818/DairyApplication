export function emptyOtpDigits(): string[] {
  return ['', '', '', '', '', ''];
}

export function otpDigitsToString(digits: string[]): string {
  return digits.join('');
}

export function mapDomainErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}
