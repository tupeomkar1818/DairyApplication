/**
 * Pictures and videos kept where every phone can see them.
 *
 * Only exists with the dairy's server: a phone keeping its own records keeps the picture as it was picked — a
 * `data:` URI on the web, the file's own address on a phone — because there is nowhere else to put it.
 */
export interface IMediaService {
  /** POST /media — the bytes as they are; the address to keep on the record comes back. */
  upload(bytes: ArrayBuffer, contentType: string): Promise<{ url: string; key: string }>;

  /** DELETE /media/:key. The dairy's. */
  delete(key: string): Promise<void>;
}
