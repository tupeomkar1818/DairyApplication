import type { Role } from '@/auth/service';

/**
 * Who counts as what, kept apart from the code that uses it.
 *
 * `service.ts` names the roles and `pin.ts` signs people in, and each needs the other at run time — so a constant
 * living in either one is read by the other before it exists. Here, nothing is imported but a type, which is gone
 * by the time the server runs.
 */

/**
 * Logins that are not a record of somebody the dairy keeps — the owner's and a manager's. Everybody else (desk,
 * customer, delivery boy) has a record, and their login is read off it.
 */
export const STANDALONE_ROLES: readonly Role[] = ['super_admin', 'admin'];

/**
 * Roles that a record's own housekeeping must never touch. Removing a customer takes their login with it; that
 * must never reach the owner's, whatever number it is on.
 */
export const STAFF_ROLES: readonly Role[] = ['super_admin', 'admin'];

/** For the `where` of a statement that tidies up after a record. */
export const NOT_STAFF = `role not in (${STAFF_ROLES.map((r) => `'${r}'`).join(', ')})`;

/**
 * Is this the dairy itself — the owner, or a manager?
 *
 * Several screens show one thing to the dairy and another to whoever else is asking. Written out as
 * `role === 'admin'` that reads fine until a tier is added above it, and then every one of those lines quietly
 * means "everybody except the owner". So it is asked here instead.
 */
export function isDairy(role: Role): boolean {
  return role === 'super_admin' || role === 'admin';
}

/**
 * The table a login belongs to, for a role that has a record.
 *
 * Written once because getting it wrong is silent: the login is made, nothing points at it, and the next sign-in
 * takes it for a leftover and clears it away — so the person can never keep a PIN.
 */
export function recordTableFor(role: Role): 'customers' | 'delivery_boys' | 'desk_users' | null {
  if (role === 'customer') return 'customers';
  if (role === 'delivery_boy') return 'delivery_boys';
  if (role === 'desk') return 'desk_users';
  return null;
}
