import { requireRole, requireUser } from '@/auth/service';
import { newId, nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';
import { assertPictureIsAnAddress } from '@/media/routes';
import { offerFromRow, offerStatus, offerToRow, websiteOffer, type Offer, type OfferRow } from '@/offers/mapping';

/**
 * Offers: price offers, combos, bill discounts and subscription rewards.
 *
 * Bills are worked out from them, so an offer that has started keeps its kind, prices, code and first day — it can
 * only be ended early. The server holds to that whatever a screen sends, so a bill that already counted an offer
 * never changes afterwards.
 */

/** The dairy's day, whatever time zone the server itself thinks it is in. */
function todayInIndia(): string {
  return new Date(Date.now() + 5.5 * 60 * 60_000).toISOString().slice(0, 10);
}

function statusOf(offer: Offer, todayYmd: string): 'scheduled' | 'live' | 'ended' {
  return offerStatus(
    { start_ymd: String(offer.startYmd), end_ymd: (offer.endYmd as string) ?? null, ended_at: (offer.endedAt as string) ?? null },
    todayYmd,
  );
}

async function loadOffers(env: Env, where?: { id: string }): Promise<Offer[]> {
  const rows = where
    ? await env.DB.prepare('select * from offers where id = ?').bind(where.id).all<OfferRow>()
    : await env.DB.prepare('select * from offers order by start_ymd desc, created_at desc').all<OfferRow>();
  return rows.results.map(offerFromRow);
}

async function getOffer(env: Env, id: string): Promise<Offer> {
  const [offer] = await loadOffers(env, { id });
  if (!offer) throw ApiError.notFound('OFFER_NOT_FOUND', 'That offer is no longer there.');
  return offer;
}

async function writeOffer(env: Env, offer: Offer, createdAt: string, updatedAt: string): Promise<void> {
  const row = offerToRow(offer);
  await env.DB.prepare(
    `insert into offers (id, kind, title_en, title_mr, description_en, description_mr, image_key, start_ymd, end_ymd,
       ended_at, code, payload_json, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       kind = excluded.kind, title_en = excluded.title_en, title_mr = excluded.title_mr,
       description_en = excluded.description_en, description_mr = excluded.description_mr,
       image_key = excluded.image_key, start_ymd = excluded.start_ymd, end_ymd = excluded.end_ymd,
       ended_at = excluded.ended_at, code = excluded.code, payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  )
    .bind(
      row.id,
      row.kind,
      row.title_en,
      row.title_mr,
      row.description_en,
      row.description_mr,
      row.image_key,
      row.start_ymd,
      row.end_ymd,
      row.ended_at,
      row.code,
      row.payload_json,
      createdAt,
      updatedAt,
    )
    .run();
}

function assertSaveable(offer: Offer): void {
  if (!['price', 'combo', 'bill', 'subscription'].includes(String(offer.kind))) {
    throw ApiError.badRequest('OFFER_KIND_INVALID', 'Pick what kind of offer this is.');
  }
  if (!String((offer.title as { en?: string } | undefined)?.en ?? '').trim()) {
    throw ApiError.badRequest('OFFER_TITLE_REQUIRED', 'Give the offer a name.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(offer.startYmd ?? ''))) {
    throw ApiError.badRequest('OFFER_START_INVALID', 'Pick the offer’s first day.');
  }
  if (offer.endYmd && String(offer.endYmd) < String(offer.startYmd)) {
    throw ApiError.badRequest('OFFER_END_BEFORE_START', 'The last day must be on or after the first day.');
  }
  if (offer.imageUri) assertPictureIsAnAddress(offer.imageUri, 'imageUri');
}

/** A code belongs to one offer for good, so a customer who typed it always gets the offer it was printed for. */
async function assertCodeFree(env: Env, code: string | null, exceptId: string): Promise<void> {
  if (!code) return;
  const clash = await env.DB.prepare('select id from offers where code = ? and id != ?').bind(code, exceptId).first<{ id: string }>();
  if (clash) throw ApiError.badRequest('OFFER_CODE_TAKEN', 'Another offer already uses this code.');
}

/** The codes a customer has typed. */
async function claimedOfferIds(env: Env, customerId: string): Promise<Set<string>> {
  const rows = await env.DB.prepare('select offer_id from offer_claims where customer_id = ?').bind(customerId).all<{ offer_id: string }>();
  return new Set(rows.results.map((row) => row.offer_id));
}

/** A code is for the customers it was given to, so it never travels in a list anybody else can read. */
function withoutCode(offer: Offer): Offer {
  const { code: _code, ...rest } = offer;
  return rest as Offer;
}

export function mountOffers(router: Router): Router {
  return router
    // What the website shows: offers running today that need no code, and no sign-in to read.
    .get('/public/offers.json', async ({ env }) => {
      const today = todayInIndia();
      const rows = await env.DB.prepare(
        `select * from offers where code is null and ended_at is null and start_ymd <= ?1 and (end_ymd is null or end_ymd >= ?1)
         order by start_ymd desc, created_at desc`,
      )
        .bind(today)
        .all<OfferRow>();
      return json(
        { version: 1, generatedAt: nowIso(), offers: rows.results.map(offerFromRow).map(websiteOffer) },
        // The website is a different site, and should not hold an ended offer on screen for long.
        { headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=60' } },
      );
    })

    .get('/offers', async (context) => {
      const principal = await requireUser(context);
      const offers = await loadOffers(context.env);
      if (principal.role === 'admin') return json({ items: offers });

      const today = todayInIndia();
      const running = offers.filter((offer) => statusOf(offer, today) !== 'ended');
      // A delivery boy sees what is running, because the load sheet counts offer orders — but not the codes.
      if (principal.role === 'delivery_boy') return json({ items: running.map(withoutCode) });

      // A customer sees the offers that need no code, plus the ones whose code they have typed.
      const claimed = principal.linkedRecordId ? await claimedOfferIds(context.env, principal.linkedRecordId) : new Set<string>();
      return json({ items: running.filter((offer) => !offer.code || claimed.has(offer.id)) });
    })

    .get('/offers/:id', async (context) => {
      const principal = await requireUser(context);
      const offer = await getOffer(context.env, context.params.id!);
      if (principal.role === 'admin') return json(offer);
      if (statusOf(offer, todayInIndia()) === 'ended') throw ApiError.notFound('OFFER_NOT_FOUND', 'That offer has ended.');
      if (principal.role === 'customer' && offer.code) {
        const claimed = principal.linkedRecordId ? await claimedOfferIds(context.env, principal.linkedRecordId) : new Set<string>();
        if (!claimed.has(offer.id)) throw ApiError.notFound('OFFER_NOT_FOUND', 'That offer is not yours to see.');
        return json(offer);
      }
      return json(withoutCode(offer));
    })

    .post('/offers', async (context) => {
      await requireRole(context, 'admin');
      const body = await readJson<Offer>(context.request);
      const now = nowIso();
      const offer: Offer = { ...body, id: newId('offer'), endedAt: undefined, createdAt: now, updatedAt: now };
      assertSaveable(offer);
      // A first day in the past would change bills that are already worked out.
      if (String(offer.startYmd) < todayInIndia()) {
        throw ApiError.badRequest('OFFER_START_IN_PAST', 'The offer’s first day cannot be in the past.');
      }
      await assertCodeFree(context.env, offerToRow(offer).code, offer.id);
      await writeOffer(context.env, offer, now, now);
      return json(await getOffer(context.env, offer.id), { status: 201 });
    })

    .patch('/offers/:id', async (context) => {
      await requireRole(context, 'admin');
      const id = context.params.id!;
      const current = await getOffer(context.env, id);
      const patch = await readJson<Partial<Offer>>(context.request);
      const today = todayInIndia();
      const started = statusOf(current, today) !== 'scheduled';
      const now = nowIso();

      // Once it has started, bills depend on it: only the wording, the poster, the last day, and ending it.
      const merged: Offer = started
        ? {
            ...current,
            title: patch.title ?? current.title,
            description: patch.description ?? current.description,
            imageUri: patch.imageUri ?? current.imageUri,
            endYmd: patch.endYmd ?? current.endYmd,
            endedAt: patch.endedAt ?? current.endedAt,
            updatedAt: now,
          }
        : { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: now };

      assertSaveable(merged);
      if (!started) await assertCodeFree(context.env, offerToRow(merged).code, id);
      await writeOffer(context.env, merged, String(current.createdAt), now);
      return json(await getOffer(context.env, id));
    })

    .delete('/offers/:id', async (context) => {
      await requireRole(context, 'admin');
      const id = context.params.id!;
      const offer = await getOffer(context.env, id);
      if (statusOf(offer, todayInIndia()) !== 'scheduled') {
        throw ApiError.badRequest(
          'OFFER_ALREADY_STARTED',
          'This offer has already started. End it instead, so the bills that counted it stay as they were.',
        );
      }
      await context.env.DB.prepare('delete from offers where id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    })

    // A customer typing a code they were given. The code is looked up here, so no list has to carry it.
    .post('/offers/claim', async (context) => {
      const principal = await requireRole(context, 'customer');
      if (!principal.linkedRecordId) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer record for this number.');
      const { code } = await readJson<{ code?: string }>(context.request);
      const normalized = String(code ?? '').replace(/\s+/g, '').toUpperCase();
      if (!normalized) throw ApiError.badRequest('OFFER_CODE_EMPTY', 'Type the offer code.');

      const row = await context.env.DB.prepare('select * from offers where code = ?').bind(normalized).first<OfferRow>();
      if (!row) throw ApiError.badRequest('OFFER_CODE_UNKNOWN', 'That code is not valid. Check the spelling.');
      // A code for an offer that has not started yet is kept: it applies from the offer's first day.
      if (offerStatus(row, todayInIndia()) === 'ended') throw ApiError.badRequest('OFFER_CODE_ENDED', 'That offer has ended.');

      const claimed = await context.env.DB.prepare('select 1 as found from offer_claims where offer_id = ? and customer_id = ?')
        .bind(row.id, principal.linkedRecordId)
        .first<{ found: number }>();
      if (claimed) throw ApiError.badRequest('OFFER_CODE_ALREADY_APPLIED', 'You have already applied this code.');

      await context.env.DB.prepare('insert into offer_claims (offer_id, customer_id, code, claimed_at) values (?, ?, ?, ?)')
        .bind(row.id, principal.linkedRecordId, normalized, nowIso())
        .run();
      return json({ offer: offerFromRow(row) }, { status: 201 });
    });
}
