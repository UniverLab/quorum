import { joinRoom } from 'trystero/torrent';
import { createInitialState, getAllVoted, DECK } from './state.js';

const APP_ID         = 'quorum-univerlab-v1';
const HEARTBEAT_MS   = 5_000;
const PEER_TIMEOUT_MS = 15_000;

// Abuse limits — a malicious peer can send arbitrary payloads, so every
// peer-controlled string and collection is bounded before touching state.
const MAX_ID_LEN    = 64;
const MAX_NAME_LEN  = 40;
const MAX_TITLE_LEN = 500;
const MAX_STORIES   = 300;
const MAX_PEERS     = 50;

const VALID_PHASES = ['waiting', 'voting', 'revealed'];

const cleanName = (n) =>
  typeof n === 'string' && n.trim() ? n.trim().slice(0, MAX_NAME_LEN) : 'Anon';

const cleanStories = (arr) =>
  Array.isArray(arr)
    ? arr.filter((s) => typeof s === 'string').slice(0, MAX_STORIES).map((s) => s.slice(0, MAX_TITLE_LEN))
    : [];

const isValidId = (id) => typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LEN;
const isCard    = (c) => c == null || DECK.includes(c);

/**
 * @param {string} roomId
 * @param {string} userId
 * @param {string} userName
 * @param {(state: object) => void} onUpdate
 * @param {() => void} onCountdown  called when auto-reveal triggers (3 s before revealed)
 */
