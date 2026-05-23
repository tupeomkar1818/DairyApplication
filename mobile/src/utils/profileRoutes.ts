import type { UserRole } from '@/src/domain/shared/enums';

export function profileRouteForRole(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return '/(admin)/profile';
    case 'customer':
      return '/(customer)/profile';
    case 'delivery_boy':
      return '/(delivery)/profile';
    default:
      return '/(auth)/login';
  }
}
