import { useMemo } from 'react';

import { todayYmd } from '@/src/components/admin/dashboardMetrics';
import type { ReportData } from '@/src/domain/reports/data';
import type { ReportFilterValues } from '@/src/domain/reports/model';
import { useMyCustomer } from '@/src/hooks/customer/useMyCustomer';
import { useCustomers } from '@/src/hooks/customers';
import { useMyCustomers } from '@/src/hooks/delivery/useMyDeliveryBoy';
import { useDeliveryBoys } from '@/src/hooks/deliveryBoys';
import { useNotificationLog } from '@/src/hooks/notifications/useNotifications';
import { useOffers } from '@/src/hooks/offers/useOffers';
import { useProducts } from '@/src/hooks/products';
import { useStrings } from '@/src/i18n/useStrings';

/**
 * The records each app's reports may read. The admin reads everything; a delivery boy only his own customers and his
 * own record (the team list stays in, because salary prices a day covering a colleague at that colleague's rate);
 * a customer only their own household. `fixedFilters` pin the report to that person, whatever the screen's filters say.
 */

export type ReportDataState = {
  data: ReportData | null;
  fixedFilters: ReportFilterValues;
  isLoading: boolean;
  isError: boolean;
  /** Why there is nothing to show (e.g. the signed-in account has no record yet). */
  unavailableMessage?: string;
};

const NO_NOTIFICATIONS: ReportData['notifications'] = [];

function useToday(): { today: string; nowIso: string } {
  // Read once per screen: a report should not shift under the reader when midnight passes.
  return useMemo(() => {
    const now = new Date();
    return { today: todayYmd(now), nowIso: now.toISOString() };
  }, []);
}

export function useAdminReportData(): ReportDataState {
  const customers = useCustomers();
  const boys = useDeliveryBoys();
  const products = useProducts();
  const notifications = useNotificationLog();
  const offers = useOffers();
  const { today, nowIso } = useToday();

  const data = useMemo<ReportData | null>(() => {
    if (!customers.data || !boys.data || !products.data) return null;
    return {
      customers: customers.data.items,
      boys: boys.data.items,
      products: products.data.items,
      notifications: notifications.items,
      offers: offers.all,
      today,
      nowIso,
    };
  }, [customers.data, boys.data, products.data, notifications.items, offers.all, today, nowIso]);

  return {
    data,
    fixedFilters: {},
    isLoading: customers.isLoading || boys.isLoading || products.isLoading || offers.isLoading,
    isError: (customers.isError && !customers.data) || (boys.isError && !boys.data) || (products.isError && !products.data),
  };
}

export function useDeliveryReportData(): ReportDataState {
  const t = useStrings('reports');
  const mine = useMyCustomers();
  const boys = useDeliveryBoys();
  const products = useProducts();
  const offers = useOffers();
  const { today, nowIso } = useToday();
  const boy = mine.boy;

  const data = useMemo<ReportData | null>(() => {
    if (!boy || !boys.data || !products.data) return null;
    return {
      customers: mine.customers,
      boys: boys.data.items,
      products: products.data.items,
      notifications: NO_NOTIFICATIONS,
      offers: offers.all,
      today,
      nowIso,
    };
  }, [boy, mine.customers, boys.data, products.data, offers.all, today, nowIso]);
  const fixedFilters = useMemo<ReportFilterValues>(() => (boy ? { boy: boy.id } : ({} as ReportFilterValues)), [boy]);

  return {
    data,
    fixedFilters,
    isLoading: mine.isLoading || boys.isLoading || products.isLoading || offers.isLoading,
    isError: mine.isError || (products.isError && !products.data),
    unavailableMessage: !mine.isLoading && !boy ? t.data.deliveryProfileMissing : undefined,
  };
}

export function useCustomerReportData(): ReportDataState {
  const t = useStrings('reports');
  const me = useMyCustomer();
  const products = useProducts();
  const offers = useOffers();
  const { today, nowIso } = useToday();
  const customer = me.customer;

  const data = useMemo<ReportData | null>(() => {
    if (!customer || !products.data) return null;
    return { customers: [customer], boys: [], products: products.data.items, notifications: NO_NOTIFICATIONS, offers: offers.all, today, nowIso };
  }, [customer, products.data, offers.all, today, nowIso]);
  const fixedFilters = useMemo<ReportFilterValues>(() => (customer ? { customer: customer.id } : ({} as ReportFilterValues)), [customer]);

  return {
    data,
    fixedFilters,
    isLoading: me.isLoading || products.isLoading || offers.isLoading,
    isError: me.isError || (products.isError && !products.data),
    unavailableMessage: !me.isLoading && !customer ? t.data.customerProfileMissing : undefined,
  };
}
