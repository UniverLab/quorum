import { createProtocol } from '../protocol.js';
import { getUserId, getUserName, setUserName } from '../identity.js';
import { computeStats } from '../state.js';

const DECK = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

export function renderRoom(root, roomId) {
  const name = getUserName();
  if (!name) {
    renderNameModal(root, roomId);
    return;
  }
  startRoom(root, roomId, getUserId(), name);
}

// ── Name modal ────────────────────────────────────────────────────────────────

function renderNameModal(root, roomId) {
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <p class="modal-room">Room <span class="mono">${roomId}</span></p>
        <h2>What's your name?</h2>
        <input id="name-input" type="text" placeholder="Your name" maxlength="32" autocomplete="nickname" />
        <button id="btn-enter">Join room</button>
      </div>
    </div>
  `;

  function submit() {
    const name = root.querySelector('#name-input').value.trim();
    if (!name) return;
    setUserName(name);
    startRoom(root, roomId, getUserId(), name);
  }

  root.querySelector('#btn-enter').addEventListener('click', submit);
  root.querySelector('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  root.querySelector('#name-input').focus();
}

// ── Room shell ────────────────────────────────────────────────────────────────

function startRoom(root, roomId, userId, userName) {
  let protocol = null;
  let countdownTimer = null;
  let prevPhase = null;

  root.innerHTML = `
    <div class="room">
      <header class="room-header">
        <span class="room-logo">Quorum</span>
        <button class="room-code" id="btn-code" title="Click to copy link">${escHtml(roomId)}</button>
        <span class="conn-dot" id="conn-dot"></span>
        <span class="conn-label" id="conn-label">connecting…</span>
      </header>
      <main id="room-main" class="room-main"></main>
    </div>
  `;

  const mainEl   = root.querySelector('#room-main');
  const codeBtn  = root.querySelector('#btn-code');
  const connDot  = root.querySelector('#conn-dot');
  const connLabel = root.querySelector('#conn-label');

  codeBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => {});
    codeBtn.textContent = 'copied!';
    setTimeout(() => { codeBtn.textContent = roomId; }, 2000);
  });

  function onCountdown() {
    if (countdownTimer) return;
    mainEl.innerHTML = `
      <section class="countdown-screen">
        ${state() && state().storyTitle
          ? `<h2 class="story-title">${escHtml(state().storyTitle)}</h2>`
          : ''}
        <div class="countdown-wrap">
          <span class="countdown-num" id="cnum">3</span>
        </div>
      </section>
    `;
    let n = 3;
    countdownTimer = setInterval(() => {
      n--;
      const el = mainEl.querySelector('#cnum');
      if (el) el.textContent = n > 0 ? n : '✓';
      if (n <= 0) { clearInterval(countdownTimer); countdownTimer = null; }
    }, 1_000);
  }

  function state() { return protocol?.getState(); }

  function onUpdate(s) {
    const online = Object.values(s.participants).filter(p => p.id !== userId && p.online !== false).length;
    const total  = online + 1;
    connDot.className   = `conn-dot ${online > 0 ? 'on' : 'alone'}`;
    connLabel.textContent = online === 0 ? 'alone — share the link' : `${total} online`;

    // If countdown is running, don't clobber it
    if (countdownTimer) return;

    const phaseChanged = s.phase !== prevPhase;
    prevPhase = s.phase;

    switch (s.phase) {
      case 'waiting':  renderWaiting(mainEl, s, userId, protocol, phaseChanged); break;
      case 'voting':   renderVoting(mainEl, s, userId, protocol, phaseChanged);  break;
      case 'revealed': renderRevealed(mainEl, s, userId, protocol);              break;
    }
  }

  protocol = createProtocol(roomId, userId, userName, onUpdate, onCountdown);
}

// ── Phase: waiting ────────────────────────────────────────────────────────────

function renderWaiting(el, s, userId, protocol, force) {
  const peers = Object.values(s.participants);
  const queueInfo = s.stories.length > 0
    ? `<p class="queue-info">${s.stories.length} stories loaded · ${
        s.currentIndex < 0 ? 'first up next' : `story ${s.currentIndex + 1} of ${s.stories.length}`
      }</p>`
    : '';

  // Only re-render full HTML on phase entry; otherwise just update participant list
  if (force || !el.querySelector('.waiting')) {
    el.innerHTML = `
      <section class="waiting">
        <div class="story-row">
          <input id="story-input" class="story-input" type="text"
            placeholder="Story title (optional)" value="${escHtml(s.storyTitle)}" />
        </div>
        ${queueInfo}
        <div class="waiting-actions">
          <button id="btn-load" class="btn-ghost">Load stories</button>
          <button id="btn-start">Start voting</button>
        </div>
        <div id="load-panel" class="load-panel hidden">
          <textarea id="stories-ta" rows="6"
            placeholder="Paste stories, one per line&#10;&#10;User login&#10;Password reset&#10;Dashboard charts"></textarea>
          <div class="load-panel-actions">
            <button id="btn-load-cancel" class="btn-ghost">Cancel</button>
            <button id="btn-load-confirm">Load</button>
          </div>
        </div>
        <div class="peer-list" id="peer-list"></div>
      </section>
    `;

    el.querySelector('#btn-start').addEventListener('click', () => {
      const title = el.querySelector('#story-input').value.trim();
      protocol.startVoting(title);
    });

    el.querySelector('#btn-load').addEventListener('click', () => {
      el.querySelector('#load-panel').classList.toggle('hidden');
    });

    el.querySelector('#btn-load-confirm').addEventListener('click', () => {
      const text = el.querySelector('#stories-ta').value;
      if (text.trim()) protocol.loadStories(text);
      el.querySelector('#load-panel').classList.add('hidden');
    });

    el.querySelector('#btn-load-cancel').addEventListener('click', () => {
      el.querySelector('#load-panel').classList.add('hidden');
    });
  }

  // Always update peer list
  const peerList = el.querySelector('#peer-list');
  if (peerList) {
    peerList.innerHTML = `
      <h3>In room (${peers.length})</h3>
      <ul>
        ${peers.map(p => `
          <li class="${p.online === false ? 'offline' : ''}">
            <span class="pdot"></span>
            ${escHtml(p.name)}${p.id === userId ? ' <span class="you">(you)</span>' : ''}
          </li>
        `).join('')}
      </ul>
      ${peers.length === 1 ? `<p class="alone-hint">Share the link above to invite others</p>` : ''}
    `;
  }
}

// ── Phase: voting ─────────────────────────────────────────────────────────────

function renderVoting(el, s, userId, protocol, force) {
  const peers  = Object.values(s.participants);
  const myVote = s.votes[userId];
  const votedCount = peers.filter(p => s.votes[p.id] != null && p.online !== false).length;
  const totalOnline = peers.filter(p => p.online !== false).length;

  if (force || !el.querySelector('.voting')) {
    el.innerHTML = `
      <section class="voting">
        ${s.storyTitle ? `<h2 class="story-title">${escHtml(s.storyTitle)}</h2>` : ''}
        <div class="vote-progress" id="vote-progress"></div>
        <div class="participant-cards" id="pcards"></div>
        <div class="auto-row">
          <label class="toggle-label">
            <span class="toggle-track">
              <input type="checkbox" id="auto-toggle" ${s.autoReveal ? 'checked' : ''} />
              <span class="toggle-thumb"></span>
            </span>
            Auto-reveal
          </label>
          <button id="btn-reveal" class="${s.autoReveal ? 'hidden' : ''}">Reveal</button>
        </div>
        <div class="deck" id="deck"></div>
      </section>
    `;

    el.querySelector('#auto-toggle').addEventListener('change', e => {
      protocol.setAutoReveal(e.target.checked);
    });

    el.querySelector('#btn-reveal')?.addEventListener('click', () => {
      protocol.reveal();
    });
  } else {
    // Update auto-reveal toggle state
    const toggle = el.querySelector('#auto-toggle');
    const revealBtn = el.querySelector('#btn-reveal');
    if (toggle) toggle.checked = s.autoReveal;
    if (revealBtn) revealBtn.classList.toggle('hidden', s.autoReveal);
  }

  // Update participant cards
  const pcards = el.querySelector('#pcards');
  if (pcards) {
    pcards.innerHTML = peers.map(p => {
      const voted   = s.votes[p.id] != null;
      const offline = p.online === false;
      return `
        <div class="pcard ${voted ? 'voted' : ''} ${offline ? 'offline' : ''}">
          <div class="pcard-face">
            ${voted ? '<span class="pcard-check">✓</span>' : ''}
          </div>
          <span class="pcard-name">${escHtml(p.name)}</span>
        </div>
      `;
    }).join('');
  }

  // Update progress
  const prog = el.querySelector('#vote-progress');
  if (prog) prog.textContent = `${votedCount} / ${totalOnline} voted`;

  // Update deck (only highlights, avoid full re-render to preserve feel)
  const deckEl = el.querySelector('#deck');
  if (deckEl && !deckEl.children.length) {
    deckEl.innerHTML = DECK.map(card => `
      <button class="card ${myVote === card ? 'selected' : ''}" data-card="${card}">${card}</button>
    `).join('');

    deckEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-card]');
      if (btn) protocol.vote(btn.dataset.card);
    });
  } else if (deckEl) {
    deckEl.querySelectorAll('.card').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.card === myVote);
    });
  }
}

// ── Phase: revealed ───────────────────────────────────────────────────────────

function renderRevealed(el, s, userId, protocol) {
  const peers = Object.values(s.participants);
  const stats = computeStats(s.votes);
  const hasNextStory = s.stories.length > 0 && s.currentIndex < s.stories.length - 1;

  el.innerHTML = `
    <section class="revealed">
      ${s.storyTitle ? `<h2 class="story-title">${escHtml(s.storyTitle)}</h2>` : ''}

      <div class="revealed-cards">
        ${peers.map(p => {
          const vote    = s.votes[p.id];
          const offline = p.online === false;
          return `
            <div class="rcard ${offline ? 'offline' : ''}">
              <div class="rcard-value">${escHtml(vote ?? '—')}</div>
              <span class="rcard-name">${escHtml(p.name)}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="stats">
        <div class="stat"><span class="stat-label">avg</span><strong>${stats.avg}</strong></div>
        <div class="stat"><span class="stat-label">min</span><strong>${stats.min}</strong></div>
        <div class="stat"><span class="stat-label">max</span><strong>${stats.max}</strong></div>
      </div>

      <div class="revealed-actions">
        <button id="btn-next-round" class="btn-ghost">New round</button>
        <button id="btn-new-story">${hasNextStory ? 'Next story →' : 'New story'}</button>
      </div>
    </section>
  `;

  el.querySelector('#btn-next-round').addEventListener('click', () => protocol.nextRound());
  el.querySelector('#btn-new-story').addEventListener('click', () => protocol.newStory());
}

// ── Util ──────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
