import { readDataUri } from '@/src/domain/media/dataUri';
import { services } from '@/src/infrastructure/service-registry';

/**
 * The same as `uploadPicture.ts`, for the web build: there the picker hands back a `data:` URI (or a `blob:` one),
 * which the browser can read itself.
 */
export async function uploadPicture(uri: string): Promise<string> {
  const media = services.media;
  if (!media || !uri || /^https?:\/\//i.test(uri)) return uri;

  const inline = readDataUri(uri);
  if (inline) {
    const { url } = await media.upload(inline.bytes.buffer as ArrayBuffer, inline.contentType);
    return url;
  }

  const blob = await (await fetch(uri)).blob();
  const { url } = await media.upload(await blob.arrayBuffer(), blob.type || 'image/jpeg');
  return url;
}
