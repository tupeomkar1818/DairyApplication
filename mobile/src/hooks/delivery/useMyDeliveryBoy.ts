import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useMyLinkedRecordId } from '@/src/hooks/auth/useMyLinkedRecordId';
import { useCustomers } from '@/src/hooks/customers';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { customerBelongsToBoy } from '@/src/domain/deliveryBoys/assignment';
import type { DeliveryBoyResponse } from '@/src/domain/deliveryBoys/dtos';
import { services } from '@/src/infrastructure/service-registry';

/**
 * Who is signed in to the delivery app, and which customers are theirs.
 *
 * Every delivery-app screen must scope through here: the session only carries a mobile number, and reading the
 * unfiltered customer list would show one delivery boy another's stops (and let them mark those delivered).
 *
 * With the dairy's server, their own record comes from the server ("my record") — the team list it hands a
 * delivery boy leaves out a colleague's personal details, so it is not their own record in full.
 */

type MineService = { getMine?: () => Promise<DeliveryBoyResponse | null> };

/** True when the dairy's server is answering, which is the only place "my record" exists. */
function hasMyRecordEndpoint(): boolean {
  return typeof (services.deliveryBoys as MineService).getMine === 'function';
}

export function useMyDeliveryBoy(): {
  boy: DeliveryBoyResponse | null;
  /** The whole team — salary needs it to price days spent covering somebody else's route. */
  allBoys: DeliveryBoyResponse[];
  /** Name stamped on delivery rows; falls back to the mobile so a row is always attributable. */
  actorName: string | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const session = useAuthSession();
  const deliveryBoys = useDeliveryBoys();
  const mine = useQuery({
    queryKey: ['deliveryBoys', 'mine'],
    queryFn: () => (services.deliveryBoys as MineService).getMine!(),
    enabled: hasMyRecordEndpoint() && session.data?.role === 'delivery_boy',
    staleTime: 30_000,
  });

  const mobile = session.data?.mobileNumber?.trim();
  const linked = useMyLinkedRecordId(session.data?.role === 'delivery_boy' ? session.data.userId : undefined);
  const boy = useMemo(() => {
    // Their own record in full, straight from the server, when there is one to ask.
    if (mine.data) return mine.data;
    const items = deliveryBoys.data?.items ?? [];
    // The record this login was made from; the number is only the fallback (it can change under a session).
    const byLink = linked.recordId ? items.find((b) => b.id === linked.recordId) : undefined;
    if (byLink) return byLink;
    if (!mobile) return null;
    return items.find((b) => (b.mobileNumber ?? '').trim() === mobile) ?? null;
  }, [deliveryBoys.data?.items, linked.recordId, mine.data, mobile]);

  const actorName = boy?.fullName?.trim() || (mobile ? `Delivery app (${mobile})` : undefined);

  return {
    boy,
    allBoys: deliveryBoys.data?.items ?? [],
    actorName,
    isLoading: session.isLoading || deliveryBoys.isLoading || linked.isLoading,
    isError: deliveryBoys.isError,
    refetch: () => void deliveryBoys.refetch(),
  };
}

/** The assignment rule lives in the domain so reports can use it too; re-exported for existing imports. */
export { customerBelongsToBoy };

export function useMyCustomers(): {
  boy: DeliveryBoyResponse | null;
  customers: CustomerResponse[];
  actorName: string | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { boy, actorName, isLoading: boyLoading, isError: boyError } = useMyDeliveryBoy();
  const customers = useCustomers();

  const mine = useMemo(
    () => (customers.data?.items ?? []).filter((c) => customerBelongsToBoy(c, boy)),
    [customers.data?.items, boy],
  );

  return {
    boy,
    customers: mine,
    actorName,
    isLoading: boyLoading || customers.isLoading,
    isError: boyError || customers.isError,
    refetch: () => void customers.refetch(),
  };
}
