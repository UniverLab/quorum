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
            <rect width="32" height="32" rx="3" fill="var(--logo-bg)"/>
            <path fill="var(--logo-fg)" d="M17.66 23.72Q16.69 23.99 16 23.99Q13.76 23.99 11.98 22.55Q10.2 21.1 9.22 18.78Q8.25 16.45 8.25 13.89Q8.25 11.35 9.24 9.06Q10.23 6.78 11.99 5.39Q13.76 4 16 4Q18.24 4 20.01 5.39Q21.77 6.78 22.76 9.06Q23.75 11.35 23.75 13.89Q23.75 16.8 22.61 19.26Q21.48 21.72 19.34 23Q19.63 24.39 20.16 25.23Q20.68 26.08 21.53 26.08Q22.55 26.08 22.9 24.99Q23.24 23.91 23.24 22.17H23.75Q23.75 24.87 23.12 26.44Q22.49 28 20.68 28Q19.07 28 18.43 26.8Q17.79 25.59 17.66 23.72ZM13.46 22.25Q13.33 21.93 13.33 21.51Q13.33 20.38 14.08 19.66Q14.82 18.94 15.92 18.94Q17.18 18.94 17.92 19.74Q18.67 20.54 19.02 21.83Q20.04 20.78 20.48 18.81Q20.92 16.83 20.92 13.89Q20.92 9.53 19.78 7.19Q18.65 4.86 16 4.86Q13.35 4.86 12.22 7.19Q11.08 9.53 11.08 13.89Q11.08 16.64 11.56 18.86Q12.04 21.08 13.43 22.28ZM17.58 22.84Q17.5 21.48 17.15 20.64Q16.8 19.8 15.84 19.8Q15.14 19.8 14.69 20.26Q14.24 20.73 14.24 21.53Q14.24 23.14 16 23.14Q16.86 23.14 17.58 22.84Z"/>
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
