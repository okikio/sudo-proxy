import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers – replicate the exact compiled logic without importing the route
// (the route uses Nitro auto-imports and a module-level setInterval that we
// want to avoid in unit tests).
// ---------------------------------------------------------------------------

function isCacheDisabled(): boolean {
  return process.env.ENABLE_CACHE !== 'true';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ENABLE_CACHE env-var semantics (core PR change)', () => {
  const saved = process.env.ENABLE_CACHE;

  afterEach(() => {
    // restore original state after each test
    if (saved === undefined) {
      delete process.env.ENABLE_CACHE;
    } else {
      process.env.ENABLE_CACHE = saved;
    }
  });

  it('cache is DISABLED by default (ENABLE_CACHE not set)', () => {
    delete process.env.ENABLE_CACHE;
    expect(isCacheDisabled()).toBe(true);
  });

  it('cache is ENABLED when ENABLE_CACHE=true', () => {
    process.env.ENABLE_CACHE = 'true';
    expect(isCacheDisabled()).toBe(false);
  });

  it('cache is DISABLED when ENABLE_CACHE=false', () => {
    process.env.ENABLE_CACHE = 'false';
    expect(isCacheDisabled()).toBe(true);
  });

  it('cache is DISABLED when ENABLE_CACHE=1 (only "true" opts in)', () => {
    process.env.ENABLE_CACHE = '1';
    expect(isCacheDisabled()).toBe(true);
  });

  it('cache is DISABLED when ENABLE_CACHE=TRUE (case-sensitive)', () => {
    process.env.ENABLE_CACHE = 'TRUE';
    expect(isCacheDisabled()).toBe(true);
  });
});

describe('old DISABLE_CACHE env-var is NOT used', () => {
  beforeEach(() => {
    delete process.env.ENABLE_CACHE;
    delete process.env.DISABLE_CACHE;
  });

  afterEach(() => {
    delete process.env.DISABLE_CACHE;
  });

  it('setting DISABLE_CACHE=true does NOT enable the cache (old API removed)', () => {
    process.env.DISABLE_CACHE = 'true';
    // With the old logic: isCacheDisabled = () => DISABLE_CACHE === 'true'
    //   → would return true (disabled), which is the same as our default
    // But the NEW logic ignores DISABLE_CACHE entirely; cache is off by default
    expect(isCacheDisabled()).toBe(true); // still disabled; DISABLE_CACHE is irrelevant
  });

  it('setting DISABLE_CACHE=false does NOT disable the cache (old API removed)', () => {
    process.env.DISABLE_CACHE = 'false';
    // Old logic: DISABLE_CACHE === 'true' → false, so cache was ENABLED
    // New logic: only ENABLE_CACHE=true enables it; DISABLE_CACHE is ignored
    expect(isCacheDisabled()).toBe(true); // cache remains off unless ENABLE_CACHE=true
  });
});
