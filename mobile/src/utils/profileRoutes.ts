import type { UserRole } from '@/src/domain/shared/enums';

/**
 * Each app has its own profile route. They must not share a name: route groups share URLs on the web, so three
 * `profile` screens would all be `/profile` and a reload would open whichever group matched first (the admin's,
 * whose guard sends everyone else to login).
 */
export function profileRouteForRole(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return '/(admin)/admin-profile';
    case 'customer':
      return '/(customer)/my-profile';
    case 'delivery_boy':
      return '/(delivery)/delivery-profile';
    default:
      return '/(auth)/login';
  }
}
