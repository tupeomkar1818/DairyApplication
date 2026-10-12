import { useEffect } from 'react';

import { sendDueOrderReminders } from '@/src/infrastructure/orderReminderScheduler';

/** Checks once a minute whether the 6 pm order reminders are due, and sends them (see `sendDueOrderReminders`). */
export function useDailyOrderReminders(intervalMs = 60_000): void {
  useEffect(() => {
    void sendDueOrderReminders();
    const id = setInterval(() => void sendDueOrderReminders(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
