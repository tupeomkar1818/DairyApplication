import type { CustomerSubscriptionPlanHistoryMemoDto } from '@/src/domain/customers/dtos';
import { CustomerSubscriptionPlanHistoryMemoDtoSchema } from '@/src/domain/customers/validations';
import { CUSTOMER_SUBSCRIPTION_PLAN_HISTORY_MEMO_PREFIX } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

function storageKey(customerId: string): string {
  return `${CUSTOMER_SUBSCRIPTION_PLAN_HISTORY_MEMO_PREFIX}:${customerId}`;
}

function sanitizeMemos(raw: unknown): CustomerSubscriptionPlanHistoryMemoDto[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerSubscriptionPlanHistoryMemoDto[] = [];
  for (const row of raw) {
    const p = CustomerSubscriptionPlanHistoryMemoDtoSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function loadSubscriptionPlanHistoryMemos(customerId: string): Promise<CustomerSubscriptionPlanHistoryMemoDto[]> {
  const raw = await readJson<unknown>(storageKey(customerId));
  return sanitizeMemos(raw);
}

export async function saveSubscriptionPlanHistoryMemos(
  customerId: string,
  memos: CustomerSubscriptionPlanHistoryMemoDto[],
): Promise<void> {
  await writeJson(storageKey(customerId), memos);
}
