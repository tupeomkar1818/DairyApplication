/**
 * The small amount of cryptography sign-in needs.
 *
 * Nothing secret is ever stored as it is: an OTP and a session token are kept only as a SHA-256 hash, salted with
 * a pepper that lives in the Worker's secrets. Someone who reads the database still cannot sign in.
 */

const encoder = new TextEncoder();

export async function sha256Hex(value: string, pepper: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${pepper}:${value}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare, so a wrong code cannot be found one character at a time. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A six-digit code, evenly spread over 000000–999999. */
export function randomOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0]! % 1_000_000).padStart(6, '0');
}

/** The session token the phone keeps: 32 random bytes, URL-safe. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** "+91 98XXXXXX11" — enough for the reader to recognise their number, not enough to read it out. */
export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return mobile;
  return `+91 ${digits.slice(0, 2)}XXXXXX${digits.slice(8)}`;
}

/** Ten digits, as every Indian mobile number the dairy deals with. */
export function normalizeMobile(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  const last10 = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
}
