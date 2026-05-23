import type { CustomerResponse } from '@/src/domain/customers/dtos';

export type CustomerListStatusTone = 'active' | 'leave' | 'inactive';

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatCustomerMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return mobile.trim() || '—';
}

export function customerAddressLine(c: CustomerResponse): string {
  const society = (c.societyName ?? '').trim();
  const flat = (c.houseFlatNumber ?? '').trim();
  if (society && flat) return `${society}, ${flat}`;
  if (society) return society;
  const address = (c.address ?? '').trim();
  return address || '—';
}

export function customerListStatus(c: CustomerResponse): { label: string; tone: CustomerListStatusTone } {
  const paused =
    c.subscriptionStatus === 'Paused' || (c.subscriptionPlans ?? []).some((plan) => plan.status === 'Paused');

  if (c.status === 'Inactive') {
    return { label: 'INACTIVE', tone: 'inactive' };
  }
  if (paused) {
    return { label: 'ON LEAVE', tone: 'leave' };
  }
  return { label: 'ACTIVE', tone: 'active' };
}

export function customerStatusBadgeColors(tone: CustomerListStatusTone): { bg: string; fg: string } {
  switch (tone) {
    case 'leave':
      return { bg: 'rgba(53, 81, 161, 0.12)', fg: '#3551A1' };
    case 'inactive':
      return { bg: 'rgba(100, 116, 139, 0.14)', fg: '#64748B' };
    default:
      return { bg: 'rgba(34, 197, 94, 0.12)', fg: '#16A34A' };
  }
}
