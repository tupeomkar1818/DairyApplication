export type DeviceReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** One reminder to show on this device: tomorrow's order for `ymd`, at 6 pm IST the evening before. */
export type DeviceReminder = { ymd: string; at: Date; title: string; body: string };

/** What the customer did with a device notification: a button, or a plain tap. */
export type DeviceReminderAction = 'keep' | 'change' | 'open';

export type DeviceReminderResponse = {
  ymd: string;
  customerId: string;
  action: DeviceReminderAction;
  /** Identifies this one response, so the same tap is never handled twice. */
  key: string;
};
