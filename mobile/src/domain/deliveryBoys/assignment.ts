import type { CustomerResponse } from '@/src/domain/customers/dtos';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';

/** The label a customer carries when no delivery partner is assigned (kept in step with `accountLinks`). */
const UNASSIGNED = 'unassigned';

/** True when this customer is served by this delivery boy. */
export function customerBelongsToBoy(
  c: Pick<CustomerResponse, 'assignedDeliveryBoyId' | 'assignedDeliveryBoyName' | 'routeName'>,
  boy: Pick<DeliveryBoyResponse, 'id' | 'fullName' | 'primaryRouteName'> | null,
): boolean {
  if (!boy) return false;
  const assignedId = String(c.assignedDeliveryBoyId ?? '').trim();
  if (assignedId) return assignedId === boy.id;
  // Older records carry only the name or the route; fall back to those so nobody's stops silently disappear.
  // "Unassigned" is the label for no partner, not a partner's name.
  const assignedName = String(c.assignedDeliveryBoyName ?? '').trim().toLowerCase();
  if (assignedName && assignedName !== UNASSIGNED) return assignedName === (boy.fullName ?? '').trim().toLowerCase();
  const route = String(c.routeName ?? '').trim().toLowerCase();
  return route.length > 0 && route === (boy.primaryRouteName ?? '').trim().toLowerCase();
}
