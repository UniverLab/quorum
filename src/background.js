// Fibonacci spiral background — golden ratio tiling with per-peer sparks
const K = Math.log(1.618) / (Math.PI / 2);
const COLOR_NIGHT = '#d6ad5a';
const COLOR_DAY = '#b58d39';
const BG_NIGHT = '#201a16';
const BG_DAY = '#ece7de';

function getColor() {
  return document.documentElement.getAttribute('data-theme') === 'arena'
    ? COLOR_DAY
    : COLOR_NIGHT;
}

function getBg() {
  return document.documentElement.getAttribute('data-theme') === 'arena'
    ? BG_DAY
    : BG_NIGHT;
}

function isDay() {
  return document.documentElement.getAttribute('data-theme') === 'arena';
}

let canvas, c, w, h, dpr;
const peerSparks = new Map(); // peerId → spark

// ── Reveal mode state ──────────────────────────────────────────────────────
let revealMode = false;
let revealStartTime = 0;
let revealCenterX = 0, revealCenterY = 0, revealRadius = 0;
let revealCardPositions = []; // array of {x, y} for each card
const revealParticles = [];

// Seeded random from peer ID string
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function seededRand(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}

function init() {
  canvas = document.createElement('canvas');
  canvas.className = 'bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  c = canvas.getContext('2d');
  if (!c) return;

  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => traceAt(e.clientX, e.clientY), { passive: true });
  animate();
}

function resize() {
  w = canvas.clientWidth;
  h = canvas.clientHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!plate) {
    plate = document.createElement('canvas'); pc = plate.getContext('2d');
    trace = document.createElement('canvas'); tc = trace.getContext('2d');
  }
  plate.width = trace.width = canvas.width;
  plate.height = trace.height = canvas.height;
}

// Whirling squares tiling
function getSquares() {
  let bx = 0, by = 0, bw = 1, bh = 1;
  const squares = [{ x: 0, y: 0, s: 1 }];
  const dirs = ['left', 'top', 'right', 'bottom'];
  for (let i = 0; i < 8; i++) {
    const d = dirs[i % 4];
    if (d === 'left') { const s = bh; bx -= s; bw += s; squares.push({ x: bx, y: by, s }); }
    else if (d === 'top') { const s = bw; by -= s; bh += s; squares.push({ x: bx, y: by, s }); }
    else if (d === 'right') { const s = bh; squares.push({ x: bx + bw, y: by, s }); bw += s; }
    else { const s = bw; squares.push({ x: bx, y: by + bh, s }); bh += s; }
  }
  return { squares, bx, by, bw, bh };
}

const reflect = (q, lo, hi) => {
  const r = hi - lo;
  const m = (((q - lo) % (2 * r)) + 2 * r) % (2 * r);
  return m <= r ? lo + m : hi - (m - r);
};

const tiling = getSquares();
const pu = 0.0, pv = 0.5;
const rMin = 0.28;
const rMax = Math.max(tiling.bw, tiling.bh) * 0.5;
const thMax = Math.log(rMax / rMin) / K;

// ── Peer spark management ──────────────────────────────────────────────────

function makeSpark(peerId, t) {
  const rng = seededRand(hashId(peerId));
  return {
    alive: true,
    born: t,
    s0: 0.1 + rng() * 0.35,
    drift: -0.1 + rng() * 0.5,
    amp: 0.14 + rng() * 0.16,
    w1: 0.0004 + rng() * 0.0006,
    w2: 0.0009 + rng() * 0.0008,
    p1: rng() * 6.283,
    p2: rng() * 6.283,
    fadeOut: 0,
  };
}

/**
 * Call from room.js whenever participants change.
 */
window.setQuorumPeers = function (participants) {
  const now = performance.now();
  const onlineIds = new Set(
    participants.filter(p => p.online !== false).map(p => p.id)
  );

  for (const [id, sp] of peerSparks) {
    if (!onlineIds.has(id) && !sp.fadeOut) {
      sp.fadeOut = now;
    }
  }

  for (const id of onlineIds) {
    if (!peerSparks.has(id)) {
      peerSparks.set(id, makeSpark(id, now));
    } else {
      const sp = peerSparks.get(id);
      if (sp.fadeOut) sp.fadeOut = 0;
    }
  }
};

/**
 * Enter reveal mode: sparks converge toward center, particle rain begins.
 * @param {number} cx - center X in viewport coords
 * @param {number} cy - center Y in viewport coords
 * @param {number} radius - target area radius
 * @param {Array} cardPositions - array of {x, y} for each card
 */
