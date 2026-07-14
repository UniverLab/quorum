// Reaction system — contextual kaomoji reactions after vote reveals.
// Analyzes vote consensus/dispersion to produce fitting reactions.

// ── Reaction kaomojis ──────────────────────────────────────────

const REACTIONS = {
  consensus: [
    '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(◕‿◕)', '(★ω★)', '(◠‿◠)', '(b ᵔ▽ᵔ)b',
    'ヾ(´〇`)ﾉ♪♪♪', '(っ▀¯▀)つ', '(◕‿◕ʃ♡)',
  ],
  surprise: [
    '(⊙_◎)', '(ʘ_ʘ)', '(°□°)', '(O_O)', '(゜ロ゜)',
    '(ﾟДﾟ)', '(⊙ω⊙)', '(°o°)', '(゜∀゜)',
  ],
  frustration: [
    '(╥﹏╥)', '(T﹏T)', '(×_×)', '(˘︹˘)', '(>_<)',
    '(╯°□°)╯︵ ┻━┻', '(ﾉಠ益ಠ)ノ彡┻━┻', '(ᗒᗣᗕ)՞',
  ],
  neutral: [
    '(·_·)', '(─.─|)', '(￣ω￣;)', '(ー_ー)丿', '(¬_¬)',
  ],
};

/**
 * Determine which reaction to show after a reveal.
 * @param {string} myId - current user ID
 * @param {object} votes - { peerId: cardValue }
 * @param {object} participants - { peerId: { name, ... } }
 * @returns {{ type: string, kaomoji: string, message: string }}
 */
export function computeReaction(myId, votes, participants) {
  const entries = Object.entries(votes).filter(([, v]) => v != null && v !== '?' && v !== '☕');
  if (entries.length < 2) {
    return { type: 'neutral', kaomoji: pickRandom(REACTIONS.neutral), message: '' };
  }

  const nums = entries.map(([, v]) => Number(v)).filter(n => !isNaN(n));
  if (nums.length < 2) {
    return { type: 'neutral', kaomoji: pickRandom(REACTIONS.neutral), message: '' };
  }

  const myVote = Number(votes[myId]);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const range = max - min;

  // Consensus: all numeric votes are identical
  const allSame = nums.every(n => n === nums[0]);
  if (allSame) {
    return {
      type: 'consensus',
      kaomoji: pickRandom(REACTIONS.consensus),
      message: 'Perfect consensus!',
    };
  }

  // Outlier: my vote is furthest from the average
  if (!isNaN(myVote)) {
    const myDist = Math.abs(myVote - avg);
    const maxDist = Math.max(...nums.map(n => Math.abs(n - avg)));
    if (myDist === maxDist && myDist > 0) {
      return {
        type: 'surprise',
        kaomoji: pickRandom(REACTIONS.surprise),
        message: 'You\'re the outlier!',
      };
    }
  }

  // High dispersion: range > 50% of max vote
  if (range > max * 0.5 && max > 3) {
    return {
      type: 'frustration',
      kaomoji: pickRandom(REACTIONS.frustration),
      message: 'Wide spread — needs discussion!',
    };
  }

  return { type: 'neutral', kaomoji: pickRandom(REACTIONS.neutral), message: '' };
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
