import type {
  DashboardSettingsResponse,
  UpdateDashboardCoverRequest,
  UpdateDashboardCoverResponse,
  UpdatePaymentSettingsRequest,
} from '@/src/domain/adminDashboard/dtos';

export interface IAdminDashboardService {
  /** GET /api/admin/dashboard/settings */
  getSettings(): Promise<DashboardSettingsResponse>;

  /** PUT /api/admin/dashboard/cover */
  updateCover(data: UpdateDashboardCoverRequest): Promise<UpdateDashboardCoverResponse>;

  /** PUT /api/admin/dashboard/payment */
  updatePaymentSettings(data: UpdatePaymentSettingsRequest): Promise<DashboardSettingsResponse>;
}
