import { requireRole } from '@/auth/service';
import { newId, nowIso } from '@/db';
import { ApiError, json, readJson, type Env, type Router } from '@/http';

/**
 * The chat between a customer and the dairy. One conversation per customer, so every message carries the customer
 * it belongs to; `sender` says which side wrote it.
 *
 * A customer only ever sees and writes their own conversation. The dairy sees them all, which is what the admin
 * app's list of chats is built from.
 */

type ChatRow = {
  id: string;
  customer_id: string;
  sender: 'customer' | 'dairy';
  sender_name: string | null;
  text: string;
  read_at: string | null;
  created_at: string;
};

/** The app says `admin` where the table says `dairy`: the dairy is the side, the admin app is where it is typed. */
type Message = Record<string, unknown>;

function messageFromRow(row: ChatRow): Message {
  return {
    id: row.id,
    customerId: row.customer_id,
    from: row.sender === 'dairy' ? 'admin' : 'customer',
    text: row.text,
    ...(row.sender_name ? { senderName: row.sender_name } : {}),
    ...(row.read_at ? { readAt: row.read_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.read_at ?? row.created_at,
  };
}

async function conversation(env: Env, customerId?: string): Promise<Message[]> {
  const rows = customerId
    ? await env.DB.prepare('select * from chat_messages where customer_id = ? order by created_at').bind(customerId).all<ChatRow>()
    : await env.DB.prepare('select * from chat_messages order by created_at').all<ChatRow>();
  return rows.results.map(messageFromRow);
}

export function mountChat(router: Router): Router {
  return router
    .get('/chat', async (context) => {
      const principal = await requireRole(context, 'admin', 'customer');
      if (principal.role === 'admin') return json({ items: await conversation(context.env) });
      if (!principal.linkedRecordId) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'No customer record for this number.');
      return json({ items: await conversation(context.env, principal.linkedRecordId) });
    })

    .post('/chat', async (context) => {
      const principal = await requireRole(context, 'admin', 'customer');
      const body = await readJson<{ customerId?: string; text?: string; senderName?: string }>(context.request);
      const text = String(body.text ?? '').trim();
      if (!text) throw ApiError.badRequest('CHAT_MESSAGE_EMPTY', 'Write a message first.');

      // A customer writes to their own conversation, whatever the phone sent as the customer.
      const customerId = principal.role === 'customer' ? principal.linkedRecordId : String(body.customerId ?? '').trim();
      if (!customerId) throw ApiError.badRequest('CUSTOMER_NOT_FOUND', 'Say which customer this message is for.');
      if (principal.role === 'admin') {
        const known = await context.env.DB.prepare('select id from customers where id = ?').bind(customerId).first<{ id: string }>();
        if (!known) throw ApiError.notFound('CUSTOMER_NOT_FOUND', 'That customer is no longer on the list.');
      }

      const id = newId('msg');
      await context.env.DB.prepare(
        'insert into chat_messages (id, customer_id, sender, sender_name, text, read_at, created_at) values (?, ?, ?, ?, ?, null, ?)',
      )
        .bind(id, customerId, principal.role === 'admin' ? 'dairy' : 'customer', String(body.senderName ?? '').trim() || null, text.slice(0, 2000), nowIso())
        .run();

      const row = await context.env.DB.prepare('select * from chat_messages where id = ?').bind(id).first<ChatRow>();
      return json(messageFromRow(row!), { status: 201 });
    })

    // The reader opened the conversation: the other side's messages in it are seen.
    .post('/chat/read', async (context) => {
      const principal = await requireRole(context, 'admin', 'customer');
      const body = await readJson<{ customerId?: string }>(context.request);
      const customerId = principal.role === 'customer' ? principal.linkedRecordId : String(body.customerId ?? '').trim();
      if (!customerId) throw ApiError.badRequest('CUSTOMER_NOT_FOUND', 'Say which conversation was read.');

      const writtenByTheOtherSide = principal.role === 'admin' ? 'customer' : 'dairy';
      await context.env.DB.prepare('update chat_messages set read_at = ? where customer_id = ? and sender = ? and read_at is null')
        .bind(nowIso(), customerId, writtenByTheOtherSide)
        .run();

      return json({ items: await conversation(context.env, customerId) });
    });
}

