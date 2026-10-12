import { requireRole, requireUser } from '@/auth/service';
import { newId } from '@/db';
import { ApiError, json, type Env, type Router } from '@/http';

/**
 * Pictures and videos: offer posters, the pictures on an announcement, profile photos.
 *
 * They used to travel inside the records themselves — a `data:` URI in the row, or a file path that meant something
 * only on the phone that picked it. Neither works for a dairy with more than one phone: one bloats every read of
 * that record, the other shows nothing to anybody else. So a file goes to R2 once and the record keeps its address.
 *
 * Reading one needs no sign-in: an offer poster is on the public website, and a picture cannot carry a token in an
 * `<img>` tag. The addresses are random and unguessable, which is how pictures are shared everywhere; nothing that
 * should be kept from the people who have the link belongs here.
 */

/** What a phone may send: the kinds the apps pick, and nothing executable. */
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** Generous for a photo from a phone, small enough that one upload cannot fill the bucket. */
const MAX_BYTES = 10 * 1024 * 1024;

/** A year and a month in the key, so the bucket can be read by eye and cleaned by age. */
function mediaKey(contentType: string, now: Date): string {
  const yyyyMm = now.toISOString().slice(0, 7).replace('-', '/');
  return `${yyyyMm}/${newId('img').slice(4)}.${TYPES[contentType]}`;
}

function bucket(env: Env): R2Bucket {
  if (!env.MEDIA) {
    // The Worker is running without the bucket bound (see the README): the apps keep the picture as they picked it.
    throw new ApiError(503, 'MEDIA_NOT_SET_UP', 'Picture storage is not set up on this server yet.');
  }
  return env.MEDIA;
}

export function mountMedia(router: Router): Router {
  return router
    // The picture itself. No sign-in: it is shown in an <img> tag, and on the public website.
    .get('/media/*', async (context) => {
      const key = decodeURIComponent(new URL(context.request.url).pathname.replace('/media/', ''));
      if (!key) throw ApiError.notFound('MEDIA_NOT_FOUND', 'No such picture.');

      const object = await bucket(context.env).get(key);
      if (!object) throw ApiError.notFound('MEDIA_NOT_FOUND', 'That picture is no longer there.');

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      // A key is never reused, so what is at one never changes.
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      headers.set('access-control-allow-origin', '*');
      return new Response(object.body, { headers });
    })

    // Sending one up: the bytes as they are, with the type in the header.
    .post('/media', async (context) => {
      await requireUser(context);
      const contentType = (context.request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (!TYPES[contentType]) {
        throw ApiError.badRequest('MEDIA_TYPE_NOT_ALLOWED', 'Send a photo or a video.', { allowed: Object.keys(TYPES) });
      }

      const body = await context.request.arrayBuffer();
      if (!body.byteLength) throw ApiError.badRequest('MEDIA_EMPTY', 'The file was empty.');
      if (body.byteLength > MAX_BYTES) {
        throw ApiError.badRequest('MEDIA_TOO_BIG', 'That file is too large. Please pick a smaller one.', {
          maxBytes: MAX_BYTES,
          bytes: body.byteLength,
        });
      }

      const key = mediaKey(contentType, new Date());
      await bucket(context.env).put(key, body, { httpMetadata: { contentType } });
      return json({ key, url: `${new URL(context.request.url).origin}/media/${key}`, bytes: body.byteLength }, { status: 201 });
    })

    // Taking one down. The dairy's: a picture may still be on a record somebody is reading.
    .delete('/media/*', async (context) => {
      await requireRole(context, 'admin');
      const key = decodeURIComponent(new URL(context.request.url).pathname.replace('/media/', ''));
      if (!key) throw ApiError.badRequest('MEDIA_NOT_FOUND', 'No such picture.');
      await bucket(context.env).delete(key);
      return new Response(null, { status: 204 });
    });
}

/**
 * Records carry the address of a picture, not the picture. A small `data:` URI is let through (an icon, a sketch),
 * but a photo inside a record would be read back on every screen that shows that record.
 */
export const MAX_INLINE_PICTURE_BYTES = 64 * 1024;

export function assertPictureIsAnAddress(value: unknown, field: string): void {
  const uri = String(value ?? '');
  if (!uri.startsWith('data:')) return;
  // base64 is 4 characters for every 3 bytes.
  const bytes = Math.floor((uri.length - uri.indexOf(',') - 1) * 0.75);
  if (bytes > MAX_INLINE_PICTURE_BYTES) {
    throw ApiError.badRequest('PICTURE_NOT_UPLOADED', 'Send the picture to /media first, and keep its address here.', {
      field,
      bytes,
      maxBytes: MAX_INLINE_PICTURE_BYTES,
    });
  }
}
