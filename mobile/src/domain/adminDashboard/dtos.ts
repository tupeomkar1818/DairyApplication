import type { AdminDashboardSettings } from '@/src/domain/adminDashboard/entities';

export interface DashboardSettingsResponse {
  settings: AdminDashboardSettings;
}

export interface UpdateDashboardCoverRequest {
  uri: string;
  aspectRatio: number;
}

export interface UpdatePaymentSettingsRequest {
  upiId: string;
  payeeName: string;
  acceptCash: boolean;
  instructions?: string;
}

export interface UpdateDashboardCoverResponse {
  settings: AdminDashboardSettings;
}
