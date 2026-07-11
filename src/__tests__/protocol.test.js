import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Trystero mock ─────────────────────────────────────────────────────────────

let mockRoom;

vi.mock('trystero/torrent', () => ({
  joinRoom: vi.fn(() => {
    const sends = {};
    const gets  = {};
    const peerJoinCbs  = [];
    const peerLeaveCbs = [];

    const room = {
      makeAction(name) {
        const send = vi.fn();
        sends[name] = send;
        gets[name]  = [];
        return [send, (handler) => { gets[name].push(handler); }];
      },
      onPeerJoin(cb)  { peerJoinCbs.push(cb); },
      onPeerLeave(cb) { peerLeaveCbs.push(cb); },
      leave: vi.fn(),
      triggerPeerJoin(peerId)         { peerJoinCbs.forEach(cb => cb(peerId)); },
      triggerPeerLeave(peerId)        { peerLeaveCbs.forEach(cb => cb(peerId)); },
      triggerAction(name, data, peer) { (gets[name] || []).forEach(cb => cb(data, peer || 'px')); },
      getSend(name) { return sends[name]; },
    };

    mockRoom = room;
    return room;
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkPeer(id, name = id, online = true) {
  return { id, name, lastSeen: Date.now(), online };
}

async function makeProtocol(userId = 'u1', userName = 'Alice') {
  const { createProtocol } = await import('../protocol.js');
  const updates    = [];
  const countdowns = [];
  const proto = createProtocol(
    'ROOM-TEST', userId, userName,
    (s) => updates.push({ ...s, participants: { ...s.participants }, votes: { ...s.votes } }),
    ()  => countdowns.push(Date.now()),
  );
  return { proto, updates, countdowns };
}

function latest(arr) { return arr[arr.length - 1]; }

// ── Initialization ────────────────────────────────────────────────────────────

describe('protocol — initialization', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); });
  afterEach(()  => { vi.useRealTimers(); });

  it('adds self to participants on init', async () => {
    const { updates } = await makeProtocol('u1', 'Alice');
    vi.advanceTimersByTime(1); // flush setTimeout(0)
    const s = latest(updates);
    expect(s.participants['u1']).toBeDefined();
    expect(s.participants['u1'].name).toBe('Alice');
  });

  it('sends join event after deferred tick only', async () => {
    await makeProtocol('u1', 'Alice');
    expect(mockRoom.getSend('join')).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mockRoom.getSend('join')).toHaveBeenCalledOnce();
  });
});

// ── Voting ────────────────────────────────────────────────────────────────────

describe('protocol — voting', () => {
  let proto, updates, countdowns;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates, countdowns } = await makeProtocol());
    vi.advanceTimersByTime(1); // flush deferred join+emit
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('startVoting sets phase to voting with title', () => {
    proto.startVoting('User login');
    const s = latest(updates);
    expect(s.phase).toBe('voting');
    expect(s.storyTitle).toBe('User login');
  });

  it('vote records card and broadcasts vote event', () => {
    proto.startVoting('Story');
    updates.length = 0;
    proto.vote('5');
    const s = latest(updates);
    expect(s.votes['u1']).toBe('5');
    expect(mockRoom.getSend('vote')).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 'u1', card: '5' }),
    );
  });

  it('vote is ignored when not in voting phase', () => {
    expect(latest(updates).phase).toBe('waiting');
    proto.vote('8');
    expect(mockRoom.getSend('vote')).not.toHaveBeenCalled();
  });

  it('reveal triggers countdown then transitions to revealed after 3s', () => {
    proto.startVoting('S');
    proto.reveal();
    expect(countdowns).toHaveLength(1);
    expect(latest(updates).phase).toBe('voting'); // still voting during countdown
    vi.advanceTimersByTime(3_000);
    expect(latest(updates).phase).toBe('revealed');
  });

  it('incoming reveal event triggers countdown', () => {
    proto.startVoting('S');
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('reveal', { roundId });
    expect(countdowns).toHaveLength(1);
    vi.advanceTimersByTime(3_000);
    expect(latest(updates).phase).toBe('revealed');
  });

  it('stale reveal (wrong roundId) is ignored', () => {
    proto.startVoting('S');
    mockRoom.triggerAction('reveal', { roundId: 'old-round-id' });
    expect(countdowns).toHaveLength(0);
  });
});

