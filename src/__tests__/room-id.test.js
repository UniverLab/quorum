import { describe, it, expect } from 'vitest';
import { generateRoomId } from '../room-id.js';

describe('generateRoomId', () => {
  it('returns an 8-character uppercase hex string', () => {
    const id = generateRoomId();
    expect(id).toMatch(/^[0-9A-F]{8}$/);
  });

  it('generates unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, generateRoomId));
    expect(ids.size).toBe(100);
  });
});
