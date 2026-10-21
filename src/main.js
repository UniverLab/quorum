import { register, start } from './router.js';
import { renderHome } from './pages/home.js';
import { renderRoom } from './pages/room.js';
import { renderAbout } from './pages/about.js';
import './style.css';
import './background.js';
import './theme.js';

const root = document.getElementById('app');

register('/', () => renderHome(root));
register('/room/:id', (id) => renderRoom(root, id));
register('/about', () => renderAbout(root));

// Persistent footer — lives outside #app so it survives page transitions
const footer = document.createElement('footer');
footer.className = 'site-footer';
footer.innerHTML = `
  <picture class="colophon-band">
    <source type="image/avif" srcset="/colophon/quorum-band-768.avif 768w, /colophon/quorum-band-1344.avif 1344w" sizes="100vw">
    <img src="/colophon/quorum-band-1344.webp" srcset="/colophon/quorum-band-768.webp 768w, /colophon/quorum-band-1344.webp 1344w" sizes="100vw" width="1344" height="768" alt="" loading="lazy" decoding="async">
  </picture>
  <div class="colophon-content">
    <div class="colophon-brand">
      <p class="colophon-title">Quorum</p>
      <p class="colophon-sub">EXP-008 · Planning poker, peer to peer</p>
    </div>
    <nav class="colophon-col" aria-label="Sections">
      <p class="colophon-label">Sections</p>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
    <nav class="colophon-col" aria-label="Project">
      <p class="colophon-label">Project</p>
      <a href="https://github.com/UniverLab/quorum" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://univerlab.org" target="_blank" rel="noopener noreferrer">UniverLab</a>
    </nav>
    <p class="colophon-credits">
      <img src="/colophon/sello-lacre.svg" width="28" height="28" alt="" aria-hidden="true">
      <span>Artifact conceived and forged at <a href="https://univerlab.org" target="_blank" rel="noopener noreferrer">UniverLab</a> · No analytics. No cookies. No tracking.</span>
    </p>
  </div>
`;
document.body.appendChild(footer);

start();
