import type * as NotificationsModule from 'expo-notifications';

/**
 * Loading `expo-notifications` where it exists.
 *
 * Expo Go on Android dropped notifications in SDK 53, and merely importing the module there throws. Importing it
 * normally would take the whole customer app down with it, so it is loaded here, on first use and inside a try —
 * a phone without it simply schedules no reminders.
 */

export type NotificationsApi = typeof NotificationsModule;

export function loadNotifications(): NotificationsApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsApi;
  } catch {
    return null;
  }
}
