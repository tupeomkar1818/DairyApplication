import type { AdminDashboardSettings } from '@/src/domain/adminDashboard/entities';

export interface DashboardSettingsResponse {
  settings: AdminDashboardSettings;
}

export interface UpdateDashboardCoverRequest {
  uri: string;
  aspectRatio: number;
}

export interface UpdateDashboardCoverResponse {
  settings: AdminDashboardSettings;
}
