/**
 * The small amount of HTTP the API needs: JSON answers, errors with a code the app can read, and a router that
 * matches a method and a path pattern (`/customers/:id`).
 */

export type Env = {
  DB: D1Database;
  /** Pictures and videos (see `media/routes.ts`). Absent until R2 is turned on for the account. */
  MEDIA?: R2Bucket;
  ALLOWED_ORIGINS: string;
  /** Salts every stored code and session token (`wrangler secret put OTP_PEPPER`). */
  OTP_PEPPER: string;
  /** 'log' writes the code to the Worker log; 'msg91' sends a real SMS. */
  SMS_PROVIDER?: string;
  /** 'true' hands the code back in the response — only while no SMS is actually sent. */
  OTP_DEV_ECHO?: string;
  /** Codes one number may ask for in an hour (6 unless set; raised only for local testing). */
  OTP_MAX_PER_HOUR?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
};

export type RequestContext = {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  /** Path parts the pattern captured: `/customers/:id` on `/customers/c1` gives `{ id: 'c1' }`. */
  params: Record<string, string>;
  url: URL;
};

export type Handler = (context: RequestContext) => Promise<Response> | Response;

/** An answer the app can act on: a code it can switch over, and a sentence for when it cannot. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = 'Sign in again.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'This is not yours to open.'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(code = 'NOT_FOUND', message = 'Not found.'): ApiError {
    return new ApiError(404, code, message);
  }
  static tooManyRequests(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(429, code, message, details);
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

/** Only the apps and the website may call from a browser; a phone app sends no Origin at all. */
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

type Route = { method: string; parts: string[]; handler: Handler };

/** Matches `/customers/:id` against `/customers/c1`; `*` at the end matches the rest of the path. */
function match(parts: string[], path: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part === '*') return params;
    const value = path[i];
    if (value === undefined) return null;
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return null;
  }
  return parts.length === path.length ? params : null;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.add('GET', pattern, handler);
  }
  post(pattern: string, handler: Handler): this {
    return this.add('POST', pattern, handler);
  }
  put(pattern: string, handler: Handler): this {
    return this.add('PUT', pattern, handler);
  }
  patch(pattern: string, handler: Handler): this {
    return this.add('PATCH', pattern, handler);
  }
  delete(pattern: string, handler: Handler): this {
    return this.add('DELETE', pattern, handler);
  }

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);
    let pathExists = false;

    for (const route of this.routes) {
      const params = match(route.parts, path);
      if (!params) continue;
      pathExists = true;
      if (route.method !== request.method) continue;
      try {
        const response = await route.handler({ request, env, ctx, params, url });
        for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
        return response;
      } catch (error) {
        return errorResponse(error, cors);
      }
    }

    return errorResponse(
      pathExists
        ? new ApiError(405, 'METHOD_NOT_ALLOWED', `${request.method} is not allowed here.`)
        : ApiError.notFound('ROUTE_NOT_FOUND', 'No such address.'),
      cors,
    );
  }
}

function errorResponse(error: unknown, cors: Record<string, string>): Response {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status, headers: cors });
  }
  // Anything unexpected: say so plainly and keep the cause in the logs, never in the answer.
  console.error('unhandled', error);
  return json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } }, { status: 500, headers: cors });
}

/** The request's JSON body, or a 400 the app can show. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw ApiError.badRequest('BAD_JSON', 'The request body was not readable.');
  }
}
