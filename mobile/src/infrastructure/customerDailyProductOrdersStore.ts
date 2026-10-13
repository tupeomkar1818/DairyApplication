import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CustomerDailyProductOrderLineDto } from '@/src/domain/customers/dtos';
import { CustomerDailyProductOrderLineDtoSchema } from '@/src/domain/customers/validations';
import { CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

function storageKey(customerId: string): string {
  return `${CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX}:${customerId}`;
}

function sanitizeLines(raw: unknown): CustomerDailyProductOrderLineDto[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerDailyProductOrderLineDto[] = [];
  for (const row of raw) {
    const p = CustomerDailyProductOrderLineDtoSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function loadDailyProductOrderLines(customerId: string): Promise<CustomerDailyProductOrderLineDto[]> {
  const raw = await readJson<unknown>(storageKey(customerId));
  return sanitizeLines(raw);
}

/** True while any of the old day-order rows are still on this phone. */
export async function hasLegacyDayOrderRows(): Promise<boolean> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.some((k) => k.startsWith(`${CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX}:`));
  } catch {
    // A phone that will not list its keys is not worth guessing about: let the migration look properly.
    return true;
  }
}

/** Takes a customer's old rows off the phone for good, so nothing is left to find. */
export async function clearDailyProductOrderLines(customerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(customerId));
  } catch {
    // It will be read as empty and skipped either way.
  }
}

export async function saveDailyProductOrderLines(
  customerId: string,
  lines: CustomerDailyProductOrderLineDto[],
): Promise<void> {
  await writeJson(storageKey(customerId), lines);
}

const updateQueues = new Map<string, Promise<unknown>>();

/**
 * Serialized read-modify-write for one customer's lines. Each update reads the latest stored rows (not a render-time
 * snapshot), so overlapping calls — or a call made before the query has loaded — never drop each other's writes.
 */
export function updateDailyProductOrderLines(
  customerId: string,
  updater: (current: CustomerDailyProductOrderLineDto[]) => CustomerDailyProductOrderLineDto[],
): Promise<CustomerDailyProductOrderLineDto[]> {
  const previous = updateQueues.get(customerId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadDailyProductOrderLines(customerId));
      await saveDailyProductOrderLines(customerId, next);
      return next;
    });
  updateQueues.set(customerId, run);
  const release = () => {
    if (updateQueues.get(customerId) === run) updateQueues.delete(customerId);
  };
  run.then(release, release);
  return run;
}
