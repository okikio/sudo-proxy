import { describe, it, expect } from 'vitest';
import {
  getProxyHeaders,
  getAfterResponseHeaders,
  getBlacklistedHeaders,
} from './headers';

describe('getProxyHeaders', () => {
  it('always sets a default User-Agent', () => {
    const out = getProxyHeaders(new Headers());
    expect(out.get('User-Agent')).toContain('Mozilla');
  });

  it('maps X-Cookie → Cookie', () => {
    const out = getProxyHeaders(new Headers({ 'X-Cookie': 'session=abc' }));
    expect(out.get('Cookie')).toBe('session=abc');
  });

  it('maps X-Referer → Referer', () => {
    const out = getProxyHeaders(
      new Headers({ 'X-Referer': 'https://example.com' }),
    );
    expect(out.get('Referer')).toBe('https://example.com');
  });

  it('maps X-Origin → Origin', () => {
    const out = getProxyHeaders(
      new Headers({ 'X-Origin': 'https://example.com' }),
    );
    expect(out.get('Origin')).toBe('https://example.com');
  });

  it('maps X-User-Agent → User-Agent (overrides default)', () => {
    const out = getProxyHeaders(
      new Headers({ 'X-User-Agent': 'CustomBot/1.0' }),
    );
    expect(out.get('User-Agent')).toBe('CustomBot/1.0');
  });

  it('does not forward X-prefixed source headers directly', () => {
    const out = getProxyHeaders(new Headers({ 'X-Cookie': 'x' }));
    expect(out.has('X-Cookie')).toBe(false);
  });
});

describe('getAfterResponseHeaders', () => {
  it('always adds CORS headers', () => {
    const out = getAfterResponseHeaders(
      new Headers(),
      'https://example.com/final',
    );
    expect(out['Access-Control-Allow-Origin']).toBe('*');
    expect(out['Access-Control-Expose-Headers']).toBe('*');
    expect(out['Vary']).toBe('Origin');
  });

  it('adds X-Final-Destination', () => {
    const out = getAfterResponseHeaders(
      new Headers(),
      'https://cdn.example.com/video.mp4',
    );
    expect(out['X-Final-Destination']).toBe(
      'https://cdn.example.com/video.mp4',
    );
  });

  it('maps Set-Cookie → X-Set-Cookie', () => {
    const out = getAfterResponseHeaders(
      new Headers({ 'Set-Cookie': 'id=1' }),
      'https://x.com',
    );
    expect(out['X-Set-Cookie']).toBe('id=1');
  });

  it('does not include Set-Cookie directly in output', () => {
    const out = getAfterResponseHeaders(
      new Headers({ 'Set-Cookie': 'id=1' }),
      'https://x.com',
    );
    expect('Set-Cookie' in out).toBe(false);
  });
});

describe('getBlacklistedHeaders', () => {
  it('returns an array of strings', () => {
    const list = getBlacklistedHeaders();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('includes cloudflare-specific headers', () => {
    const list = getBlacklistedHeaders();
    expect(list).toContain('cf-connecting-ip');
    expect(list).toContain('cf-ray');
    expect(list).toContain('cdn-loop');
  });

  it('includes X-prefixed proxy-header names so they are stripped from upstream', () => {
    const list = getBlacklistedHeaders();
    expect(list).toContain('X-Cookie');
    expect(list).toContain('X-Referer');
    expect(list).toContain('X-Origin');
    expect(list).toContain('X-User-Agent');
  });
});
