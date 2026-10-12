/**
 * Where the dairy's server can reach this phone.
 *
 * Only exists where there is a server to tell: a phone keeping its own records has no push to send, and schedules
 * its own reminders instead (`deviceReminders`).
 */
export interface IPushService {
  /** POST /push/tokens */
  register(input: { token: string; platform: string; language: string }): Promise<void>;

  /** DELETE /push/tokens/:token */
  forget(token: string): Promise<void>;
}
