import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from './turnstile';

const SECRET = 'test-secret-key-that-is-long-enough-ok!';

describe('Web Crypto JWT (replaces jose)', () => {
  it('produces a three-part dot-separated string', async () => {
    const token = await signJwt({ ip: '1.2.3.4', exp: 9999999999 }, SECRET);
    expect(token.split('.')).toHaveLength(3);
  });

  it('header encodes alg=HS256 and typ=JWT', async () => {
    const token = await signJwt({ ip: '1.2.3.4', exp: 9999999999 }, SECRET);
    const [headerB64] = token.split('.');
    const header = JSON.parse(
      atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')),
    );
    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
  });

  it('payload round-trips correctly', async () => {
    const token = await signJwt({ ip: '10.0.0.1', exp: 9999999999 }, SECRET);
    const payload = await verifyJwt<{ ip: string }>(token, SECRET);
    expect(payload?.ip).toBe('10.0.0.1');
  });

  it('returns null for an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 1; // 1 second ago
    const token = await signJwt({ ip: '1.2.3.4', exp: past }, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload).toBeNull();
  });

  it('returns null when the signature is tampered', async () => {
    const token = await signJwt({ ip: '1.2.3.4', exp: 9999999999 }, SECRET);
    const [h, p] = token.split('.');
    // Replace the entire signature with 43 'A' chars (valid base64url, wrong HMAC)
    const payload = await verifyJwt(
      `${h}.${p}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      SECRET,
    );
    expect(payload).toBeNull();
  });

  it('returns null when verified with the wrong secret', async () => {
    const token = await signJwt({ ip: '1.2.3.4', exp: 9999999999 }, SECRET);
    const payload = await verifyJwt(token, 'wrong-secret');
    expect(payload).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    expect(await verifyJwt('not.a.valid.jwt.format', SECRET)).toBeNull();
    expect(await verifyJwt('tooshort', SECRET)).toBeNull();
  });
});