window.startRevealMode = function (cx, cy, radius, cardPositions) {
  revealMode = true;
  revealStartTime = performance.now();
  revealCenterX = cx;
  revealCenterY = cy;
  revealRadius = radius;
  revealCardPositions = cardPositions || [];
  revealParticles.length = 0;
};

window.endRevealMode = function () {
  revealMode = false;
  revealParticles.length = 0;
};

// ── Particle rain ──────────────────────────────────────────────────────────

function makeParticle(sx, sy, tx, ty, t, rng) {
  const speed = 1.8 + rng() * 1.2; // 1.8–3.0 — very fast convergence
  const life = 300 + rng() * 500;   // short-lived, arrives quickly
  return {
    sx, sy, tx, ty,
    born: t,
    life,
    speed,
    noiseAmp: 6 + rng() * 14,
    noiseFreq1: 0.003 + rng() * 0.005,
    noiseFreq2: 0.007 + rng() * 0.01,
    noisePhase: rng() * 6.283,
    noisePhase2: rng() * 6.283,
    size: 0.4 + rng() * 1.1,
  };
}

function updateParticles(t) {
  // Spawn new particles from each spark to its paired card
  const elapsed = t - revealStartTime;
  const spawnRate = Math.min(1.2, 0.3 + elapsed * 0.0005);

  const sparkArray = Array.from(peerSparks.values()).filter(sp => !sp.fadeOut);
  const numCards = revealCardPositions.length;

  sparkArray.forEach((sp, sparkIdx) => {
    if (Math.random() < spawnRate) {
      // Get the spark's current spiral position (original trajectory)
      const lt = t - sp.born;
      let s = sp.s0 + sp.drift * Math.sin(lt * 0.0002) +
        sp.amp * (Math.sin(lt * sp.w1 + sp.p1) + 0.6 * Math.sin(lt * sp.w2 + sp.p2));
      s = reflect(s, 0.05, 0.95);
      const rHead = rMin + s * (rMax - rMin);
      const thHead = Math.log(rHead / rMin) / K;
      const S = (h * 0.82) / tiling.bh;
      const ox = w * 0.64 - (tiling.bx + tiling.bw / 2) * S;
      const oy = h * 0.5 - (tiling.by + tiling.bh / 2) * S;
      const sx = ox + (pu + rHead * Math.cos(thHead)) * S;
      const sy = oy + (pv + rHead * Math.sin(thHead)) * S;

      // Pair spark with card (round-robin if more sparks than cards)
      const cardIdx = numCards > 0 ? sparkIdx % numCards : 0;
      const target = numCards > 0 ? revealCardPositions[cardIdx] : { x: revealCenterX, y: revealCenterY };

      const rng = seededRand(hashId(`${sp.born}-${t}`));
      revealParticles.push(makeParticle(sx, sy, target.x, target.y, t, rng));
    }
  });

  // Remove dead particles
  for (let i = revealParticles.length - 1; i >= 0; i--) {
    const p = revealParticles[i];
    if (t - p.born > p.life) {
      revealParticles.splice(i, 1);
    }
  }
}

function drawParticles(t, color) {
  for (const p of revealParticles) {
    const age = t - p.born;
    const progress = Math.min(1, (age / p.life) * p.speed);
    const fadeIn = Math.min(1, age / 80);
    const fadeOut = Math.min(1, (p.life - age) / 150);
    const alpha = fadeIn * fadeOut;

    // Linear interpolation with noise
    const baseX = p.sx + (p.tx - p.sx) * progress;
    const baseY = p.sy + (p.ty - p.sy) * progress;

    // Perlin-like noise via layered sine
    const nx = Math.sin(age * p.noiseFreq1 + p.noisePhase) * p.noiseAmp * (1 - progress * 0.5) +
               Math.sin(age * p.noiseFreq2 + p.noisePhase2) * p.noiseAmp * 0.4;
    const ny = Math.cos(age * p.noiseFreq1 * 0.7 + p.noisePhase + 1.3) * p.noiseAmp * 0.7 * (1 - progress * 0.5) +
               Math.cos(age * p.noiseFreq2 * 1.1 + p.noisePhase2 + 2.1) * p.noiseAmp * 0.3;

    const x = baseX + nx;
    const y = baseY + ny;

    c.globalAlpha = alpha * 0.8;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, p.size, 0, Math.PI * 2);
    c.fill();
  }
}

