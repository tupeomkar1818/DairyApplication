import { useEffect, useState } from 'react';

import { formatOtpCountdownMmSs, msUntilIso } from '@/src/domain/shared/otpPolicy';

export { formatOtpCountdownMmSs, msUntilIso };

function useMsUntilCountdown(iso: string | undefined): number {
  const [remainingMs, setRemainingMs] = useState(() => msUntilIso(iso));

  useEffect(() => {
    setRemainingMs(msUntilIso(iso));
    if (!iso) return;
    const id = setInterval(() => setRemainingMs(msUntilIso(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  return remainingMs;
}

export function useOtpCountdown(expiryIso: string | undefined): string {
  return formatOtpCountdownMmSs(useMsUntilCountdown(expiryIso));
}

export function useOtpResendCountdown(resendAvailableAt: string | undefined): {
  remainingMs: number;
  label: string;
} {
  const remainingMs = useMsUntilCountdown(resendAvailableAt);
  return {
    remainingMs,
    label: formatOtpCountdownMmSs(remainingMs),
  };
}
