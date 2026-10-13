import { RoleGuardLayout } from '@/src/components/auth/RoleGuardLayout';

export const unstable_settings = {
  // Deep links / web reloads on an inner screen keep the counter underneath so back works.
  initialRouteName: 'index',
};

export default function DeskLayout() {
  return <RoleGuardLayout role="desk" />;
}