// ── Auto-reveal ───────────────────────────────────────────────────────────────

describe('protocol — auto-reveal', () => {
  let proto, updates, countdowns;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates, countdowns } = await makeProtocol('u1', 'Alice'));
    vi.advanceTimersByTime(1);
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('auto-reveals when all online peers vote', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    proto.startVoting('Story');
    proto.vote('5');
    expect(countdowns).toHaveLength(0);
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('vote', { participantId: 'u2', card: '8', roundId }, 'peer-u2');
    expect(countdowns).toHaveLength(1);
  });

  it('does not auto-reveal when autoReveal is false', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    proto.setAutoReveal(false);
    proto.startVoting('Story');
    proto.vote('5');
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('vote', { participantId: 'u2', card: '8', roundId }, 'peer-u2');
    expect(countdowns).toHaveLength(0);
  });

  it('ignores offline peers when checking all voted', () => {
    // join handler forces online:true, so use peerLeave to mark u2 offline
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'trystero-p2');
    mockRoom.triggerPeerLeave('trystero-p2');
    expect(latest(updates).participants['u2'].online).toBe(false);

    proto.startVoting('Story');
    proto.vote('3');
    expect(countdowns).toHaveLength(1); // u2 offline → u1 alone satisfies getAllVoted
  });
});

// ── Round management ──────────────────────────────────────────────────────────

describe('protocol — round management', () => {
  let proto, updates, countdowns;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates, countdowns } = await makeProtocol('u1', 'Alice'));
    vi.advanceTimersByTime(1);
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('nextRound cancels pending reveal timeout', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    proto.startVoting('S');
    const roundId = latest(updates).roundId;
    proto.vote('5');
    mockRoom.triggerAction('vote', { participantId: 'u2', card: '8', roundId }, 'peer-u2');
    expect(countdowns).toHaveLength(1); // countdown started
    proto.nextRound();
    vi.advanceTimersByTime(4_000);
    expect(latest(updates).phase).toBe('voting'); // NOT revealed
  });

  it('incoming next-round cancels pending reveal timeout', () => {
    proto.startVoting('S');
    proto.reveal();
    const newRoundId = crypto.randomUUID();
    mockRoom.triggerAction('next-round', { roundId: newRoundId });
    vi.advanceTimersByTime(4_000);
    expect(latest(updates).phase).toBe('voting');
  });

  it('nextRound resets votes to null for all participants', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    proto.startVoting('S');
    proto.vote('5');
    proto.nextRound();
    const s = latest(updates);
    expect(s.votes['u1']).toBeNull();
    expect(s.votes['u2']).toBeNull();
    expect(s.phase).toBe('voting');
  });

  it('newStory sets next story from loaded list', () => {
    proto.loadStories('Story A\nStory B\nStory C');
    proto.newStory();
    const s = latest(updates);
    expect(s.storyTitle).toBe('Story A');
    expect(s.currentIndex).toBe(0);
  });

  it('newStory cancels pending reveal timeout', () => {
    proto.startVoting('S');
    proto.reveal();
    proto.loadStories('Next story');
    proto.newStory();
    vi.advanceTimersByTime(4_000);
    // phase is 'waiting' (from newStory), not 'revealed'
    expect(latest(updates).phase).toBe('waiting');
  });

  it('newStory broadcasts phase waiting so peers land in the same screen', () => {
    proto.loadStories('Story A\nStory B');
    proto.newStory();
    expect(mockRoom.getSend('new-story')).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'waiting', title: 'Story A', index: 0 }),
    );
  });

  it('startVoting broadcasts phase voting', () => {
    proto.startVoting('Story');
    expect(mockRoom.getSend('new-story')).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'voting', title: 'Story' }),
    );
  });

  it('incoming new-story applies the phase carried by the message', () => {
    mockRoom.triggerAction('new-story', { index: 0, title: 'Remote', roundId: 'r1', phase: 'waiting' });
    expect(latest(updates).phase).toBe('waiting');
    expect(latest(updates).storyTitle).toBe('Remote');

    mockRoom.triggerAction('new-story', { index: 0, title: 'Remote', roundId: 'r2', phase: 'voting' });
    expect(latest(updates).phase).toBe('voting');
  });

  it('incoming new-story without phase defaults to voting', () => {
    mockRoom.triggerAction('new-story', { index: 0, title: 'Old client', roundId: 'r3' });
    expect(latest(updates).phase).toBe('voting');
  });

  it('setAutoReveal broadcasts auto-reveal event', () => {
    proto.setAutoReveal(false);
    expect(mockRoom.getSend('auto-reveal')).toHaveBeenCalledWith({ enabled: false });
    const s = latest(updates);
    expect(s.autoReveal).toBe(false);
  });
});

