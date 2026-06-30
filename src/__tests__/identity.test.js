import { describe, it, expect, beforeEach } from 'vitest';
import { getUserId, getUserName, setUserName } from '../identity.js';

// Vitest runs in Node — provide minimal sessionStorage / localStorage stubs
function makeStorage() {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

beforeEach(() => {
  global.sessionStorage = makeStorage();
  global.localStorage   = makeStorage();
});

describe('getUserId', () => {
  it('creates and persists a UUID on first call', () => {
    const id = getUserId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessionStorage.getItem('quorum:userId')).toBe(id);
  });

  it('returns the same ID on subsequent calls within the session', () => {
    const a = getUserId();
    const b = getUserId();
    expect(a).toBe(b);
  });
});

describe('getUserName / setUserName', () => {
  it('returns empty string when no name is set', () => {
    expect(getUserName()).toBe('');
  });

  it('persists and retrieves a name', () => {
    setUserName('Alice');
    expect(getUserName()).toBe('Alice');
  });

  it('trims whitespace on set', () => {
    setUserName('  Bob  ');
    expect(getUserName()).toBe('Bob');
  });
});
