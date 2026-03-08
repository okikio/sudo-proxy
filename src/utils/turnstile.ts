import type { H3Event, EventHandlerRequest } from 'h3';
import { getIp } from '@/utils/ip';

// ---------------------------------------------------------------------------
// Web Crypto helpers — replaces the `jose` dependency
// ---------------------------------------------------------------------------

/** Base64url-encode an ArrayBuffer or Uint8Array. */
function b64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url-decode a string to a Uint8Array. */
function decodeb64url(s: string): Uint8Array {
  const padded =
    s.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Import a raw secret as an HMAC-SHA-256 CryptoKey. */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Sign an HS256 JWT with the given payload and secret.
 * Exported for testing; prefer `makeToken` for application use.
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = b64url(
    new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(sig)}`;
}

/**
 * Verify an HS256 JWT.  Returns the decoded payload or null on any failure.
 * Exported for testing; prefer `isAllowedToMakeRequest` for application use.
 */
export async function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeb64url(sigB64),
      new TextEncoder().encode(signingInput),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(decodeb64url(payloadB64)),
    ) as T & { exp?: number };
    if (
      payload.exp !== undefined &&
      Math.floor(Date.now() / 1000) > payload.exp
    )
      return null;
    return payload as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Application-level auth helpers
// ---------------------------------------------------------------------------

const tokenHeader = 'X-Token';
const jwtPrefix = 'jwt|';
const turnstilePrefix = 'turnstile|';

export function isTurnstileEnabled() {
  // Read env vars lazily so tests can set them before calling
  return !!(process.env.TURNSTILE_SECRET && process.env.JWT_SECRET);
}

/** Mint a 10-minute HS256 JWT containing the caller's IP. */
export async function makeToken(ip: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Cannot make token without JWT_SECRET');
  return signJwt({ ip, exp: Math.floor(Date.now() / 1000) + 600 }, secret);
}

export function setTokenHeader(
  event: H3Event<EventHandlerRequest>,
  token: string,
) {
  setHeader(event, tokenHeader, token);
}

export async function createTokenIfNeeded(
  event: H3Event<EventHandlerRequest>,
): Promise<string | null> {
  if (!isTurnstileEnabled()) return null;
  const token = event.headers.get(tokenHeader);
  if (!token?.startsWith(turnstilePrefix)) return null;
  return makeToken(getIp(event));
}

export async function isAllowedToMakeRequest(
  event: H3Event<EventHandlerRequest>,
) {
  if (!isTurnstileEnabled()) return true;

  const token = event.headers.get(tokenHeader);
  if (!token) return false;

  const jwtSecret = process.env.JWT_SECRET;
  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (!jwtSecret || !turnstileSecret) return false;

  if (token.startsWith(jwtPrefix)) {
    const payload = await verifyJwt<{ ip: string }>(
      token.slice(jwtPrefix.length),
      jwtSecret,
    );
    return payload !== null && getIp(event) === payload.ip;
  }

  if (token.startsWith(turnstilePrefix)) {
    const formData = new FormData();
    formData.append('secret', turnstileSecret);
    formData.append('response', token.slice(turnstilePrefix.length));
    formData.append('remoteip', getIp(event));
    const result = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { body: formData, method: 'POST' },
    );
    const outcome = (await result.json()) as { success: boolean };
    return outcome.success;
  }

  return false;
}
