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
