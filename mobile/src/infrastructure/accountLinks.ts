import type { User } from '@/src/domain/auth/entities';
import type { Customer } from '@/src/domain/customers/entities';
import type { DeliveryBoy } from '@/src/domain/deliveryBoys/entities';
import { DomainError } from '@/src/domain/shared/errors';
import { strings } from '@/src/i18n/strings';
import { CUSTOMERS_STORE_KEY, DELIVERY_BOYS_STORE_KEY, USERS_STORE_KEY } from '@/src/infrastructure/storage/keys';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';

/**
 * What ties the three apps together: one mobile number is one person (a customer, a delivery partner, or the admin),
 * a login follows the record it was made from, and a customer's delivery partner is kept in step with the partner's
 * own record. The customers and delivery-partner services call these on every change, so the admin, delivery and
 * customer apps always read the same account of who is who.
 */

/** The dairy's admin login. Everyone else signs in with the number on the record the admin created for them. */
export const ADMIN_MOBILE_NUMBER = '8208682688';

/** The label a customer carries when no delivery partner is assigned. */
export const UNASSIGNED_DELIVERY_BOY = 'Unassigned';

function clean(mobile: unknown): string {
  return String(mobile ?? '').trim();
}

/**
 * Refuses a mobile number that already belongs to someone else — another customer, a delivery partner or the admin.
 * The login decides who you are from your number, so a number shared by two records would open the wrong app.
 */
export async function assertMobileFree(
  mobile: string,
  except: { customerId?: string; deliveryBoyId?: string } = {},
): Promise<void> {
  const m = clean(mobile);
  if (!m) return;
  if (m === ADMIN_MOBILE_NUMBER) {
    throw new DomainError('MOBILE_IN_USE', strings('auth').accountLinks.adminNumber);
  }
  const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
  const customer = customers.find((c) => c.id !== except.customerId && clean(c.mobile) === m);
  if (customer) {
    throw new DomainError('MOBILE_IN_USE', strings('auth').accountLinks.belongsToCustomer(customer.name));
  }
  const boys = (await readJson<DeliveryBoy[]>(DELIVERY_BOYS_STORE_KEY)) ?? [];
  const boy = boys.find((b) => b.id !== except.deliveryBoyId && clean(b.mobileNumber) === m);
  if (boy) {
    throw new DomainError('MOBILE_IN_USE', strings('auth').accountLinks.belongsToDeliveryBoy(boy.fullName));
  }
}

/** The record's login moves with its number, so the person keeps their account (and the old number frees up). */
export async function moveLoginToMobile(recordId: string, mobile: string): Promise<void> {
  const users = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
  const m = clean(mobile);
  let changed = false;
  const next = users.map((u) => {
    if (u.linkedRecordId !== recordId || u.mobileNumber === m) return u;
    changed = true;
    return { ...u, mobileNumber: m, updatedAt: new Date().toISOString() };
  });
  if (changed) await writeJson(USERS_STORE_KEY, next);
}

/** A deleted customer or delivery partner can no longer sign in. */
export async function removeLoginFor(recordId: string): Promise<void> {
  const users = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
  const next = users.filter((u) => u.linkedRecordId !== recordId);
  if (next.length !== users.length) await writeJson(USERS_STORE_KEY, next);
}

/**
 * Keeps customers in step with their delivery partner: a renamed partner's customers show the new name, and a deleted
 * partner's customers become unassigned (so their stops don't silently vanish from every run sheet).
 */
export async function syncCustomersWithDeliveryBoy(
  change: { id: string; fullName: string } | { id: string; deleted: true },
): Promise<void> {
  const customers = (await readJson<Customer[]>(CUSTOMERS_STORE_KEY)) ?? [];
  const now = new Date().toISOString();
  let changed = false;
  const next = customers.map((c) => {
    if (c.assignedDeliveryBoyId !== change.id) return c;
    if ('deleted' in change) {
      changed = true;
      return { ...c, assignedDeliveryBoyId: undefined, assignedDeliveryBoyName: UNASSIGNED_DELIVERY_BOY, updatedAt: now };
    }
    const name = change.fullName.trim();
    if (!name || c.assignedDeliveryBoyName === name) return c;
    changed = true;
    return { ...c, assignedDeliveryBoyName: name, updatedAt: now };
  });
  if (changed) await writeJson(CUSTOMERS_STORE_KEY, next);
}

/** The record a signed-in user's login was made from (customer or delivery partner id), if any. */
export async function linkedRecordIdForUser(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const users = (await readJson<User[]>(USERS_STORE_KEY)) ?? [];
  return users.find((u) => u.id === userId)?.linkedRecordId ?? null;
}
