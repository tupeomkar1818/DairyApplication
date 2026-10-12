import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { persistableImageUriFromAsset } from '@/src/components/dashboard/persistablePickedImage';
import type { AnnouncementMedia } from '@/src/domain/announcements/entities';
import { strings } from '@/src/i18n/strings';

/**
 * On the web everything is kept in browser storage, which holds only a few megabytes in total — so uploads are capped.
 * A longer video should be shared as a link (YouTube or an .mp4 address) instead.
 */
export const MAX_ANNOUNCEMENT_IMAGE_BYTES = 1024 * 1024;
export const MAX_ANNOUNCEMENT_VIDEO_BYTES = 1.5 * 1024 * 1024;

export type PickedMedia = { ok: true; media: AnnouncementMedia } | { ok: false; message: string } | { ok: false; cancelled: true };

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(blob);
  });
}

export async function pickAnnouncementMedia(kind: 'image' | 'video'): Promise<PickedMedia> {
  const isWeb = Platform.OS === 'web';
  if (!isWeb) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, message: strings('inbox').announcements.media.allowLibrary };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: [kind === 'image' ? 'images' : 'videos'],
    allowsEditing: false,
    quality: isWeb ? 0.6 : 0.85,
    base64: isWeb && kind === 'image',
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { ok: false, cancelled: true };

  if (kind === 'image') {
    const picked = persistableImageUriFromAsset(asset, Platform.OS, MAX_ANNOUNCEMENT_IMAGE_BYTES);
    return picked.ok ? { ok: true, media: { kind: 'image', uri: picked.uri } } : { ok: false, message: picked.message };
  }

  if (!isWeb) return { ok: true, media: { kind: 'video', uri: asset.uri } };

  // Web: the picker hands back a blob: URL that dies on reload; keep the file itself, if it is small enough.
  try {
    const blob = await (await fetch(asset.uri)).blob();
    if (blob.size > MAX_ANNOUNCEMENT_VIDEO_BYTES) {
      return {
        ok: false,
        message: strings('inbox').announcements.media.videoTooBig(mb(blob.size), mb(MAX_ANNOUNCEMENT_VIDEO_BYTES)),
      };
    }
    return { ok: true, media: { kind: 'video', uri: asset.uri.startsWith('data:') ? asset.uri : await blobToDataUri(blob) } };
  } catch {
    return { ok: false, message: strings('inbox').announcements.media.videoUnreadable };
  }
}
