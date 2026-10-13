import { requireRole, requireUser } from '@/auth/service';
import { nowIso, parseJson } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { assertPictureIsAnAddress } from '@/media/routes';

/**
 * The dairy's own settings — the few things the dairy decides once and every app then shows.
 *
 * Two of them, and only two:
 *
 * - **the cover picture** on the home screen of all three apps;
 * - **how customers pay**: the dairy's UPI id, the name their UPI app shows, whether cash is taken, and a line of
 *   instructions. Without these the customer app cannot offer to pay at all, which is why they belong here rather
 *   than on whichever phone the admin happened to use.
 *
 * The FAQ, the contact details and the privacy policy are *not* here. They read like settings, but they are fixed
 * app content written in both languages (`mobile/src/i18n/{en,mr}/help.ts`), and nothing in the app edits them —
 * storing them here would leave a customer reading Marathi an English page.
 */

type SettingRow = { key: string; value_json: string; updated_at: string };

/** What may be stored, and nothing else: a settings table is not a place to put anything at all. */
const KEYS = ['cover', 'payment'] as const;
type Key = (typeof KEYS)[number];

async function read(env: Env, key: Key): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare('select * from settings where key = ?').bind(key).first<SettingRow>();
  return row ? parseJson<Record<string, unknown> | null>(row.value_json, null) : null;
}

async function write(env: Env, key: Key, value: Record<string, unknown>): Promise<Record<string, unknown>> {
  const now = nowIso();
  const stored = { ...value, updatedAt: now };
  await env.DB.prepare(
    `insert into settings (key, value_json, updated_at) values (?, ?, ?)
     on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at`,
  )
    .bind(key, JSON.stringify(stored), now)
    .run();
  return stored;
}

function assertCover(cover: Record<string, unknown>): void {
  const uri = String(cover.uri ?? '').trim();
  if (!uri) throw ApiError.badRequest('COVER_URI_REQUIRED', 'Pick a picture first.');
  // A photograph belongs in R2, not in a settings row every app reads on every start.
  assertPictureIsAnAddress(uri, 'uri');
  const ratio = Number(cover.aspectRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) throw ApiError.badRequest('COVER_RATIO_INVALID', 'That picture’s size could not be read.');
}

function assertPayment(payment: Record<string, unknown>): void {
  const upiId = String(payment.upiId ?? '').trim();
  // An empty UPI id is how the dairy says "no UPI": then cash is the only way, and it has to be taken.
  if (upiId && !/^[\w.\-_]{2,64}@[A-Za-z]{2,32}$/.test(upiId)) {
    throw ApiError.badRequest('UPI_ID_INVALID', 'Enter a UPI id like amraledairy@okhdfcbank.');
  }
  if (upiId && !String(payment.payeeName ?? '').trim()) {
    throw ApiError.badRequest('PAYEE_NAME_REQUIRED', 'Enter the name customers will see when they pay.');
  }
  if (!upiId && payment.acceptCash === false) {
    throw ApiError.badRequest('NO_WAY_TO_PAY', 'With no UPI id, cash has to be accepted.');
  }
}

export function mountSettings(router: Router): Router {
  return router
    // Every app reads these: the cover on its home screen, the payment details where a customer pays.
    .get('/settings', async (context) => {
      await requireUser(context);
      const [cover, payment] = await Promise.all([read(context.env, 'cover'), read(context.env, 'payment')]);
      return json({ cover, payment });
    })

    .put('/settings/:key', async (context) => {
      await requireRole(context, 'super_admin');
      const key = context.params.key as Key;
      if (!KEYS.includes(key)) throw ApiError.notFound('SETTING_NOT_FOUND', 'There is no such setting.');

      const body = await readJson<Record<string, unknown>>(context.request);
      if (key === 'cover') assertCover(body);
      else assertPayment(body);

      const stored = await write(context.env, key, body);
      return json(stored);
    });
}
