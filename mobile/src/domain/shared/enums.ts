/**
 * Who somebody is to the dairy. `super_admin` is the dairy's own login and owns everything; `admin` runs the
 * day without being able to re-price the milk, change where money goes, or take staff on; `desk` sells over
 * the counter and nothing else.
 */
export type UserRole = 'super_admin' | 'admin' | 'desk' | 'customer' | 'delivery_boy';

/**
 * Is this the dairy itself — the owner, or a manager?
 *
 * Screens that show one thing to the dairy and another to everybody else ask this, rather than comparing with
 * 'admin'. Spelled out, each of those comparisons would quietly mean "everybody except the owner".
 */
export function isDairy(role: UserRole | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

/** The owner alone: prices, the dairy’s payment details, and who works here. */
export function isOwner(role: UserRole | undefined): boolean {
  return role === 'super_admin';
}

