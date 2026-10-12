import { useMemo } from 'react';

import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { useAuthSession } from '@/src/hooks/auth/useAuth';
import { useMyLinkedRecordId } from '@/src/hooks/auth/useMyLinkedRecordId';
import { hasMyCustomerEndpoint, useMyCustomerRecord } from '@/src/hooks/customer/useMyCustomerRecord';
import { useCustomers, useUpdateCustomer } from '@/src/hooks/customers';

/**
 * Who is signed in to the customer app, and their own record.
 *
 * Every customer screen must go through here: the session carries only a mobile number, and reading the unfiltered
 * customer list would let one household see — and change — another's subscription, orders and bills.
 *
 * With the dairy's server, the server itself hands over only this customer's record ("my record"); on a phone
 * keeping its own records, it is found in the list by the login it was made from.
 */
export function useMyCustomer(): {
  customer: CustomerResponse | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** Saves a patch on the signed-in customer's own record. */
  save: (data: Parameters<ReturnType<typeof useUpdateCustomer>['mutateAsync']>[0]['data']) => Promise<void>;
  isSaving: boolean;
} {
  const session = useAuthSession();
  const signedInCustomer = session.data?.role === 'customer';
  const fromServer = useMyCustomerRecord(signedInCustomer);
  // The list is only read where there is no server to ask; the server refuses it to a customer anyway.
  const customers = useCustomers({ enabled: !hasMyCustomerEndpoint() });
  const update = useUpdateCustomer();

  const mobile = session.data?.mobileNumber?.trim();
  const linked = useMyLinkedRecordId(session.data?.role === 'customer' ? session.data.userId : undefined);
  const customer = useMemo(() => {
    const items = customers.data?.items ?? [];
    // The record this login was made from; the number is only the fallback (it can change under a session).
    const byLink = linked.recordId ? items.find((c) => c.id === linked.recordId) : undefined;
    if (byLink) return byLink;
    if (!mobile) return null;
    return items.find((c) => (c.mobile ?? '').trim() === mobile) ?? null;
  }, [customers.data?.items, linked.recordId, mobile]);

  if (hasMyCustomerEndpoint()) {
    return { ...fromServer, isLoading: session.isLoading || fromServer.isLoading };
  }

  return {
    customer,
    isLoading: session.isLoading || customers.isLoading || linked.isLoading,
    isError: customers.isError,
    refetch: () => void customers.refetch(),
    save: async (data) => {
      if (!customer) return;
      await update.mutateAsync({ id: customer.id, data });
    },
    isSaving: update.isPending,
  };
}
