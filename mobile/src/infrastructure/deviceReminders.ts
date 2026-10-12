import type {
  DeviceReminder,
  DeviceReminderPermission,
  DeviceReminderResponse,
} from '@/src/infrastructure/deviceReminders.types';

/**
 * Browser notifications for the 6 pm IST order reminder (web).
 *
 * A browser cannot wake a closed site, so on the web the reminder pops up only if the app is open in a tab at the
 * moment it is 6 pm IST (the browser's own clock and time zone decide when that moment is). It pops up once: never
 * again after a reload, in a second tab, or later in the evening. Clicking it opens the app, where the customer
 * answers "Keep as it is" or "Change order". Phones use `deviceReminders.native.ts`, which schedules real
 * notifications that arrive with the app closed.
 */

type Listener = (response: DeviceReminderResponse) => void;

const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Browsers cap timers at ~24.8 days; reminders further out are armed on a later sync. */
const MAX_TIMER_MS = 2 ** 31 - 1;
/** A timer that fires this late (a sleeping laptop, a throttled tab) is not "at 6 pm" any more, so it stays quiet. */
export const WEB_REMINDER_LATE_LIMIT_MS = 5 * 60_000;
const SHOWN_KEY = 'DAIRY_ORDER_REMINDER_SHOWN_V1';

function api(): typeof Notification | null {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification : null;
}

export function deviceRemindersSupported(): boolean {
  return !!api();
}

export async function getDeviceReminderPermission(): Promise<DeviceReminderPermission> {
  const N = api();
  if (!N) return 'unsupported';
  return N.permission === 'default' ? 'undetermined' : N.permission;
}

/** Must be called from a tap: browsers ignore permission requests that no one asked for. */
export async function requestDeviceReminderPermission(): Promise<DeviceReminderPermission> {
  const N = api();
  if (!N) return 'unsupported';
  const result = await N.requestPermission();
  return result === 'default' ? 'undetermined' : result;
}

/** Tags already shown on this browser, kept across reloads and shared by its tabs (the last few weeks only). */
function readShown(): string[] {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function claimShown(tag: string): boolean {
  const shown = readShown();
  if (shown.includes(tag)) return false;
  try {
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, tag].slice(-60)));
  } catch {
    // Storage blocked: still show it once in this tab.
  }
  return true;
}

function show(customerId: string, reminder: DeviceReminder): void {
  const N = api();
  const tag = `order-reminder:${customerId}:${reminder.ymd}`;
  if (!N || N.permission !== 'granted') return;
  if (Date.now() - reminder.at.getTime() > WEB_REMINDER_LATE_LIMIT_MS) return;
  if (!claimShown(tag)) return;
  try {
    // The same tag in two tabs replaces rather than stacks, should both fire in the same instant.
    const n = new N(reminder.title, { body: reminder.body, tag });
    n.onclick = () => {
      window.focus();
      n.close();
      for (const l of listeners) l({ ymd: reminder.ymd, customerId, action: 'open', key: `${tag}:open` });
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker; the in-app reminder still shows.
  }
}

/** Arms one pop-up per upcoming reminder, at its 6 pm IST moment, while this tab stays open (an empty list clears them). */
export async function syncDeviceReminders(customerId: string | null, reminders: readonly DeviceReminder[]): Promise<void> {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (!customerId) return;
  const now = Date.now();
  for (const r of reminders) {
    const wait = r.at.getTime() - now;
    if (wait <= 0 || wait > MAX_TIMER_MS) continue;
    timers.set(r.ymd, setTimeout(() => show(customerId, r), wait));
  }
}

export function addDeviceReminderResponseListener(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