export function createProtocol(roomId, userId, userName, onUpdate, onCountdown) {
  let state = createInitialState(roomId);
  let revealPending = false;
  let revealTimeout = null;
  let hbTimer = null;

  const self = { id: userId, name: userName, lastSeen: Date.now(), online: true };
  state.participants[userId] = { ...self };
  state.votes[userId] = null;

  // `password` derives an encryption key for the signaling payloads relayed
  // through public trackers: a tracker (or anyone sniffing it) that does not
  // know the room ID cannot read or tamper with the WebRTC handshake.
  const room = joinRoom({ appId: APP_ID, password: roomId }, roomId);

  const [sendJoin,         getJoin]         = room.makeAction('join');
  const [sendStateSync,    getStateSync]    = room.makeAction('state-sync');
  const [sendVote,         getVote]         = room.makeAction('vote');
  const [sendReveal,       getReveal]       = room.makeAction('reveal');
  const [sendNextRound,    getNextRound]    = room.makeAction('next-round');
  const [sendNewStory,     getNewStory]     = room.makeAction('new-story');
  const [sendStoriesLoad,  getStoriesLoad]  = room.makeAction('stories-load');
  const [sendAutoReveal,   getAutoReveal]   = room.makeAction('auto-reveal');
  const [sendLeave,        getLeave]        = room.makeAction('leave');
  const [sendHeartbeat,    getHeartbeat]    = room.makeAction('heartbeat');

  // Maps Trystero peer ID → app-level userId
  const peerMap = new Map();

  function snapshot() {
    return {
      ...state,
      participants: { ...state.participants },
      votes: { ...state.votes },
    };
  }

  function emit() { onUpdate(snapshot()); }

  function clearVotes() {
    const v = {};
    Object.keys(state.participants).forEach(id => { v[id] = null; });
    state.votes = v;
  }

  function cancelReveal() {
    clearTimeout(revealTimeout);
    revealTimeout = null;
    revealPending = false;
  }

  function triggerReveal() {
    if (revealPending) return;
    revealPending = true;
    const result = onCountdown?.();
    // If onCountdown returns a number (animation duration ms), use it; else 3s fallback
    const animDuration = typeof result === 'number' ? result : 3_000;
    revealTimeout = setTimeout(() => {
      revealTimeout = null;
      state.phase = 'revealed';
      revealPending = false;
      emit();
    }, animDuration);
  }

  function checkAutoReveal() {
    if (state.autoReveal && state.phase === 'voting' && getAllVoted(state)) {
      sendReveal({ roundId: state.roundId });
      triggerReveal();
    }
  }

  // ── Trystero peer lifecycle ───────────────────────────────────────────────

  room.onPeerJoin((peerId) => {
    // Introduce ourselves directly — the new peer needs our peerId→userId
    // mapping to accept our votes/heartbeats (identity checks below).
    sendJoin({ participant: self }, peerId);
    // Send current state directly to the new peer
    sendStateSync({ state: snapshot() }, peerId);
  });

  room.onPeerLeave((peerId) => {
    const uid = peerMap.get(peerId);
    if (uid && state.participants[uid]) {
      state.participants[uid] = { ...state.participants[uid], online: false };
      peerMap.delete(peerId);
      emit();
    }
  });

  // ── Incoming events ───────────────────────────────────────────────────────
  // Peers are untrusted input: every handler validates its payload and drops
  // anything malformed rather than corrupting local state.

  const isObj = (x) => x !== null && typeof x === 'object';

  getJoin((data, peerId) => {
    const p = isObj(data) ? data.participant : null;
    if (!isObj(p) || !isValidId(p.id)) return;
    // Identity rules: nobody may claim our own id, and an id already bound to
    // another live connection cannot be hijacked. A binding whose participant
    // has gone offline is reclaimable (legitimate reconnect).
    if (p.id === userId) return;
    for (const [pid, uid] of peerMap) {
      if (uid === p.id && pid !== peerId) {
        if (state.participants[p.id]?.online !== false) return;
        peerMap.delete(pid); // stale binding — reclaim
      }
    }
    // Cap the room size a single peer can inflate.
    if (!state.participants[p.id] && Object.keys(state.participants).length >= MAX_PEERS) return;
    peerMap.set(peerId, p.id);
    // Build the record from known fields only — never spread peer-controlled
    // keys (a peer could otherwise inject online/lastSeen for others).
    state.participants[p.id] = { id: p.id, name: cleanName(p.name), lastSeen: Date.now(), online: true };
    if (state.votes[p.id] === undefined) state.votes[p.id] = null;
    emit();
    // Respond directly to the joiner with latest state
    sendStateSync({ state: snapshot() }, peerId);
  });

  getStateSync((data) => {
    // Only apply if we have no other known peers yet (fresh joiner)
    const knownOthers = Object.keys(state.participants).filter(id => id !== userId);
    if (knownOthers.length > 0) return;

    const incoming = isObj(data) ? data.state : null;
    if (!isObj(incoming) || !isObj(incoming.participants) || !isObj(incoming.votes)) return;

    // Rebuild the state field by field — never adopt a peer's object wholesale.
    const participants = {};
    for (const p of Object.values(incoming.participants).slice(0, MAX_PEERS)) {
      if (!isObj(p) || !isValidId(p.id)) continue;
      participants[p.id] = { id: p.id, name: cleanName(p.name), lastSeen: Date.now(), online: p.online !== false };
    }
    const votes = {};
    for (const id of Object.keys(participants)) {
      votes[id] = isCard(incoming.votes[id]) ? incoming.votes[id] ?? null : null;
    }
    state = {
      roomId,
      stories: cleanStories(incoming.stories),
      currentIndex: Number.isInteger(incoming.currentIndex) ? incoming.currentIndex : -1,
      storyTitle: typeof incoming.storyTitle === 'string' ? incoming.storyTitle.slice(0, MAX_TITLE_LEN) : '',
      phase: VALID_PHASES.includes(incoming.phase) ? incoming.phase : 'waiting',
      votes,
      participants,
      roundId: isValidId(incoming.roundId) ? incoming.roundId : crypto.randomUUID(),
      autoReveal: incoming.autoReveal !== false,
    };
    // Re-assert self
    state.participants[userId] = { ...self, lastSeen: Date.now(), online: true };
    if (state.votes[userId] === undefined) state.votes[userId] = null;
    revealPending = false;
    emit();
  });

  getVote((data, peerId) => {
    if (!isObj(data)) return;
    const { participantId, card, roundId } = data;
    if (roundId !== state.roundId) return;
    // A peer may only vote as the identity it joined with, and only with a
    // card from the deck — no writing arbitrary vote keys or values.
    if (peerMap.get(peerId) !== participantId) return;
    if (!state.participants[participantId] || !isCard(card)) return;
    state.votes[participantId] = card ?? null;
    emit();
    checkAutoReveal();
  });

  getReveal((data) => {
    if (!isObj(data)) return;
    if (data.roundId !== state.roundId || state.phase !== 'voting') return;
    triggerReveal();
  });

  getNextRound((data) => {
    if (!isObj(data) || !isValidId(data.roundId)) return;
    cancelReveal();
    state.roundId = data.roundId;
    state.phase = 'voting';
    clearVotes();
    emit();
  });

  getNewStory((data) => {
    if (!isObj(data) || !isValidId(data.roundId)) return;
    cancelReveal();
    state.roundId = data.roundId;
    state.currentIndex = Number.isInteger(data.index) ? data.index : -1;
    state.storyTitle = typeof data.title === 'string' ? data.title.slice(0, MAX_TITLE_LEN) : '';
    // Mirror the sender's phase: startVoting broadcasts 'voting', newStory
    // broadcasts 'waiting'. Without this every receiver jumped straight into
    // voting while the sender of newStory sat in the waiting screen.
    state.phase = data.phase === 'waiting' ? 'waiting' : 'voting';
    clearVotes();
    emit();
  });

  getStoriesLoad((data) => {
    const stories = isObj(data) ? data.stories : null;
    if (!Array.isArray(stories)) return;
    state.stories = cleanStories(stories);
    state.currentIndex = -1;
    emit();
  });

  getAutoReveal((data) => {
    if (!isObj(data) || typeof data.enabled !== 'boolean') return;
    state.autoReveal = data.enabled;
    emit();
  });

  getLeave((data, peerId) => {
    if (!isObj(data)) return;
    const { participantId } = data;
    // Only the owner of an identity can announce its departure.
    if (peerMap.get(peerId) !== participantId) return;
    if (state.participants[participantId]) {
      state.participants[participantId] = { ...state.participants[participantId], online: false };
      emit();
    }
  });

  getHeartbeat((data, peerId) => {
    if (!isObj(data)) return;
    const { participantId } = data;
    // Only the owner of an identity can keep it alive.
    if (peerMap.get(peerId) !== participantId) return;
    if (state.participants[participantId]) {
      const wasOnline = state.participants[participantId].online !== false;
      state.participants[participantId] = {
        ...state.participants[participantId],
        lastSeen: Date.now(),
        online: true,
      };
      if (!wasOnline) emit();
    }
  });

  // ── Heartbeat loop ────────────────────────────────────────────────────────

  hbTimer = setInterval(() => {
    sendHeartbeat({ participantId: userId });
    state.participants[userId] = { ...state.participants[userId], lastSeen: Date.now() };

    const now = Date.now();
    let changed = false;
    Object.values(state.participants).forEach(p => {
      if (p.id === userId) return;
      const wasOnline = p.online !== false;
      const nowOnline = now - p.lastSeen <= PEER_TIMEOUT_MS;
      if (wasOnline !== nowOnline) {
        state.participants[p.id] = { ...p, online: nowOnline };
        changed = true;
      }
    });
    if (changed) emit();
  }, HEARTBEAT_MS);

  // Announce presence (deferred so caller can assign protocol ref first)
  setTimeout(() => {
    sendJoin({ participant: self });
    emit();
  }, 0);

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    getState: () => snapshot(),

    startVoting(title) {
      const newRoundId = crypto.randomUUID();
      state.storyTitle = title;
      state.phase = 'voting';
      state.roundId = newRoundId;
      const idx = state.stories.indexOf(title);
      state.currentIndex = idx;
      state.storyId = idx >= 0 ? state.storyIds[idx] : null;
      revealPending = false;
      clearVotes();
      sendNewStory({ index: state.currentIndex, title, roundId: newRoundId, phase: 'voting' });
      emit();
    },

    vote(card) {
      if (state.phase !== 'voting') return;
      state.votes[userId] = card;
      sendVote({ participantId: userId, card, roundId: state.roundId });
      emit();
      checkAutoReveal();
    },

    reveal() {
      if (state.phase !== 'voting' || revealPending) return;
      sendReveal({ roundId: state.roundId });
      triggerReveal();
    },

    nextRound() {
      const newRoundId = crypto.randomUUID();
      cancelReveal();
      state.roundId = newRoundId;
      state.phase = 'voting';
      clearVotes();
      sendNextRound({ roundId: newRoundId });
      emit();
    },

    newStory() {
      const newIndex = state.currentIndex < 0 ? 0 : state.currentIndex + 1;
      const title = state.stories[newIndex] ?? '';
      const newRoundId = crypto.randomUUID();
      cancelReveal();
      state.roundId = newRoundId;
      state.currentIndex = newIndex;
      state.storyTitle = title;
      state.phase = 'waiting';
      clearVotes();
      sendNewStory({ index: newIndex, title, roundId: newRoundId, phase: 'waiting' });
      emit();
    },

    nextStory() {
      const newIndex = state.currentIndex + 1;
      if (newIndex >= state.stories.length) return;
      const title = state.stories[newIndex];
      const newRoundId = crypto.randomUUID();
      cancelReveal();
      state.roundId = newRoundId;
      state.currentIndex = newIndex;
      state.storyTitle = title;
      state.phase = 'voting';
      clearVotes();
      sendNewStory({ index: newIndex, title, roundId: newRoundId, phase: 'voting' });
      emit();
    },

    loadStories(text, newCurrentIndex) {
      const stories = text.split('\n').map(s => s.trim()).filter(Boolean);
      // Generate IDs for new stories, keep existing ones
      const newIds = stories.map((s, i) => {
        // Keep existing ID if story at same index has same title
        if (state.storyIds[i] && state.stories[i] === s) {
          return state.storyIds[i];
        }
        // Generate new ID for new or changed stories
        return crypto.randomUUID();
      });
      state.stories = stories;
      state.storyIds = newIds;
      if (newCurrentIndex !== undefined) {
        state.currentIndex = newCurrentIndex;
      } else {
        state.currentIndex = -1;
      }
      sendStoriesLoad({ stories });
      emit();
    },

    setAutoReveal(enabled) {
      state.autoReveal = enabled;
      sendAutoReveal({ enabled });
      emit();
    },

    backToWaiting() {
      cancelReveal();
      state.phase = 'waiting';
      state.storyTitle = '';
      state.votes = {};
      emit();
    },

    destroy() {
      cancelReveal();
      clearInterval(hbTimer);
      sendLeave({ participantId: userId });
      // Tear down the Trystero room: close peer connections and detach all
      // onPeerJoin/getX listeners. Without this they leak on SPA navigation.
      room.leave();
    },
  };
}
