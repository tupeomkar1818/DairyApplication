import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, string>());
const logout = vi.hoisted(() => vi.fn(async () => undefined));
const clearReminders = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => memory.get(k) ?? null,
    setItem: async (k: string, v: string) => void memory.set(k, v),
    getAllKeys: async () => [...memory.keys()],
    multiRemove: async (keys: string[]) => keys.forEach((k) => memory.delete(k)),
  },
}));
vi.mock('@/src/infrastructure/service-registry', () => ({ services: { auth: { logout } } }));
vi.mock('@/src/infrastructure/deviceReminders', () => ({ syncDeviceReminders: clearReminders }));

async function freshModule() {
  vi.resetModules();
  return import('@/src/infrastructure/freshStart');
}

describe('runFreshStartOnce', () => {
  beforeEach(() => {
    memory.clear();
    logout.mockClear();
    clearReminders.mockClear();
  });

  it('clears every app key once, signs out and cancels phone reminders — then leaves new data alone', async () => {
    memory.set('DAIRY_CUSTOMERS_V1', '[{"name":"Rahul Patil"}]');
    memory.set('DAIRY_SESSION_V1:DAIRY_SESSION_ID_V1', 'session_1');
    memory.set('DAIRY_CUSTOMER_DAY_ORDER_V1:cust_1', '[]');
    memory.set('some-other-app-key', 'kept');

    const first = await freshModule();
    expect(await first.runFreshStartOnce()).toBe(true);
    expect([...memory.keys()].sort()).toEqual([first.DATA_EPOCH_KEY, 'some-other-app-key'].sort());
    expect(logout).toHaveBeenCalledTimes(1);
    expect(clearReminders).toHaveBeenCalledWith(null, []);

    // The dairy starts adding real data; the next app start must not wipe it.
    memory.set('DAIRY_CUSTOMERS_V1', '[{"name":"First real customer"}]');
    const next = await freshModule();
    expect(await next.runFreshStartOnce()).toBe(false);
    expect(memory.get('DAIRY_CUSTOMERS_V1')).toContain('First real customer');
  });
});
