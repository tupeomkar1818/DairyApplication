import type {
  DashboardSettingsResponse,
  UpdateDashboardCoverRequest,
  UpdateDashboardCoverResponse,
  UpdatePaymentSettingsRequest,
} from '@/src/domain/adminDashboard/dtos';
import type { AdminDashboardSettings, DairyPaymentSettings, DashboardCoverImage } from '@/src/domain/adminDashboard/entities';
import type { IAdminDashboardService } from '@/src/domain/adminDashboard/service.interface';
import { api } from '@/src/infrastructure/api/client';

/**
 * The dairy's own settings, from the dairy's server: the cover picture every app shows, and how customers pay.
 *
 * These are the two things that have to be the same on every phone — the dairy sets its UPI id once, and every
 * customer can pay. Until the dairy has saved them the server holds nothing, and the app shows what it always
 * showed: the bundled cover, and no payment options.
 */

/** The picture the apps ship with, shown until the dairy picks one of its own. */
const BUNDLED_COVER: DashboardCoverImage = {
  id: 'cover_bundled',
  sourceType: 'bundled',
  uri: 'asset:admin-dashboard-cover',
  aspectRatio: 2.4,
  createdAt: '',
  updatedAt: '',
};

type ServerSettings = {
  cover: (Partial<DashboardCoverImage> & { uri?: string; aspectRatio?: number }) | null;
  payment: (Partial<DairyPaymentSettings> & { upiId?: string }) | null;
};

function settingsFrom(answer: ServerSettings): AdminDashboardSettings {
  const cover: DashboardCoverImage = answer.cover?.uri
    ? {
        id: String(answer.cover.id ?? 'cover_dairy'),
        // Anything the dairy picked is an address of its own; only the shipped one is bundled.
        sourceType: 'uri',
        uri: String(answer.cover.uri),
        aspectRatio: Number(answer.cover.aspectRatio) || BUNDLED_COVER.aspectRatio,
        createdAt: String(answer.cover.createdAt ?? ''),
        updatedAt: String(answer.cover.updatedAt ?? ''),
      }
    : BUNDLED_COVER;

  const payment: DairyPaymentSettings | undefined = answer.payment
    ? {
        upiId: String(answer.payment.upiId ?? ''),
        payeeName: String(answer.payment.payeeName ?? ''),
        acceptCash: answer.payment.acceptCash !== false,
        ...(answer.payment.instructions ? { instructions: String(answer.payment.instructions) } : {}),
        updatedAt: String(answer.payment.updatedAt ?? ''),
      }
    : undefined;

  return {
    id: 'dashboard_dairy',
    cover,
    ...(payment ? { payment } : {}),
    createdAt: cover.createdAt,
    updatedAt: payment?.updatedAt && payment.updatedAt > cover.updatedAt ? payment.updatedAt : cover.updatedAt,
  };
}

export class AdminDashboardServiceApi implements IAdminDashboardService {
  async getSettings(): Promise<DashboardSettingsResponse> {
    return { settings: settingsFrom(await api.get<ServerSettings>('/settings')) };
  }

  async updateCover(data: UpdateDashboardCoverRequest): Promise<UpdateDashboardCoverResponse> {
    await api.put<unknown>('/settings/cover', { uri: data.uri, aspectRatio: data.aspectRatio });
    return this.getSettings();
  }

  async updatePaymentSettings(data: UpdatePaymentSettingsRequest): Promise<DashboardSettingsResponse> {
    await api.put<unknown>('/settings/payment', {
      upiId: data.upiId,
      payeeName: data.payeeName,
      acceptCash: data.acceptCash,
      ...(data.instructions ? { instructions: data.instructions } : {}),
    });
    return this.getSettings();
  }
}
