import { RoleGuardLayout } from '@/src/components/auth/RoleGuardLayout';

export const unstable_settings = {
  // Deep links / web reloads on an inner screen keep the dashboard underneath so back works.
  initialRouteName: 'index',
};

export default function DeliveryLayout() {
  return <RoleGuardLayout role="delivery_boy" />;
}
