import { describe, it, expect } from 'vitest';
import { generateRoomId } from '../room-id.js';

describe('generateRoomId', () => {
  it('returns a 16-character Crockford base32 string (80 bits of entropy)', () => {
    const id = generateRoomId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  it('generates unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, generateRoomId));
    expect(ids.size).toBe(100);
  });
});
