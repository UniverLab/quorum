import { describe, it, expect } from 'vitest';
import { computeReaction } from '../kaomoji.js';

describe('computeReaction', () => {
  const participants = { a: { name: 'Alice' }, b: { name: 'Bob' }, c: { name: 'Carol' } };

  it('returns neutral when fewer than 2 valid votes', () => {
    const r = computeReaction('a', { a: '5' }, participants);
    expect(r.type).toBe('neutral');
    expect(r.message).toBe('');
  });

  it('returns neutral when fewer than 2 numeric votes', () => {
    const r = computeReaction('a', { a: '☕', b: '?' }, participants);
    expect(r.type).toBe('neutral');
  });

  it('returns consensus when all numeric votes are identical', () => {
    const r = computeReaction('a', { a: '5', b: '5', c: '5' }, participants);
    expect(r.type).toBe('consensus');
    expect(r.message).toBe('Perfect consensus!');
  });

  it('returns surprise when my vote is the outlier', () => {
    // avg of 3,8 = 5.5; myDist(3→5.5)=2.5, maxDist(8→5.5)=2.5 → outlier
    const r = computeReaction('a', { a: '3', b: '8' }, participants);
    expect(r.type).toBe('surprise');
    expect(r.message).toContain('outlier');
  });

  it('returns frustration when spread is wide', () => {
    // range=10, max=12, 10 > 12*0.5 && 12 > 3
    const r = computeReaction('a', { a: '2', b: '12', c: '5' }, participants);
    expect(r.type).toBe('frustration');
    expect(r.message).toContain('discussion');
  });

  it('returns neutral for moderate spread without outlier', () => {
    const r = computeReaction('a', { a: '5', b: '8', c: '6' }, participants);
    expect(r.type).toBe('neutral');
  });

  it('returns neutral when my vote is NaN (coffee)', () => {
    const r = computeReaction('a', { a: '☕', b: '5', c: '8' }, participants);
    expect(r.type).toBe('neutral');
  });

  it('filters out ? and ☕ from vote entries', () => {
    const r = computeReaction('a', { a: '5', b: '?', c: '☕' }, participants);
    expect(r.type).toBe('neutral');
  });
});
