import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` while the screen is open — so a screen left open past a cut-off
 * (9 pm for tomorrow's changes) locks the day without the customer having to reopen it.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
