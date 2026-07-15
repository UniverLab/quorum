import { BANNER } from '../banner.js';

const VERSION = '0.1.3';

const FEATURES = [
  { title: 'Planning poker', desc: 'Fibonacci deck (0, 1, 2, 3, 5, 8, 13, 21, ☕). Cards auto-reveal when everyone has voted — no surprises.' },
  { title: 'Peer-to-peer', desc: 'No cloud, no account, no relay. Browsers talk directly via WebRTC. A BitTorrent tracker handles the initial handshake; after that, data flows straight between peers.' },
  { title: 'Resilient sessions', desc: 'Drop off and the round stays alive. Reconnect and the state syncs back from any peer still in the room.' },
  { title: 'Story lists', desc: 'Paste a backlog (one per line, or CSV) and step through the stories in order. Voting works without a title too.' },
  { title: 'Zombie detection', desc: 'Peers that go quiet are marked offline, so a round never stalls waiting on a ghost.' },
];

const FAQ = [
  ['Is Quorum free?', 'Completely free. No accounts, no user limits, no premium tier. Open the URL and start estimating.'],
  ['How does planning poker work without a server?', 'Quorum uses peer-to-peer WebRTC connections. Your browser connects directly to your teammates\' browsers — no cloud, no database. A BitTorrent tracker handles the initial handshake; after that, data flows straight between peers.'],
  ['Can I use Quorum for remote sprint planning?', 'Yes. Share the room URL with your team. Everyone picks a Fibonacci card. Cards auto-reveal simultaneously once everyone votes.'],
  ['Does Quorum support story lists?', 'Yes. Paste a story list or load a CSV. Step through stories in order, estimating each one. The session stays alive if someone disconnects — reconnect and state syncs from any peer still in the room.'],
  ['What makes Quorum different from planningpoker.com?', 'No accounts, no user limits, no data stored on a server. Quorum is open-source and runs entirely in the browser via WebRTC. Your estimation data never leaves your team\'s devices.'],
  ['Does it work on corporate networks?', 'It depends on your firewall. Some corporate networks block WebRTC or BitTorrent tracker traffic. If Quorum can\'t connect, your network is likely restricting peer-to-peer connections.'],
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export function renderAbout(root) {
  // Inject FAQ schema
  let script = document.getElementById('faq-schema');
  if (!script) {
    script = document.createElement('script');
    script.id = 'faq-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(script);
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'espresso';

  root.innerHTML = `
    <div class="page about">
      <header class="room-header">
        <a href="/" class="room-logo-link" id="btn-home">
          <svg class="room-logo-icon" width="28" height="28" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="5" fill="var(--logo-bg)"/>
            <text x="16" y="22" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="var(--logo-fg)">Q</text>
          </svg>
          <span class="room-logo">Quorum</span>
        </a>
        <span class="about-nav-spacer"></span>
        <button class="btn-theme" id="btn-theme" title="Toggle theme">${currentTheme === 'espresso' ? '☀' : '☾'}</button>
      </header>

      <div class="about-content">
        <div class="about-header">
          <pre class="about-banner home-banner" aria-hidden="true">${BANNER}</pre>
          <h1>Planning poker, peer to peer</h1>
          <p class="about-version">v${VERSION}</p>
        </div>

        <section class="about-section">
          <h2>Features</h2>
          <dl class="feature-grid">
            ${FEATURES.map(f => `
              <div class="feature-item">
                <dt>${f.title}</dt>
                <dd>${f.desc}</dd>
              </div>
            `).join('')}
          </dl>
        </section>

        <section class="about-section">
          <h2>How it works</h2>
          <div class="how-content">
            <p>Quorum uses <a href="https://github.com/dmotz/trystero" target="_blank" rel="noopener noreferrer">Trystero</a> for peer-to-peer sync over WebRTC. The only intermediary is BitTorrent tracker signaling used to introduce peers — your votes and story names never touch a server.</p>
            <ol class="steps-list">
              <li>Open the app and create a new room</li>
              <li>Share the URL with your team</li>
              <li>Everyone picks a card from the Fibonacci deck</li>
              <li>Cards auto-reveal when all have voted</li>
              <li>New round or new story to continue</li>
            </ol>
          </div>
        </section>

        <section class="about-section">
          <h2>Frequently asked questions</h2>
          <dl class="faq-list">
            ${FAQ.map(([q, a]) => `
              <div class="faq-item">
                <dt>${q}</dt>
                <dd>${a}</dd>
              </div>
            `).join('')}
          </dl>
        </section>

        <section class="about-section about-links">
          <a href="https://github.com/UniverLab/quorum" target="_blank" rel="noopener noreferrer" class="about-link">GitHub</a>
          <a href="https://univerlab.org" target="_blank" rel="noopener noreferrer" class="about-link">UniverLab</a>
        </section>
      </div>
    </div>
  `;

  // Theme toggle
  root.querySelector('#btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'espresso';
    const next = current === 'espresso' ? 'arena' : 'espresso';
    document.documentElement.setAttribute('data-theme', next);
    root.querySelector('#btn-theme').textContent = next === 'espresso' ? '☀' : '☾';
    localStorage.setItem('quorum-theme', next);
  });
}
