import { RoleGuardLayout } from '@/src/components/auth/RoleGuardLayout';
import { CustomerOfferNotifier } from '@/src/components/customer/CustomerOfferNotifier';
import { CustomerOrderReminderSync } from '@/src/components/customer/CustomerOrderReminderSync';

export const unstable_settings = {
  // Deep links / web reloads on an inner screen keep the dashboard underneath so back works.
  initialRouteName: 'index',
};

export default function CustomerLayout() {
  return (
    <RoleGuardLayout role="customer">
      {/* The 6 pm IST reminder of tomorrow's order, on this phone or browser. */}
      <CustomerOrderReminderSync />
      {/* One "New offer for you" notification per live offer. */}
      <CustomerOfferNotifier />
    </RoleGuardLayout>
  );
}
