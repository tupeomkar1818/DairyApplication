import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeviceReminder } from '@/src/infrastructure/deviceReminders.types';

/** A browser with notifications allowed, and a shared localStorage (what a reload or a second tab would see). */
function fakeBrowser() {
  const shown: { title: string; tag?: string }[] = [];
  const store = new Map<string, string>();
  class FakeNotification {
    static permission = 'granted';
    static requestPermission = async () => 'granted';
    onclick: (() => void) | null = null;
    constructor(title: string, options?: { tag?: string }) {
      shown.push({ title, tag: options?.tag });
    }
    close() {}
  }
  vi.stubGlobal('window', {
    Notification: FakeNotification,
    focus: () => undefined,
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
  return { shown };
}

async function freshWebModule() {
  vi.resetModules();
  return import('@/src/infrastructure/deviceReminders');
}

describe('web reminder pop-up: once, at 6 pm IST', () => {
  const sixPmIst = new Date('2026-09-16T12:30:00.000Z');
  const reminder: DeviceReminder = { ymd: '2026-09-17', at: sixPmIst, title: "Tomorrow's order · Thu, 17 Sep", body: '…' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:00.000Z')); // 5:30 pm IST
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pops up at the moment, once, even when the reminders are re-synced and a second tab is open', async () => {
    const { shown } = fakeBrowser();
    const tab1 = await freshWebModule();
    await tab1.syncDeviceReminders('cust_1', [reminder]);
    await tab1.syncDeviceReminders('cust_1', [reminder]); // orders changed: re-armed, not doubled
    const tab2 = await freshWebModule();
    await tab2.syncDeviceReminders('cust_1', [reminder]);

    vi.advanceTimersByTime(29 * 60_000);
    expect(shown).toHaveLength(0);
    vi.advanceTimersByTime(60_000);
    expect(shown).toEqual([{ title: reminder.title, tag: 'order-reminder:cust_1:2026-09-17' }]);

    // Reloading after 6 pm arms nothing for tonight, so nothing pops up again.
    const reloaded = await freshWebModule();
    await reloaded.syncDeviceReminders('cust_1', [reminder]);
    vi.advanceTimersByTime(60 * 60_000);
    expect(shown).toHaveLength(1);
  });

  it('stays quiet when the timer fires long after 6 pm (a laptop waking from sleep)', async () => {
    const { shown } = fakeBrowser();
    const web = await freshWebModule();
    await web.syncDeviceReminders('cust_1', [reminder]);
    // The clock jumps past the limit before the timer gets to run.
    vi.setSystemTime(new Date(sixPmIst.getTime() + web.WEB_REMINDER_LATE_LIMIT_MS + 60_000));
    vi.advanceTimersByTime(31 * 60_000);
    expect(shown).toHaveLength(0);
  });
});

describe('phone reminders: one scheduled per day', () => {
  let notificationsFake: Record<string, unknown>;
  const scheduled: { identifier: string; content: { data: Record<string, unknown> }; trigger: { date: Date } }[] = [];

  beforeEach(() => {
    scheduled.length = 0;
    vi.resetModules();
    vi.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    // The app loads the module through this wrapper, so Expo Go without notifications cannot break the app.
    vi.doMock('@/src/infrastructure/expoNotifications', () => ({ loadNotifications: () => notificationsFake }));
    notificationsFake = {
      setNotificationHandler: () => undefined,
      setNotificationChannelAsync: async () => undefined,
      setNotificationCategoryAsync: async () => undefined,
      AndroidImportance: { HIGH: 4 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
      getAllScheduledNotificationsAsync: async () => [...scheduled],
      cancelScheduledNotificationAsync: async (id: string) => {
        const i = scheduled.findIndex((s) => s.identifier === id);
        if (i >= 0) scheduled.splice(i, 1);
      },
      scheduleNotificationAsync: async (request: { content: { data: Record<string, unknown> }; trigger: { date: Date } }) => {
        // Let other work interleave, as the native bridge does.
        await new Promise((r) => setTimeout(r, 0));
        const identifier = `n${scheduled.length}_${Math.random()}`;
        scheduled.push({ identifier, content: request.content, trigger: request.trigger });
        return identifier;
      },
    };
  });
  afterEach(() => {
    vi.doUnmock('react-native');
    vi.doUnmock('@/src/infrastructure/expoNotifications');
  });

  it('never schedules a day twice, even when syncs overlap, and skips moments already past', async () => {
    const native = await import('@/src/infrastructure/deviceReminders.native');
    const future = (ymd: string, hoursAhead: number): DeviceReminder => ({
      ymd,
      at: new Date(Date.now() + hoursAhead * 3_600_000),
      title: ymd,
      body: '',
    });
    const list = [future('d1', 1), future('d2', 25), future('d1', 1), { ...future('d0', 0), at: new Date(Date.now() - 60_000) }];

    await Promise.all([native.syncDeviceReminders('cust_1', list), native.syncDeviceReminders('cust_1', list)]);
    expect(scheduled.map((s) => s.content.data.ymd).sort()).toEqual(['d1', 'd2']);

    await native.syncDeviceReminders(null, []);
    expect(scheduled).toHaveLength(0);
  });
});
