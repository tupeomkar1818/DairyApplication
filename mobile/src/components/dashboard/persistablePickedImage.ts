import type { ImagePickerAsset } from 'expo-image-picker';

import { strings } from '@/src/i18n/strings';

/** ~1.5 MB — data URIs are persisted to localStorage on web, whose total quota is only ~5 MB. */
export const MAX_PERSISTED_IMAGE_BYTES = 1.5 * 1024 * 1024;

export type PersistableImageResult = { ok: true; uri: string } | { ok: false; message: string };

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a URI that survives a page reload.
 * On web, expo-image-picker hands back a `blob:` URL that dies with the tab, so the picker must be
 * launched with `base64: true` and the image is stored as a `data:<mime>;base64,...` URI instead.
 * On native, the file URI is returned unchanged.
 */
export function persistableImageUriFromAsset(
  asset: Pick<ImagePickerAsset, 'uri' | 'base64' | 'mimeType'>,
  platformOS: string,
  maxBytes: number = MAX_PERSISTED_IMAGE_BYTES,
): PersistableImageResult {
  if (platformOS !== 'web') {
    if (!asset.uri) return { ok: false, message: strings('admin').cover.couldNotRead };
    return { ok: true, uri: asset.uri };
  }

  const base64 = asset.base64 ?? '';
  if (!base64) {
    if (asset.uri?.startsWith('data:')) return { ok: true, uri: asset.uri };
    return { ok: false, message: strings('admin').cover.couldNotReadTryAnother };
  }

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > maxBytes) {
    return {
      ok: false,
      message: strings('admin').cover.tooLarge(formatMb(approxBytes), formatMb(maxBytes)),
    };
  }

  const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  return { ok: true, uri: `data:${mime};base64,${base64}` };
}