// ── Zombie detection ──────────────────────────────────────────────────────────

describe('protocol — zombie detection', () => {
  let proto, updates;

  // Use longer advance: peer joins at ~t=1ms, timer fires every 5s.
  // now-lastSeen > 15000 first happens at t=20001 (timer tick at t=20000).
  const ADVANCE_TO_OFFLINE = 20_500;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates } = await makeProtocol('u1', 'Alice'));
    vi.advanceTimersByTime(1); // flush deferred init
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('marks peer as offline after heartbeat timeout', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    vi.advanceTimersByTime(ADVANCE_TO_OFFLINE);
    expect(latest(updates).participants['u2'].online).toBe(false);
  });

  it('revives peer and emits when heartbeat arrives after timeout', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    vi.advanceTimersByTime(ADVANCE_TO_OFFLINE);
    const countBefore = updates.length;

    // Heartbeats are only honored from the connection that owns the identity.
    mockRoom.triggerAction('heartbeat', { participantId: 'u2' }, 'peer-u2');

    expect(updates.length).toBeGreaterThan(countBefore); // emitted immediately
    expect(latest(updates).participants['u2'].online).toBe(true);
  });

  it('marks peer offline on peerLeave', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'trystero-p2');
    mockRoom.triggerPeerLeave('trystero-p2');
    expect(latest(updates).participants['u2'].online).toBe(false);
  });
});

// ── State sync ────────────────────────────────────────────────────────────────

describe('protocol — state sync', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.resetModules(); });
  afterEach(()  => { vi.useRealTimers(); });

  it('sends state-sync directly to a new Trystero peer', async () => {
    const { proto } = await makeProtocol('u1', 'Alice');
    vi.advanceTimersByTime(1);
    mockRoom.triggerPeerJoin('peer-u2');
    expect(mockRoom.getSend('state-sync')).toHaveBeenCalledWith(
      expect.objectContaining({ state: expect.any(Object) }),
      'peer-u2',
    );
    proto.destroy();
  });

  it('applies incoming state-sync when no other peers known', async () => {
    const { proto, updates } = await makeProtocol('u1', 'Alice');
    vi.advanceTimersByTime(1);

    const incomingState = {
      roomId: 'ROOM-TEST',
      stories: ['Auth flow'],
      currentIndex: 0,
      storyTitle: 'Auth flow',
      phase: 'voting',
      votes: { 'u1': null, 'u3': '5' },
      participants: {
        'u1': mkPeer('u1', 'Alice'),
        'u3': mkPeer('u3', 'Charlie'),
      },
      roundId: 'existing-round',
      autoReveal: true,
    };

    mockRoom.triggerAction('state-sync', { state: incomingState });

    const s = latest(updates);
    expect(s.phase).toBe('voting');
    expect(s.participants['u3']).toBeDefined();
    expect(s.roundId).toBe('existing-round');
    proto.destroy();
  });

  it('ignores state-sync when other peers already known', async () => {
    const { proto, updates } = await makeProtocol('u1', 'Alice');
    vi.advanceTimersByTime(1);

    // Add a known peer first
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
    const phaseBeforeSync = latest(updates).phase;

    // Now receive state-sync with different phase — should be ignored
    const incomingState = { roomId: 'ROOM-TEST', phase: 'revealed', participants: {}, votes: {}, roundId: 'x', autoReveal: true, stories: [], currentIndex: -1, storyTitle: '' };
    mockRoom.triggerAction('state-sync', { state: incomingState });

    expect(latest(updates).phase).toBe(phaseBeforeSync);
    proto.destroy();
  });
});