// ── The board: the golden tiling is the deck ─────────────────────────────
// The tiling's squares measure 1, 1, 2, 3, 5, 8, 13, 21, 34: Quorum's Fibonacci deck. At rest the
// board is the plain spiral and squares. Where the cursor passes, the draughtsman's plate shows
// through (each square's number, corner points, midpoint ticks) and fades back after a while.
// On reveal the voted squares take a faint wash of the accent. Votes are never shown before the
// reveal: room.js only passes them in the 'revealed' phase.
const SQUARE_OF = { 1: 1, 2: 2, 3: 3, 5: 4, 8: 5, 13: 6, 21: 7 };   // card value → tiling.squares index
const TRACE_RADIUS = 150, TRACE_DRY = 0.008;
const board = { phase: 'waiting', lit: new Map(), litAt: 0, consensus: null };
let plate, pc, trace, tc;   // offscreen: the draughtsman's plate, and where the cursor has passed

/** Call from room.js on every state update. `votes` only in the 'revealed' phase. */
window.setQuorumBoard = function (phase, votes) {
  if (phase !== 'revealed') { board.lit.clear(); board.consensus = null; }
  if (phase === 'revealed' && votes && board.phase !== 'revealed') {
    const nums = Object.values(votes).filter((v) => v != null && SQUARE_OF[v] != null);
    board.lit.clear();
    for (const v of nums) board.lit.set(SQUARE_OF[v], (board.lit.get(SQUARE_OF[v]) || 0) + 1);
    board.litAt = performance.now();
    board.consensus = nums.length > 1 && nums.every((v) => v === nums[0]) ? SQUARE_OF[nums[0]] : null;
  }
  board.phase = phase;
};

function traceAt(x, y) {
  if (!tc) return;
  tc.setTransform(dpr, 0, 0, dpr, 0, 0);
  tc.globalCompositeOperation = 'source-over';
  const g = tc.createRadialGradient(x, y, 0, x, y, TRACE_RADIUS);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  tc.fillStyle = g;
  tc.fillRect(x - TRACE_RADIUS, y - TRACE_RADIUS, TRACE_RADIUS * 2, TRACE_RADIUS * 2);
}

function drawBoard(t, toX, toY, S, A, day) {
  const base = revealMode ? (day ? 0.34 : 0.22) : (day ? 0.24 : 0.12);
  const lit = Math.min(1, (t - board.litAt) / 700);

  // At rest: the squares, with a faint wash on the voted ones after a reveal.
  tiling.squares.forEach((q, k) => {
    const x = toX(q.x), y = toY(q.y), side = q.s * S;
    const votes = board.lit.get(k) || 0;
    if (votes) {
      c.fillStyle = A;
      c.globalAlpha = lit * (k === board.consensus ? (day ? 0.14 : 0.11) : Math.min(day ? 0.1 : 0.08, 0.03 + 0.02 * votes));
      c.fillRect(x, y, side, side);
    }
    c.strokeStyle = A; c.lineWidth = 1; c.globalAlpha = base;
    c.strokeRect(x, y, side, side);
  });

  // The draughtsman's plate, drawn offscreen and shown only where the cursor has been.
  if (pc) {
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, plate.width, plate.height);
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    pc.strokeStyle = A; pc.fillStyle = A; pc.lineWidth = 1; pc.globalAlpha = 1;
    tiling.squares.forEach((q) => {
      const x = toX(q.x), y = toY(q.y), side = q.s * S;
      for (const [cx, cy] of [[x, y], [x + side, y], [x, y + side], [x + side, y + side]]) { pc.beginPath(); pc.arc(cx, cy, 1.4, 0, Math.PI * 2); pc.fill(); }
      const tk = Math.min(6, side * 0.06);
      pc.beginPath();
      pc.moveTo(x + side / 2, y - tk); pc.lineTo(x + side / 2, y + tk);
      pc.moveTo(x + side / 2, y + side - tk); pc.lineTo(x + side / 2, y + side + tk);
      pc.moveTo(x - tk, y + side / 2); pc.lineTo(x + tk, y + side / 2);
      pc.moveTo(x + side - tk, y + side / 2); pc.lineTo(x + side + tk, y + side / 2);
      pc.stroke();
      const fs = Math.min(15, side * 0.09);
      if (fs >= 9) {
        pc.font = `italic ${fs}px "Old Standard TT", Georgia, serif`;
        pc.textBaseline = 'top';
        pc.fillText(String(q.s), x + fs * 0.5, y + fs * 0.4);
      }
    });
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'destination-out';
    tc.fillStyle = `rgba(0,0,0,${TRACE_DRY})`;
    tc.fillRect(0, 0, trace.width, trace.height);
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(trace, 0, 0);
    pc.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = day ? 0.55 : 0.45;
    c.drawImage(plate, 0, 0);
    c.restore();
  }

  // The golden spiral, as it always was.
  c.lineCap = 'round';
  c.strokeStyle = A;
  c.lineWidth = day ? 1.6 : 1.3;
  c.globalAlpha = revealMode ? (day ? 0.38 : 0.25) : (day ? 0.27 : 0.12);
  c.beginPath();
  for (let i = 0; i <= 220; i++) {
    const th = (i / 220) * thMax;
    const r = rMin * Math.exp(K * th);
    const x = toX(pu + r * Math.cos(th));
    const y = toY(pv + r * Math.sin(th));
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
  c.globalAlpha = 1;
}

