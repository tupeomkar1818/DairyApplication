/**
 * Bytes as base64.
 *
 * The printer takes a base64 string, and React Native has no `btoa` and no `Buffer`. A bill is a few hundred
 * bytes, so this is as simple as it looks — and it is exact, which matters: one wrong byte in an ESC/POS stream
 * and the printer either prints nonsense or sits there waiting for the rest of a command.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];

    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 0x03) << 4) | ((b ?? 0) >> 4)];
    // A group short of a byte is padded, not guessed at.
    out += b === undefined ? '=' : ALPHABET[((b & 0x0f) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : ALPHABET[c & 0x3f];
  }
  return out;
}
