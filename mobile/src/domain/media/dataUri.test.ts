import { describe, expect, it } from 'vitest';

import { contentTypeFromUri, readDataUri } from '@/src/domain/media/dataUri';

/** A real 1×1 PNG, as the web's picker hands one back. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('reading a picked picture', () => {
  it('gives back the type and the bytes', () => {
    const read = readDataUri(`data:image/png;base64,${PNG_BASE64}`)!;
    expect(read.contentType).toBe('image/png');
    // Every PNG starts with these eight bytes.
    expect([...read.bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(read.bytes.length).toBe(70);
  });

  it('decodes the same bytes a browser would', () => {
    const bytes = readDataUri('data:text/plain;base64,SGVsbG8sIOCkpuClgeCkpw==')!.bytes;
    expect(new TextDecoder().decode(bytes)).toBe('Hello, दुध');
  });

  it('handles padding, and no padding', () => {
    expect(new TextDecoder().decode(readDataUri('data:text/plain;base64,YQ==')!.bytes)).toBe('a');
    expect(new TextDecoder().decode(readDataUri('data:text/plain;base64,YWI=')!.bytes)).toBe('ab');
    expect(new TextDecoder().decode(readDataUri('data:text/plain;base64,YWJj')!.bytes)).toBe('abc');
  });

  it('says no to anything that is not a base64 data URI', () => {
    expect(readDataUri('file:///storage/photo.jpg')).toBeNull();
    expect(readDataUri('https://example.com/a.png')).toBeNull();
    expect(readDataUri('data:text/plain,hello')).toBeNull();
    expect(readDataUri('data:image/png;base64,****')).toBeNull();
    expect(readDataUri('')).toBeNull();
  });
});

describe('the type of a picture picked off a phone', () => {
  it('reads it from the end of the name', () => {
    expect(contentTypeFromUri('file:///storage/emulated/0/DCIM/photo.PNG')).toBe('image/png');
    expect(contentTypeFromUri('file:///tmp/clip.mp4')).toBe('video/mp4');
    expect(contentTypeFromUri('file:///tmp/clip.mov')).toBe('video/quicktime');
    expect(contentTypeFromUri('file:///tmp/pic.heic')).toBe('image/heic');
  });

  it('falls back to a photo, which is what a phone’s camera gives', () => {
    expect(contentTypeFromUri('content://media/external/images/media/42')).toBe('image/jpeg');
    expect(contentTypeFromUri('')).toBe('image/jpeg');
  });
});