// ── Animation loop ─────────────────────────────────────────────────────────

function getSparkPos(sp, t) {
  const lt = t - sp.born;
  let s = sp.s0 + sp.drift * Math.sin(lt * 0.0002) +
    sp.amp * (Math.sin(lt * sp.w1 + sp.p1) + 0.6 * Math.sin(lt * sp.w2 + sp.p2));
  s = reflect(s, 0.05, 0.95);
  const rHead = rMin + s * (rMax - rMin);
  const thHead = Math.log(rHead / rMin) / K;
  const S = (h * 0.82) / tiling.bh;
  const ox = w * 0.64 - (tiling.bx + tiling.bw / 2) * S;
  const oy = h * 0.5 - (tiling.by + tiling.bh / 2) * S;
  return {
    x: ox + (pu + rHead * Math.cos(thHead)) * S,
    y: oy + (pv + rHead * Math.sin(thHead)) * S,
  };
}

function animate(t) {
  requestAnimationFrame(animate);
  c.clearRect(0, 0, w, h);
  const A = getColor();
  const day = isDay();

  // Fill canvas with theme background
  c.fillStyle = getBg();
  c.fillRect(0, 0, w, h);

  // Fit tiling
  const S = (h * 0.82) / tiling.bh;
  const ox = w * 0.64 - (tiling.bx + tiling.bw / 2) * S;
  const oy = h * 0.5 - (tiling.by + tiling.bh / 2) * S;
  const toX = (u) => ox + u * S;
  const toY = (v) => oy + v * S;

  drawBoard(t, toX, toY, S, A, day);

  // Reveal mode: update particles (sparks keep original spiral path)
  if (revealMode) {
    updateParticles(t);
  }

  // Draw per-peer sparks — only on room pages
  const inRoom = document.body.classList.contains('is-room');
  if (inRoom) {
    const FADE_MS = 2000;
    for (const [id, sp] of peerSparks) {
      if (sp.fadeOut) {
        const fadeProgress = (t - sp.fadeOut) / FADE_MS;
        if (fadeProgress >= 1) {
          peerSparks.delete(id);
          continue;
        }
        sp._fadeAlpha = 1 - fadeProgress;
      } else {
        sp._fadeAlpha = 1;
      }

      const lt = t - sp.born;
      const fadeIn = Math.min(1, lt / 1200);
      const env = fadeIn * sp._fadeAlpha;

      // Get spiral position
      const spiral = getSparkPos(sp, t);

      // During reveal, sparks stay on spiral path — only particles move to center
      let hx = spiral.x;
      let hy = spiral.y;

      const tw = 0.7 + 0.3 * Math.sin(t * 0.004 + sp.p1);
      const baseRad = revealMode ? 10 : 8;
      const rad = baseRad * (0.8 + 0.2 * tw);

      const g = c.createRadialGradient(hx, hy, 0, hx, hy, rad);
      g.addColorStop(0, A + (revealMode ? 'ee' : 'cc'));
      g.addColorStop(0.35, A + (revealMode ? '55' : '33'));
      g.addColorStop(1, A + '00');
      c.globalAlpha = env;
      c.fillStyle = g;
      c.beginPath();
      c.arc(hx, hy, rad, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = A;
      c.globalAlpha = env * (0.5 + 0.35 * tw);
      c.beginPath();
      c.arc(hx, hy, revealMode ? 2 : 1.6, 0, Math.PI * 2);
      c.fill();
    }

    // Draw particle rain during reveal
    if (revealMode) {
      drawParticles(t, A);
    }
  }

  c.globalAlpha = 1;
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
}