// ── Stories list ──────────────────────────────────────────────────────────────

describe('protocol — stories list', () => {
  let proto, updates;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates } = await makeProtocol());
    vi.advanceTimersByTime(1);
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('loadStories parses newline-separated text', () => {
    proto.loadStories('A\nB\n\nC\n');
    const s = latest(updates);
    expect(s.stories).toEqual(['A', 'B', 'C']);
    expect(s.currentIndex).toBe(-1);
  });

  it('loadStories broadcasts stories-load event', () => {
    proto.loadStories('X\nY');
    expect(mockRoom.getSend('stories-load')).toHaveBeenCalledWith({ stories: ['X', 'Y'] });
  });

  it('incoming stories-load updates list', () => {
    mockRoom.triggerAction('stories-load', { stories: ['Remote A', 'Remote B'] });
    const s = latest(updates);
    expect(s.stories).toEqual(['Remote A', 'Remote B']);
  });
});

// ── Payload validation (untrusted peers) ────────────────────────────────────────

describe('protocol — payload validation', () => {
  let proto, updates;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates } = await makeProtocol('u1', 'Alice'));
    vi.advanceTimersByTime(1);
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('ignores a join with no participant', () => {
    mockRoom.triggerAction('join', {}, 'peer-x');
    mockRoom.triggerAction('join', { participant: { name: 'NoId' } }, 'peer-y');
    const ids = Object.keys(latest(updates).participants);
    expect(ids).toEqual(['u1']);
  });

  it('strips peer-controlled fields from a join, keeping only id and name', () => {
    mockRoom.triggerAction('join', {
      participant: { id: 'u2', name: 'Bob', online: false, lastSeen: 0, evil: true },
    }, 'peer-u2');
    const p = latest(updates).participants['u2'];
    expect(p).toEqual({ id: 'u2', name: 'Bob', lastSeen: expect.any(Number), online: true });
    expect(p.evil).toBeUndefined();
  });

  it('ignores a vote from an unknown participant', () => {
    proto.startVoting('Story');
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('vote', { participantId: 'ghost', card: '13', roundId }, 'peer-z');
    expect(latest(updates).votes['ghost']).toBeUndefined();
  });

  it('ignores a state-sync without participants/votes objects', () => {
    mockRoom.triggerAction('state-sync', { state: { phase: 'revealed' } });
    expect(latest(updates).phase).not.toBe('revealed');
  });

  it('ignores stories-load when stories is not an array', () => {
    proto.loadStories('A\nB');
    mockRoom.triggerAction('stories-load', { stories: 'not-an-array' });
    expect(latest(updates).stories).toEqual(['A', 'B']);
  });

  it('filters non-string entries out of an incoming stories list', () => {
    mockRoom.triggerAction('stories-load', { stories: ['ok', 42, null, 'fine'] });
    expect(latest(updates).stories).toEqual(['ok', 'fine']);
  });

  it('does not throw on null or malformed payloads in any handler', () => {
    const actions = ['join', 'state-sync', 'vote', 'reveal', 'next-round', 'new-story', 'stories-load', 'auto-reveal', 'leave', 'heartbeat'];
    for (const name of actions) {
      expect(() => mockRoom.triggerAction(name, null, 'peer-x'), name).not.toThrow();
      expect(() => mockRoom.triggerAction(name, 'garbage', 'peer-x'), name).not.toThrow();
    }
    expect(latest(updates).participants['u1']).toBeDefined();
  });

  it('ignores next-round and new-story without a string roundId', () => {
    proto.startVoting('Story');
    const before = latest(updates).roundId;
    mockRoom.triggerAction('next-round', { roundId: 42 });
    mockRoom.triggerAction('new-story', { roundId: null, title: 'X', index: 0 });
    expect(latest(updates).roundId).toBe(before);
    expect(latest(updates).phase).toBe('voting');
  });

  it('ignores auto-reveal toggle that is not a boolean', () => {
    const before = latest(updates).autoReveal;
    mockRoom.triggerAction('auto-reveal', { enabled: 'yes' });
    expect(latest(updates).autoReveal).toBe(before);
  });
});

