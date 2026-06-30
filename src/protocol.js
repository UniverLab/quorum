import { joinRoom } from 'trystero/torrent';
import { createInitialState, getAllVoted } from './state.js';

const APP_ID         = 'quorum-univerlab-v1';
const HEARTBEAT_MS   = 5_000;
const PEER_TIMEOUT_MS = 15_000;

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

  const room = joinRoom({ appId: APP_ID }, roomId);

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
    onCountdown?.();
    revealTimeout = setTimeout(() => {
      revealTimeout = null;
      state.phase = 'revealed';
      revealPending = false;
      emit();
    }, 3_000);
  }

  function checkAutoReveal() {
    if (state.autoReveal && state.phase === 'voting' && getAllVoted(state)) {
      sendReveal({ roundId: state.roundId });
      triggerReveal();
    }
  }

  // ── Trystero peer lifecycle ───────────────────────────────────────────────

  room.onPeerJoin((peerId) => {
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
    if (!isObj(p) || typeof p.id !== 'string') return;
    peerMap.set(peerId, p.id);
    // Build the record from known fields only — never spread peer-controlled
    // keys (a peer could otherwise inject online/lastSeen for others).
    const name = typeof p.name === 'string' ? p.name : 'Anon';
    state.participants[p.id] = { id: p.id, name, lastSeen: Date.now(), online: true };
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
    state = { ...incoming };
    // Re-assert self
    state.participants[userId] = { ...self, lastSeen: Date.now(), online: true };
    if (state.votes[userId] === undefined) state.votes[userId] = null;
    revealPending = false;
    emit();
  });

  getVote((data) => {
    if (!isObj(data)) return;
    const { participantId, card, roundId } = data;
    if (roundId !== state.roundId) return;
    // Ignore votes from peers we don't know — no writing arbitrary vote keys.
    if (!state.participants[participantId]) return;
    state.votes[participantId] = card;
    emit();
    checkAutoReveal();
  });

  getReveal(({ roundId }) => {
    if (roundId !== state.roundId || state.phase !== 'voting') return;
    triggerReveal();
  });

  getNextRound(({ roundId }) => {
    cancelReveal();
    state.roundId = roundId;
    state.phase = 'voting';
    clearVotes();
    emit();
  });

  getNewStory(({ index, title, roundId }) => {
    cancelReveal();
    state.roundId = roundId;
    state.currentIndex = index;
    state.storyTitle = title;
    state.phase = 'voting';
    clearVotes();
    emit();
  });

  getStoriesLoad((data) => {
    const stories = isObj(data) ? data.stories : null;
    if (!Array.isArray(stories)) return;
    state.stories = stories.filter((s) => typeof s === 'string');
    state.currentIndex = -1;
    emit();
  });

  getAutoReveal((data) => {
    if (!isObj(data) || typeof data.enabled !== 'boolean') return;
    state.autoReveal = data.enabled;
    emit();
  });

  getLeave(({ participantId }) => {
    if (state.participants[participantId]) {
      state.participants[participantId] = { ...state.participants[participantId], online: false };
      emit();
    }
  });

  getHeartbeat(({ participantId }) => {
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
      revealPending = false;
      clearVotes();
      sendNewStory({ index: state.currentIndex, title, roundId: newRoundId });
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
      sendNewStory({ index: newIndex, title, roundId: newRoundId });
      emit();
    },

    loadStories(text) {
      const stories = text.split('\n').map(s => s.trim()).filter(Boolean);
      state.stories = stories;
      state.currentIndex = -1;
      sendStoriesLoad({ stories });
      emit();
    },

    setAutoReveal(enabled) {
      state.autoReveal = enabled;
      sendAutoReveal({ enabled });
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
