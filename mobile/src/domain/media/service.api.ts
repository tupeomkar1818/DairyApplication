import type { IMediaService } from '@/src/domain/media/service.interface';
import { apiBaseUrl, apiRequest } from '@/src/infrastructure/api/client';
import { readStoredSessionToken } from '@/src/infrastructure/auth/sessionRead';
import { strings } from '@/src/i18n/strings';

/**
 * Sending a picture to the dairy's server, which keeps it in one place every phone can read.
 *
 * The bytes go up as they are, with the type in the header — not as JSON, which would make a photo a third larger
 * on the way and twice as large in the Worker's memory.
 */
export class MediaServiceApi implements IMediaService {
  async upload(bytes: ArrayBuffer, contentType: string): Promise<{ url: string; key: string }> {
    const token = await readStoredSessionToken();
    let answer: Response;
    try {
      answer = await fetch(`${apiBaseUrl()}/media`, {
        method: 'POST',
        headers: { 'content-type': contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: bytes,
      });
    } catch {
      throw new Error(strings('common').errors.network);
    }

    const payload = (await answer.json().catch(() => null)) as
      | { url?: string; key?: string; error?: { message?: string } }
      | null;
    if (!answer.ok || !payload?.url) {
      throw new Error(payload?.error?.message ?? strings('common').errors.generic);
    }
    return { url: payload.url, key: String(payload.key ?? '') };
  }

  async delete(key: string): Promise<void> {
    await apiRequest<void>('DELETE', `/media/${key.split('/').map(encodeURIComponent).join('/')}`);
  }
}
