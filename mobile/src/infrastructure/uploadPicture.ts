import { File } from 'expo-file-system';

import { contentTypeFromUri, readDataUri } from '@/src/domain/media/dataUri';
import { services } from '@/src/infrastructure/service-registry';

/**
 * A picked picture, ready to put on a record.
 *
 * With the dairy's server it goes up once and the record keeps its address, so every phone — and the dairy's own
 * screens — see the same picture. On a phone keeping its own records there is nowhere to send it, so the address
 * the picker gave is kept as it is, which is how the app has always worked.
 */
export async function uploadPicture(uri: string): Promise<string> {
  const media = services.media;
  if (!media || !uri || /^https?:\/\//i.test(uri)) return uri;

  const inline = readDataUri(uri);
  if (inline) {
    const { url } = await media.upload(inline.bytes.buffer as ArrayBuffer, inline.contentType);
    return url;
  }

  // A file on the phone: `File` is a Blob, so its bytes come straight out.
  const file = new File(uri);
  const bytes = await file.arrayBuffer();
  const { url } = await media.upload(bytes, file.type || contentTypeFromUri(uri));
  return url;
}
