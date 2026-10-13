import { DomainError, type DomainErrorCode } from '@/src/domain/shared/errors';
import { clearStoredSession, readStoredSessionToken } from '@/src/infrastructure/auth/sessionRead';
import { strings } from '@/src/i18n/strings';

/**
 * Talking to the dairy's server.
 *
 * Every call carries the session token the phone saved at sign-in. The server answers an error as
 * `{ error: { code, message } }`, and a code the app already knows (`DomainErrorCode`) comes back as the same
 * `DomainError` the on-phone services throw — so screens handle both the same way.
 */

const BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

/** How long to wait before giving up on a call (a van in a weak signal should not hang the screen). */
const TIMEOUT_MS = 20_000;

/** Error codes the app has its own handling for; anything else is shown as the server worded it. */
const KNOWN_CODES: readonly string[] = [
  'MOBILE_NOT_REGISTERED',
  'USER_INACTIVE',
  'APP_ACCESS_DISABLED',
  'OTP_RESEND_COOLDOWN',
  'OTP_EXPIRED',
  'OTP_INVALID',
  'OTP_TOO_MANY_ATTEMPTS',
  'SESSION_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'CUSTOMER_MOBILE_EXISTS',
  'MOBILE_IN_USE',
  'DELIVERY_BOY_NOT_FOUND',
  'SUBSCRIPTION_NOT_FOUND',
  'NOTIFICATION_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_NAME_DUPLICATE',
  'PRODUCT_IN_USE',
  'PRODUCT_CATEGORY_NOT_FOUND',
  'OFFER_NOT_FOUND',
  'OFFER_CODE_EMPTY',
  'OFFER_CODE_UNKNOWN',
  'OFFER_CODE_ENDED',
  'OFFER_CODE_ALREADY_APPLIED',
  'PASSWORD_INVALID',
  'PIN_INVALID',
  'PIN_LOCKED',
  'PIN_NOT_SET',
];

export function apiBaseUrl(): string {
  return BASE_URL;
}

export function assertApiConfigured(): void {
  if (!BASE_URL) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the dairy server address.');
}

type RequestOptions = {
  /** Sends no session token: the sign-in calls, which happen before there is one. */
  anonymous?: boolean;
  body?: unknown;
};

export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  assertApiConfigured();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (!options.anonymous) {
    const token = await readStoredSessionToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    // No network, the server asleep, or the call timed out: one wording for all of them.
    throw new Error(strings('common').errors.network);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: string; message?: string; details?: unknown } }
    | null;

  if (response.ok) return payload as T;

  const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? strings('common').errors.generic);

  if (response.status === 401) {
    // The session is gone or no longer accepted: forget it, so the app asks for a new sign-in.
    await clearStoredSession();
    throw new DomainError('SESSION_NOT_FOUND', message);
  }
  if (KNOWN_CODES.includes(code)) throw new DomainError(code as DomainErrorCode, message);
  throw new Error(message);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>('GET', path, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) => apiRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) => apiRequest<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) => apiRequest<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>('DELETE', path, options),
};
