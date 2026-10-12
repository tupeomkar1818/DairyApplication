import type { CustomerSubscriptionCalendarEntryDto } from '@/src/domain/customers/dtos';
import { CustomerSubscriptionCalendarEntryDtoSchema } from '@/src/domain/customers/validations';
import { CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

function storageKey(customerId: string): string {
  return `${CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX}:${customerId}`;
}

function sanitizeEntries(raw: unknown): CustomerSubscriptionCalendarEntryDto[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerSubscriptionCalendarEntryDto[] = [];
  for (const row of raw) {
    const p = CustomerSubscriptionCalendarEntryDtoSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function loadCalendarEntries(customerId: string): Promise<CustomerSubscriptionCalendarEntryDto[]> {
  const raw = await readJson<unknown>(storageKey(customerId));
  return sanitizeEntries(raw);
}

export async function saveCalendarEntries(
  customerId: string,
  entries: CustomerSubscriptionCalendarEntryDto[],
): Promise<void> {
  await writeJson(storageKey(customerId), entries);
}

const updateQueues = new Map<string, Promise<unknown>>();

/**
 * Serialized read-modify-write for one customer's calendar entries: each update reads the latest stored rows, so
 * overlapping calls — or a call made before the query has loaded — never drop each other's writes.
 */
export function updateCalendarEntries(
  customerId: string,
  updater: (current: CustomerSubscriptionCalendarEntryDto[]) => CustomerSubscriptionCalendarEntryDto[],
): Promise<CustomerSubscriptionCalendarEntryDto[]> {
  const previous = updateQueues.get(customerId) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(async () => {
      const next = updater(await loadCalendarEntries(customerId));
      await saveCalendarEntries(customerId, next);
      return next;
    });
  updateQueues.set(customerId, run);
  const release = () => {
    if (updateQueues.get(customerId) === run) updateQueues.delete(customerId);
  };
  run.then(release, release);
  return run;
}