// ── Hostile peers ─────────────────────────────────────────────────────────────
// A room ID is the only credential; once inside, a malicious peer can send
// arbitrary payloads. These tests pin the protocol-level defenses.

describe('protocol — hostile peers', () => {
  let proto, updates;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ proto, updates } = await makeProtocol('u1', 'Alice'));
    vi.advanceTimersByTime(1);
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Bob') }, 'peer-u2');
  });

  afterEach(() => { proto.destroy(); vi.useRealTimers(); });

  it('rejects a vote sent on behalf of another participant', () => {
    proto.startVoting('Story');
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('vote', { participantId: 'u2', card: '8', roundId }, 'peer-evil');
    expect(latest(updates).votes['u2']).toBe(null);
  });

  it('rejects votes with cards outside the deck', () => {
    proto.startVoting('Story');
    const roundId = latest(updates).roundId;
    mockRoom.triggerAction('vote', { participantId: 'u2', card: '<img onerror=x>', roundId }, 'peer-u2');
    expect(latest(updates).votes['u2']).toBe(null);
  });

  it('rejects a join that claims our own identity', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u1', 'Impostor') }, 'peer-evil');
    expect(latest(updates).participants['u1'].name).toBe('Alice');
  });

  it('rejects hijacking an id bound to a live connection', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u2', 'Impostor') }, 'peer-evil');
    expect(latest(updates).participants['u2'].name).toBe('Bob');
  });

  it('rejects heartbeat and leave from a non-owner connection', () => {
    mockRoom.triggerAction('leave', { participantId: 'u2' }, 'peer-evil');
    expect(latest(updates).participants['u2'].online).toBe(true);
  });

  it('truncates oversized names and story lists', () => {
    mockRoom.triggerAction('join', { participant: mkPeer('u3', 'x'.repeat(10_000)) }, 'peer-u3');
    expect(latest(updates).participants['u3'].name.length).toBeLessThanOrEqual(40);

    mockRoom.triggerAction('stories-load', { stories: Array.from({ length: 5_000 }, () => 'y'.repeat(9_000)) });
    const s = latest(updates);
    expect(s.stories.length).toBeLessThanOrEqual(300);
    expect(s.stories[0].length).toBeLessThanOrEqual(500);
  });

  it('sanitizes a malicious state-sync instead of adopting it wholesale', async () => {
    // Fresh protocol with no known peers so state-sync applies
    vi.resetModules();
    const fresh = await makeProtocol('u9', 'Nine');
    vi.advanceTimersByTime(1);

    mockRoom.triggerAction('state-sync', { state: {
      roomId: 'SPOOFED',
      stories: [null, { evil: true }, 'ok'],
      currentIndex: 'NaN-ish',
      storyTitle: 42,
      phase: 'not-a-phase',
      votes: { u8: '<script>' },
      participants: { u8: { id: 'u8', name: 123, online: 'maybe', extra: 'field' } },
      roundId: { obj: true },
      autoReveal: 'nope',
    } });

    const s = latest(fresh.updates);
    expect(s.roomId).toBe('ROOM-TEST');           // own roomId kept
    expect(s.stories).toEqual(['ok']);            // non-strings dropped
    expect(s.currentIndex).toBe(-1);
    expect(s.storyTitle).toBe('');
    expect(s.phase).toBe('waiting');
    expect(s.votes['u8']).toBe(null);             // invalid card nulled
    expect(s.participants['u8'].name).toBe('Anon');
    expect(s.participants['u8'].extra).toBeUndefined();
    expect(typeof s.roundId).toBe('string');
    fresh.proto.destroy();
  });
});
