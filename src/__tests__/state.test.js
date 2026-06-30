import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getOnlinePeers,
  getAllVoted,
  computeStats,
} from '../state.js';

// ── createInitialState ────────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('returns expected shape', () => {
    const s = createInitialState('ROOM01');
    expect(s.roomId).toBe('ROOM01');
    expect(s.phase).toBe('waiting');
    expect(s.stories).toEqual([]);
    expect(s.currentIndex).toBe(-1);
    expect(s.storyTitle).toBe('');
    expect(s.autoReveal).toBe(true);
    expect(s.votes).toEqual({});
    expect(s.participants).toEqual({});
  });

  it('generates a unique roundId each call', () => {
    const a = createInitialState('R1');
    const b = createInitialState('R1');
    expect(a.roundId).not.toBe(b.roundId);
  });
});

// ── getOnlinePeers ────────────────────────────────────────────────────────────

describe('getOnlinePeers', () => {
  const base = createInitialState('R');

  it('returns all participants when all online', () => {
    const s = {
      ...base,
      participants: {
        a: { id: 'a', online: true },
        b: { id: 'b', online: true },
      },
    };
    expect(getOnlinePeers(s)).toHaveLength(2);
  });

  it('excludes participants with online === false', () => {
    const s = {
      ...base,
      participants: {
        a: { id: 'a', online: true },
        b: { id: 'b', online: false },
      },
    };
    const online = getOnlinePeers(s);
    expect(online).toHaveLength(1);
    expect(online[0].id).toBe('a');
  });

  it('treats missing online field as online (default true)', () => {
    const s = {
      ...base,
      participants: { a: { id: 'a' } },
    };
    expect(getOnlinePeers(s)).toHaveLength(1);
  });

  it('returns empty array when no participants', () => {
    expect(getOnlinePeers(base)).toEqual([]);
  });
});

// ── getAllVoted ───────────────────────────────────────────────────────────────

describe('getAllVoted', () => {
  const base = createInitialState('R');

  it('returns false when no participants', () => {
    expect(getAllVoted(base)).toBe(false);
  });

  it('returns false when some have not voted (null)', () => {
    const s = {
      ...base,
      participants: {
        a: { id: 'a', online: true },
        b: { id: 'b', online: true },
      },
      votes: { a: '5', b: null },
    };
    expect(getAllVoted(s)).toBe(false);
  });

  it('returns true when all online participants voted', () => {
    const s = {
      ...base,
      participants: {
        a: { id: 'a', online: true },
        b: { id: 'b', online: true },
      },
      votes: { a: '5', b: '8' },
    };
    expect(getAllVoted(s)).toBe(true);
  });

  it('ignores offline participants in the "all voted" check', () => {
    const s = {
      ...base,
      participants: {
        a: { id: 'a', online: true },
        b: { id: 'b', online: false },
      },
      votes: { a: '3', b: null },
    };
    // b is offline and hasn't voted, but a (online) has — should be true
    expect(getAllVoted(s)).toBe(true);
  });

  it('returns false when all online participants are offline', () => {
    const s = {
      ...base,
      participants: { a: { id: 'a', online: false } },
      votes: { a: '5' },
    };
    expect(getAllVoted(s)).toBe(false);
  });
});

// ── computeStats ─────────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('returns dashes when no votes', () => {
    expect(computeStats({})).toEqual({ avg: '—', min: '—', max: '—' });
  });

  it('returns dashes when all votes are null', () => {
    expect(computeStats({ a: null, b: null })).toEqual({ avg: '—', min: '—', max: '—' });
  });

  it('ignores non-numeric votes (?, ☕)', () => {
    expect(computeStats({ a: '5', b: '?', c: '☕' })).toEqual({
      avg: '5.0',
      min: 5,
      max: 5,
    });
  });

  it('computes avg, min, max correctly', () => {
    const result = computeStats({ a: '1', b: '3', c: '5' });
    expect(result.avg).toBe('3.0');
    expect(result.min).toBe(1);
    expect(result.max).toBe(5);
  });

  it('handles single numeric vote', () => {
    const result = computeStats({ a: '8' });
    expect(result.avg).toBe('8.0');
    expect(result.min).toBe(8);
    expect(result.max).toBe(8);
  });

  it('averages correctly with Fibonacci values', () => {
    // 1 + 2 + 3 + 5 + 8 + 13 = 32 / 6 = 5.333...
    const result = computeStats({ a: '1', b: '2', c: '3', d: '5', e: '8', f: '13' });
    expect(result.avg).toBe('5.3');
    expect(result.min).toBe(1);
    expect(result.max).toBe(13);
  });
});
