import type { IPushService } from '@/src/domain/push/service.interface';
import { api } from '@/src/infrastructure/api/client';

/** Telling the dairy's server which phone belongs to the signed-in person, and in which language to write to it. */
export class PushServiceApi implements IPushService {
  async register(input: { token: string; platform: string; language: string }): Promise<void> {
    await api.post<unknown>('/push/tokens', input);
  }

  async forget(token: string): Promise<void> {
    await api.delete<void>(`/push/tokens/${encodeURIComponent(token)}`);
  }
}
