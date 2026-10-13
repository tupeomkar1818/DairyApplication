import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from '@/src/infrastructure/printing/base64';

/** Node's own encoder, as the thing to be right against. */
const reference = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

describe('bytes as base64', () => {
  it('matches the known answers', () => {
    expect(bytesToBase64(new TextEncoder().encode('Amrale'))).toBe('QW1yYWxl');
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  it('pads a group that is short of a byte', () => {
    // One, two and three bytes are the three cases that exist; everything longer is these repeated.
    expect(bytesToBase64(new Uint8Array([0x41]))).toBe('QQ==');
    expect(bytesToBase64(new Uint8Array([0x41, 0x42]))).toBe('QUI=');
    expect(bytesToBase64(new Uint8Array([0x41, 0x42, 0x43]))).toBe('QUJD');
  });

  it('carries the control bytes an ESC/POS bill is made of', () => {
    const escpos = new Uint8Array([0x1b, 0x40, 0x1b, 0x74, 0x00, 0x0a, 0x1d, 0x56, 0x42, 0x00]);
    expect(bytesToBase64(escpos)).toBe(reference(escpos));
  });

  it('agrees with Node for every byte value, at every length', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    for (let length = 0; length <= 256; length += 1) {
      const slice = all.slice(0, length);
      expect(bytesToBase64(slice)).toBe(reference(slice));
    }
  });
});
