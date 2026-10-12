import type { CustomerResponse } from '@/src/domain/customers/dtos';
import { strings } from '@/src/i18n/strings';

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

  const labels = strings('customers').list.status;
  if (c.status === 'Inactive') {
    return { label: labels.inactive, tone: 'inactive' };
  }
  if (paused) {
    return { label: labels.onLeave, tone: 'leave' };
  }
  return { label: labels.active, tone: 'active' };
}

export function customerStatusBadgeColors(tone: CustomerListStatusTone): { bg: string; fg: string } {
  switch (tone) {
    case 'leave':
      return { bg: 'rgba(206, 212, 225, 0.55)', fg: '#3e454f' };
    case 'inactive':
      return { bg: 'rgba(195, 198, 214, 0.4)', fg: '#424653' };
    default:
      return { bg: 'rgba(37, 117, 252, 0.1)', fg: '#0055c7' };
  }
}
