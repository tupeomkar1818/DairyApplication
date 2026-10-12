import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { loadNotifications, type NotificationsApi } from '@/src/infrastructure/expoNotifications';

import { subscribeLanguage } from '@/src/i18n/language';
import { strings } from '@/src/i18n/strings';
import type {
  DeviceReminder,
  DeviceReminderAction,
  DeviceReminderPermission,
  DeviceReminderResponse,
} from '@/src/infrastructure/deviceReminders.types';

/**
 * Phone notifications for the 6 pm IST order reminder (iOS / Android).
 *
 * The reminders are scheduled on the phone itself, ahead of time, so they appear with the app closed — once per
 * day, at the moment it is 6 pm IST (a fixed instant; the phone's own time zone decides what its clock shows then). Each carries two buttons — "Keep as it is" and "Change order" — whose answer reaches the app through
 * `addDeviceReminderResponseListener`.
 *
 * Expo Go on Android dropped notifications in SDK 53: loading the module there throws. So it is loaded when first
 * needed, not when this file is imported — a phone without it simply has no scheduled reminders (the app still
 * shows the reminder on its home screen), instead of the customer app failing to start.
 */

const KIND = 'order-reminder';
const CATEGORY = 'order-reminder';
const CHANNEL = 'order-reminders';

type Notifications = NotificationsApi;

let loaded: Notifications | null | undefined;

/** The notifications module, or null where this build cannot have it (Expo Go on Android). */
function notifications(): Notifications | null {
  if (loaded === undefined) {
    loaded = loadNotifications();
    loaded?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return loaded;
}

let prepared: Promise<void> | null = null;

function prepare(N: Notifications): Promise<void> {
  if (!prepared) {
    prepared = (async () => {
      // The channel name and the buttons are in the app's language; a language change prepares them again.
      const t = strings('inbox').reminders;
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync(CHANNEL, {
          name: t.channelName,
          importance: N.AndroidImportance.HIGH,
        });
      }
      await N.setNotificationCategoryAsync(CATEGORY, [
        { identifier: 'keep', buttonTitle: t.keepButton, options: { opensAppToForeground: true } },
        { identifier: 'change', buttonTitle: t.changeButton, options: { opensAppToForeground: true } },
      ]);
    })().catch(() => {
      prepared = null;
    });
  }
  return prepared;
}

export function deviceRemindersSupported(): boolean {
  return !!notifications();
}

/**
 * The permission answer as the module returns it. Typed here because its base type lives in a nested copy of
 * expo-modules-core that TypeScript cannot reach from expo-notifications, which hides the `status` field.
 */
type PermissionAnswer = { status: string };

function toPermission(status: string): DeviceReminderPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getDeviceReminderPermission(): Promise<DeviceReminderPermission> {
  const N = notifications();
  if (!N) return 'unsupported';
  const { status } = (await N.getPermissionsAsync()) as unknown as PermissionAnswer;
  return toPermission(status);
}

export async function requestDeviceReminderPermission(): Promise<DeviceReminderPermission> {
  const N = notifications();
  if (!N) return 'unsupported';
  const { status } = (await N.requestPermissionsAsync()) as unknown as PermissionAnswer;
  return toPermission(status);
}

/** Syncs run one after another: two overlapping syncs would each clear, then each schedule — every day twice. */
let queue: Promise<void> = Promise.resolve();

/** The last reminders scheduled, so a language change can schedule them again in the new language. */
let lastSync: { customerId: string; reminders: readonly DeviceReminder[] } | null = null;

// Scheduled notifications keep the words they were given. When the reader switches language, the channel, the buttons
// and every pending reminder are set up again: the reminders read their title and body at scheduling time
// (see `upcomingOrderReminders`), so they come out in the new language.
subscribeLanguage(() => {
  prepared = null;
  const last = lastSync;
  if (last) void syncDeviceReminders(last.customerId, last.reminders).catch(() => undefined);
});

/**
 * Replaces every scheduled order reminder on this phone with `reminders` (an empty list clears them): at most one
 * per day, and none for a moment already past. Does nothing where notifications are unavailable.
 */
export function syncDeviceReminders(customerId: string | null, reminders: readonly DeviceReminder[]): Promise<void> {
  const N = notifications();
  if (!N) return Promise.resolve();
  lastSync = customerId ? { customerId, reminders } : null;
  const run = queue.catch(() => undefined).then(() => replaceScheduled(N, customerId, reminders));
  queue = run;
  return run;
}

async function replaceScheduled(
  N: Notifications,
  customerId: string | null,
  reminders: readonly DeviceReminder[],
): Promise<void> {
  await prepare(N);
  const scheduled = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((s) => (s.content.data as { kind?: string } | undefined)?.kind === KIND)
      .map((s) => N.cancelScheduledNotificationAsync(s.identifier)),
  );
  if (!customerId) return;
  const now = Date.now();
  const days = new Set<string>();
  for (const r of reminders) {
    if (r.at.getTime() <= now || days.has(r.ymd)) continue;
    days.add(r.ymd);
    await N.scheduleNotificationAsync({
      content: {
        title: r.title,
        body: r.body,
        categoryIdentifier: CATEGORY,
        data: { kind: KIND, ymd: r.ymd, customerId },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
}

function toResponse(response: NotificationsModule.NotificationResponse): DeviceReminderResponse | null {
  const data = response.notification.request.content.data as { kind?: string; ymd?: string; customerId?: string } | undefined;
  if (data?.kind !== KIND || !data.ymd || !data.customerId) return null;
  const action: DeviceReminderAction =
    response.actionIdentifier === 'keep' ? 'keep' : response.actionIdentifier === 'change' ? 'change' : 'open';
  return { ymd: data.ymd, customerId: data.customerId, action, key: `${response.notification.request.identifier}:${action}` };
}

/** Answers from the notification's buttons (or a tap on it), including the one that opened a closed app. */
export function addDeviceReminderResponseListener(listener: (response: DeviceReminderResponse) => void): () => void {
  const N = notifications();
  if (!N) return () => undefined;
  // Each answer is handled once: clearing it stops the next app start from replaying the same tap.
  const handle = (r: NotificationsModule.NotificationResponse | null) => {
    const mapped = r ? toResponse(r) : null;
    if (!mapped) return;
    N.clearLastNotificationResponse();
    listener(mapped);
  };
  const subscription = N.addNotificationResponseReceivedListener(handle);
  void N.getLastNotificationResponseAsync().then(handle);
  return () => subscription.remove();
}
