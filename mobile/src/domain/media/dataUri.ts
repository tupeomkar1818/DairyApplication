/**
 * Reading a `data:` URI — what the web's picker hands back, and what older records hold.
 *
 * `atob` is there on the web and in Hermes, but not in every runtime the tests run in, so the decoding is written
 * out: four base64 characters are three bytes.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type DataUri = { contentType: string; bytes: Uint8Array };

/** The type and the bytes of a `data:` URI, or null when it is not one (or not base64). */
export function readDataUri(uri: string): DataUri | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(uri ?? ''));
  if (!match || !match[2]) return null;
  const contentType = (match[1] ?? 'application/octet-stream').trim().toLowerCase();
  const base64 = (match[3] ?? '').replace(/[\r\n\s]/g, '');

  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byte = 0;
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    const value = ALPHABET.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byte++] = (buffer >> bits) & 0xff;
    }
  }
  return { contentType, bytes: bytes.subarray(0, byte) };
}

/** The content type of a file by the end of its name, for a picture picked off a phone. */
export function contentTypeFromUri(uri: string): string {
  const extension = (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(uri ?? ''))?.[1] ?? '').toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
    case 'qt':
      return 'video/quicktime';
    default:
      return 'image/jpeg';
  }
}
