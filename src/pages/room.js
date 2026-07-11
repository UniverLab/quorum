import { createProtocol } from '../protocol.js';
import { getUserId, getUserName, setUserName } from '../identity.js';
import { computeStats } from '../state.js';
import { setCleanup, navigate } from '../router.js';

// Simple markdown renderer
function renderMd(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

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
        <a href="#" class="room-logo-link" id="btn-home">
          <svg class="room-logo-icon" width="20" height="20" viewBox="0 0 100 100" fill="currentColor">
            <path d="M 50.4,0.2 C 46.7,0.2 43,0.9 40.2,2.4 L 12.5,17.2 C 6.9,20.2 6.9,25 12.5,28 l 27.7,14.7 c 1.9,1 4.1,1.6 6.4,2 -0.01,-0.1 -0.01,-0.2 -0.01,-0.3 v -20.1 c 0,-1.9 1.7,-3.5 3.7,-3.5 2.1,0 3.7,1.6 3.7,3.5 v 20.1 c 0,0.1 0,0.2 0,0.3 2.3,-0.3 4.5,-1 6.4,-2 l 27.7,-14.8 c 5.6,-3 5.6,-7.8 0,-10.8 L 60.6,2.3 C 57.8,0.9 54.1,0.2 50.4,0.2 Z"/>
            <path d="m 97.4,76.5 c 1.8,-3 2.9,-6.3 2.9,-9.3 l 0.2,-29.6 c -0.01,-6 -4.5,-8.4 -10.1,-5.3 l -27.4,15.2 c -1.8,1 -3.6,2.5 -5,4.2 0.1,0 0.2,0.1 0.3,0.1 l 18.8,10 c 1.8,1 2.4,3.1 1.4,4.7 -1,1.7 -3.3,2.3 -5.1,1.3 l -18.8,-10 c -0.1,0 -0.2,0.1 -0.3,0.1 -0.8,2.1 -1.3,4.2 -1.3,6.2 l 0.1,29.7 c 0.01,6 4.5,8.4 10.1,5.3 l 27.4,-15.2 c 2.8,-1.5 5.3,-4.1 7.1,-7.1 z"/>
            <path d="M 3.1,76.5 C 1.3,73.5 0.2,70.2 0.2,67.2 L 0.2,37.6 C 0.3,31.6 4.8,29 10.3,32 l 27.4,15.2 c 1.8,1 3.6,2.5 5,4.2 -0.1,0 -0.2,0.1 -0.3,0.1 l -18.8,10 c -1.8,1 -2.4,3.1 -1.4,4.7 1,1.7 3.3,2.3 5.1,1.3 l 18.8,-10 c 0.1,0 0.2,0.1 0.3,0.1 0.8,2.1 1.3,4.2 1.3,6.2 l -0.1,29.7 c -0.01,6 -4.5,8.4 -10.1,5.3 L 10.2,83.6 C 7.4,82.1 4.9,79.5 3.1,76.5 Z"/>
          </svg>
          <span class="room-logo">Quorum</span>
        </a>
        <button class="room-code" id="btn-code" title="Click to copy invite link">
          ${escHtml(roomId)}
          <span class="room-code-hint">copy</span>
        </button>
        <span class="conn-dot" id="conn-dot"></span>
        <span class="conn-label" id="conn-label">connecting…</span>
        <button class="btn-theme" id="btn-theme" title="Toggle theme">☀</button>
        <button class="btn-ghost btn-leave" id="btn-leave" title="Leave room">✕</button>
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

  // Leave room
  root.querySelector('#btn-leave').addEventListener('click', () => {
    localStorage.removeItem(`quorum-stories-${roomId}`);
    navigate('');
  });

  // Theme toggle
  const themeBtn = root.querySelector('#btn-theme');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'espresso';
  themeBtn.textContent = currentTheme === 'espresso' ? '☀' : '☾';
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'espresso';
    const next = current === 'espresso' ? 'arena' : 'espresso';
    document.documentElement.setAttribute('data-theme', next);
    themeBtn.textContent = next === 'espresso' ? '☀' : '☾';
    localStorage.setItem('quorum-theme', next);
  });

  // Home logo link
  root.querySelector('#btn-home').addEventListener('click', (e) => {
    e.preventDefault();
    navigate('');
  });

  function onCountdown() {
    if (countdownTimer) return 0;

    const s = state();
    const peers = Object.values(s.participants);
    const title = s.storyTitle ? renderMd(s.storyTitle) : '';

    const n = peers.length;
    const spreadRadius = Math.min(180, 80 + n * 30);

    mainEl.innerHTML = `
      <section class="reveal-overlay" id="reveal-overlay">
        ${title ? `<div class="story-title md reveal-title">${title}</div>` : ''}
        <div class="reveal-cards" id="reveal-cards">
          ${peers.map((p, i) => {
            const vote = s.votes[p.id];
            const offline = p.online === false;
            const angle = n === 1 ? 0 : ((i / (n - 1)) - 0.5) * Math.PI * 0.6;
            const sx = Math.sin(angle) * spreadRadius;
            const sy = -Math.abs(Math.cos(angle)) * spreadRadius * 0.4 - 40;
            return `
              <div class="reveal-card ${offline ? 'offline' : ''}" data-peer="${p.id}"
                   style="--sx: ${sx}px; --sy: ${sy}px;">
                <div class="reveal-card-inner">
                  <div class="reveal-card-face">🂠</div>
                  <div class="reveal-card-back">${escHtml(vote ?? '?')}</div>
                </div>
                <span class="reveal-card-name">${escHtml(p.name)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    const cards = mainEl.querySelectorAll('.reveal-card');

    // Phase 1: Slide cards to center (1s)
    requestAnimationFrame(() => {
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('slide-to-center'), i * 60);
      });
    });

    // Phase 2: Particles + vibration (starts at 1s, ramps for 2.5s)
    setTimeout(() => {
      const overlay = mainEl.querySelector('#reveal-overlay');
      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        if (window.startRevealMode) {
          window.startRevealMode(rect.left + rect.width / 2, rect.top + rect.height / 2, 100);
        }
      }

      let intensity = 0;
      const vibrateInterval = setInterval(() => {
        intensity = Math.min(1, intensity + 0.02);
        const px = intensity * 4;
        const rot = intensity * 1.5;
        cards.forEach(card => {
          const dx = (Math.random() - 0.5) * px * 2;
          const dy = (Math.random() - 0.5) * px * 2;
          const dr = (Math.random() - 0.5) * rot;
          card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dr}deg)`;
        });

        if (intensity >= 1) {
          clearInterval(vibrateInterval);
          // Phase 3: Flip
          cards.forEach((card, i) => {
            setTimeout(() => {
              card.style.transform = '';
              card.classList.remove('slide-to-center');
              void card.offsetHeight;
              card.classList.add('flipping');
            }, i * 100);
          });
        }
      }, 25);
      countdownTimer = vibrateInterval;
    }, 1000);

    // Return total animation duration so protocol waits for it
    return 4200;
  }

  function state() { return protocol?.getState(); }

  function onUpdate(s) {
    const online = Object.values(s.participants).filter(p => p.id !== userId && p.online !== false).length;
    const total  = online + 1;
    connDot.className   = `conn-dot ${online > 0 ? 'on' : 'alone'}`;
    connLabel.textContent = online === 0 ? 'alone — share the link' : `${total} online`;

    // Sync per-peer sparks in background canvas
    if (window.setQuorumPeers) {
      window.setQuorumPeers(Object.values(s.participants));
    }

    // If countdown is running, don't clobber it
    if (countdownTimer) return;

    const phaseChanged = s.phase !== prevPhase;
    prevPhase = s.phase;

    switch (s.phase) {
      case 'waiting':  renderWaiting(mainEl, s, userId, protocol, phaseChanged, roomId); break;
      case 'voting':   renderVoting(mainEl, s, userId, protocol, phaseChanged);  break;
      case 'revealed': renderRevealed(mainEl, s, userId, protocol, phaseChanged); break;
    }
  }

  protocol = createProtocol(roomId, userId, userName, onUpdate, onCountdown);
  setCleanup(() => protocol.destroy());
}

// ── localStorage helpers ─────────────────────────────────────────────────────

function saveStoriesToStorage(roomId, stories) {
  localStorage.setItem(`quorum-stories-${roomId}`, JSON.stringify(stories));
}

function loadStoriesFromStorage(roomId) {
  try {
    return JSON.parse(localStorage.getItem(`quorum-stories-${roomId}`)) || [];
  } catch {
    return [];
  }
}

// ── Phase: waiting ────────────────────────────────────────────────────────────

let lastStoriesKey = null;

function renderWaiting(el, s, userId, protocol, force, roomId) {
  const peers = Object.values(s.participants);

  // Load from localStorage if stories are empty (first time entering room)
  if (s.stories.length === 0) {
    const stored = loadStoriesFromStorage(roomId);
    if (stored.length > 0) {
      protocol.loadStories(stored.join('\n'));
      return; // Re-render will happen after loadStories triggers emit
    }
  }

  // Force re-render if stories changed (content or order, not just count),
  // the current story moved, phase changed, or first render.
  const storiesKey = `${s.currentIndex}|${s.stories.join('\n')}`;
  const storiesChanged = storiesKey !== lastStoriesKey;
  lastStoriesKey = storiesKey;
  const shouldRerender = force || storiesChanged || !el.querySelector('.waiting');

  if (shouldRerender) {
    el.innerHTML = `
      <section class="waiting">
        <div class="stories-section">
          <div class="stories-list" id="stories-list">
            ${s.stories.length === 0 ? '<p class="stories-empty">No stories yet. Add one below or load from CSV.</p>' : ''}
            ${s.stories.map((story, i) => `
              <div class="story-item${i === s.currentIndex ? ' active' : ''}" draggable="true" data-index="${i}">
                <span class="story-drag" title="Drag to reorder">⠿</span>
                <span class="story-num">${i + 1}</span>
                <span class="story-text">${escHtml(story)}</span>
                ${i === s.currentIndex ? '<span class="story-badge">Current</span>' : ''}
                <button class="story-delete" data-index="${i}" title="Remove story">✕</button>
              </div>
            `).join('')}
          </div>
          <div class="stories-input-area">
            <div class="story-input-wrap">
              <textarea id="story-input" class="story-textarea" rows="2"
                placeholder="Write a story (supports markdown)..."></textarea>
              <button id="btn-save-story" class="btn-add" title="Add story">+</button>
            </div>
            <div class="stories-input-actions">
              <button id="btn-gen-csv" class="btn-action">Generate template</button>
              <label class="btn-action btn-file" for="csv-upload">Load CSV</label>
              <input type="file" id="csv-upload" accept=".csv" class="hidden" />
            </div>
          </div>
        </div>
        <div class="waiting-actions">
          <button id="btn-start" class="btn-primary btn-start">Start voting</button>
          ${s.stories.length > 0 ? '<button id="btn-export-room" class="btn-action">Export results</button>' : ''}
        </div>
        <div class="peer-list" id="peer-list"></div>
      </section>
    `;

    // Start voting — go to desk with or without stories
    el.querySelector('#btn-start').addEventListener('click', () => {
      if (s.stories.length > 0) {
        protocol.loadStories(s.stories.join('\n'));
        protocol.startVoting(s.stories[0]);
      } else {
        protocol.startVoting('Untitled');
      }
    });

    // Save single story
    el.querySelector('#btn-save-story').addEventListener('click', () => {
      const ta = el.querySelector('#story-input');
      const title = ta.value.trim();
      if (!title) return;
      const stories = [...s.stories, title];
      protocol.loadStories(stories.join('\n'));
      saveStoriesToStorage(roomId, stories);
      ta.value = '';
      ta.focus();
    });

    // Delete story
    el.querySelectorAll('.story-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        const stories = s.stories.filter((_, i) => i !== idx);
        protocol.loadStories(stories.join('\n'));
        saveStoriesToStorage(roomId, stories);
      });
    });

    // Drag and drop reorder
    const storiesList = el.querySelector('#stories-list');
    let dragSrcEl = null;
    let dragIdx = -1;

    storiesList.querySelectorAll('.story-item').forEach(item => {
      item.addEventListener('dragstart', function(e) {
        dragSrcEl = this;
        dragIdx = parseInt(this.dataset.index);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.dropEffect = 'move';
        e.dataTransfer.setData('text/plain', String(dragIdx));
      });

      item.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        storiesList.querySelectorAll('.story-item').forEach(i => i.classList.remove('drag-over'));
        dragSrcEl = null;
        dragIdx = -1;
      });

      item.addEventListener('dragover', function(e) {
        if (!dragSrcEl || this === dragSrcEl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
      });

      item.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        if (!dragSrcEl || dragSrcEl === this) return;
        const from = dragIdx;
        const to = parseInt(this.dataset.index);
        if (from < 0 || isNaN(to) || from === to) return;
        const currentState = protocol.getState();
        const stories = [...currentState.stories];
        const [moved] = stories.splice(from, 1);
        stories.splice(to, 0, moved);
        protocol.loadStories(stories.join('\n'));
        saveStoriesToStorage(roomId, stories);
      });
    });

    // Generate CSV template
    el.querySelector('#btn-gen-csv').addEventListener('click', () => {
      const csv = 'title\nUser login\nPassword reset\nDashboard charts';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quorum-stories.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Load CSV
    el.querySelector('#csv-upload').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const stories = lines[0] === 'title' ? lines.slice(1) : lines;
        if (stories.length > 0) {
          const allStories = [...s.stories, ...stories];
          protocol.loadStories(allStories.join('\n'));
          saveStoriesToStorage(roomId, allStories);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Export all stories results (room view)
    el.querySelector('#btn-export-room')?.addEventListener('click', () => {
      exportAllResults(s);
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
        ${s.storyTitle ? `<div class="story-title md">${renderMd(s.storyTitle)}</div>` : ''}
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
          <button id="btn-back-room" class="btn-ghost btn-back">← Room</button>
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

    // Back to room
    el.querySelector('#btn-back-room')?.addEventListener('click', () => {
      protocol.backToWaiting();
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

function renderRevealed(el, s, userId, protocol, force) {
  const peers = Object.values(s.participants);
  const stats = computeStats(s.votes);
  const hasNextStory = s.stories.length > 0 && s.currentIndex < s.stories.length - 1;

  // Reveal animation: charge phase then show cards
  if (force || !el.querySelector('.revealed')) {
    el.innerHTML = `
      <section class="revealed reveal-charge">
        <div class="reveal-center-glow"></div>
        <div class="reveal-rays">
          ${peers.map((p, i) => {
            const angle = (i / peers.length) * 360;
            return `<div class="reveal-ray" style="--angle: ${angle}deg; --delay: ${i * 0.08}s"></div>`;
          }).join('')}
        </div>
      </section>
    `;

    // After charge phase, show revealed cards
    setTimeout(() => {
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
            <button id="btn-new-story" class="btn-primary">${hasNextStory ? 'Next story →' : 'New story'}</button>
            <button id="btn-back-room-desk" class="btn-ghost btn-back">← Room</button>
          </div>
        </section>
      `;

      el.querySelector('#btn-next-round').addEventListener('click', () => protocol.nextRound());
      el.querySelector('#btn-new-story').addEventListener('click', () => protocol.nextStory());
      el.querySelector('#btn-back-room-desk')?.addEventListener('click', () => protocol.backToWaiting());
    }, 1400); // charge + ray duration
  }
}

// ── Export helper ─────────────────────────────────────────────────────────────

function exportAllResults(s) {
  const csv = 'Story,Votes\n' + s.stories.map((story, i) => {
    const votes = Object.entries(s.votes).map(([uid, v]) => {
      const peer = Object.values(s.participants).find(p => p.id === uid);
      return `${peer?.name || 'Unknown'}: ${v}`;
    }).join('; ');
    return `"${story.replace(/"/g, '""')}","${votes || 'No votes'}"`;
  }).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quorum-results-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Util ──────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
