import { describe, expect, it } from 'vitest';

import { ApiError, Router, type Env } from '@/http';

const env = { DB: {} as D1Database, ALLOWED_ORIGINS: 'https://dairy.matdarraja.in', OTP_PEPPER: 'test' } satisfies Env;
const ctx = {} as ExecutionContext;

function router(): Router {
  return new Router()
    .get('/customers', () => new Response('list'))
    .get('/customers/:id', ({ params }) => new Response(params.id))
    .post('/customers/:id/days/:ymd', ({ params }) => new Response(`${params.id} ${params.ymd}`))
    .get('/boom', () => {
      throw ApiError.forbidden('Not yours.');
    });
}

const call = (method: string, path: string, headers?: HeadersInit) =>
  router().handle(new Request(`https://api.test${path}`, { method, headers }), env, ctx);

describe('router', () => {
  it('matches paths and reads the parts out of them', async () => {
    expect(await (await call('GET', '/customers')).text()).toBe('list');
    expect(await (await call('GET', '/customers/cust_1')).text()).toBe('cust_1');
    expect(await (await call('POST', '/customers/cust_1/days/2026-10-12')).text()).toBe('cust_1 2026-10-12');
  });

  it('says what is wrong: unknown address, wrong method, refused', async () => {
    const unknown = await call('GET', '/nowhere');
    expect(unknown.status).toBe(404);
    expect((await unknown.json<{ error: { code: string } }>()).error.code).toBe('ROUTE_NOT_FOUND');

    const wrongMethod = await call('DELETE', '/customers/cust_1');
    expect(wrongMethod.status).toBe(405);
    expect((await wrongMethod.json<{ error: { code: string } }>()).error.code).toBe('METHOD_NOT_ALLOWED');

    const refused = await call('GET', '/boom');
    expect(refused.status).toBe(403);
    expect((await refused.json<{ error: { message: string } }>()).error.message).toBe('Not yours.');
  });

  it('keeps an unexpected failure out of the answer', async () => {
    const thrown = new Router().get('/x', () => {
      throw new Error('database password is hunter2');
    });
    const response = await thrown.handle(new Request('https://api.test/x'), env, ctx);
    expect(response.status).toBe(500);
    const body = await response.json<{ error: { code: string; message: string } }>();
    expect(body.error).toEqual({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  });

  it('allows the apps and the website from a browser, and nobody else', async () => {
    const allowed = await call('GET', '/customers', { Origin: 'https://dairy.matdarraja.in' });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://dairy.matdarraja.in');

    const other = await call('GET', '/customers', { Origin: 'https://evil.example' });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();

    const preflight = await call('OPTIONS', '/customers', { Origin: 'https://dairy.matdarraja.in' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PATCH');
  });
});
