import type { IAdminDashboardService } from '@/src/domain/adminDashboard/service.interface';
import type {
  DashboardSettingsResponse,
  UpdateDashboardCoverRequest,
  UpdateDashboardCoverResponse,
  UpdatePaymentSettingsRequest,
} from '@/src/domain/adminDashboard/dtos';
import type { AdminDashboardSettings } from '@/src/domain/adminDashboard/entities';
import { readJson, writeJson } from '@/src/infrastructure/storage/storage';
import { ADMIN_DASHBOARD_SETTINGS_STORE_KEY } from '@/src/infrastructure/storage/keys';

/** Default cover aspect ratio (wide banner) */
const DEFAULT_ASPECT_RATIO = 2.4;

const DEFAULT_COVER_URI = 'asset:admin-dashboard-cover';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function buildDefaultSettings(): AdminDashboardSettings {
  const now = nowIso();
  return {
    id: newId('dashboard'),
    cover: {
      id: newId('cover'),
      sourceType: 'bundled',
      uri: DEFAULT_COVER_URI,
      aspectRatio: DEFAULT_ASPECT_RATIO,
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureSettings(): Promise<AdminDashboardSettings> {
  const existing = await readJson<AdminDashboardSettings>(ADMIN_DASHBOARD_SETTINGS_STORE_KEY);
  if (existing?.cover?.aspectRatio) return existing;

  const seeded = buildDefaultSettings();
  await writeJson(ADMIN_DASHBOARD_SETTINGS_STORE_KEY, seeded);
  return seeded;
}

export class AdminDashboardServiceMock implements IAdminDashboardService {
  async getSettings(): Promise<DashboardSettingsResponse> {
    const settings = await ensureSettings();
    return { settings };
  }

  async updateCover(data: UpdateDashboardCoverRequest): Promise<UpdateDashboardCoverResponse> {
    const current = await ensureSettings();
    const now = nowIso();
    const settings: AdminDashboardSettings = {
      ...current,
      cover: {
        ...current.cover,
        sourceType: 'uri',
        uri: data.uri,
        aspectRatio: data.aspectRatio,
        updatedAt: now,
      },
      updatedAt: now,
    };
    await writeJson(ADMIN_DASHBOARD_SETTINGS_STORE_KEY, settings);
    return { settings };
  }

  async updatePaymentSettings(data: UpdatePaymentSettingsRequest): Promise<DashboardSettingsResponse> {
    const current = await ensureSettings();
    const now = nowIso();
    const instructions = data.instructions?.trim();
    const settings: AdminDashboardSettings = {
      ...current,
      payment: {
        upiId: data.upiId.trim(),
        payeeName: data.payeeName.trim(),
        acceptCash: data.acceptCash,
        ...(instructions ? { instructions } : {}),
        updatedAt: now,
      },
      updatedAt: now,
    };
    await writeJson(ADMIN_DASHBOARD_SETTINGS_STORE_KEY, settings);
    return { settings };
  }
}
