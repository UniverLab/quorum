/** The only card values a vote may carry — shared by UI and protocol validation. */
export const DECK = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

export function createInitialState(roomId) {
  return {
    roomId,
    stories: [],
    storyIds: [],
    currentIndex: -1,
    storyTitle: '',
    storyId: null,
    phase: 'waiting',
    votes: {},
    participants: {},
    roundId: crypto.randomUUID(),
    autoReveal: true,
  };
}

export function getOnlinePeers(state) {
  return Object.values(state.participants).filter(p => p.online !== false);
}

export function getAllVoted(state) {
  const online = getOnlinePeers(state);
  return online.length > 0 && online.every(p => state.votes[p.id] != null);
}

export function computeStats(votes) {
  const nums = Object.values(votes)
    .filter(v => v != null && !isNaN(Number(v)))
    .map(Number);

  if (!nums.length) return { avg: '—', min: '—', max: '—' };
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  return { avg, min: Math.min(...nums), max: Math.max(...nums) };
}
