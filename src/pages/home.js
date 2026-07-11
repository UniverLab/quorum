import { navigate } from '../router.js';
import { generateRoomId } from '../room-id.js';

export function renderHome(root) {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'espresso';
  root.innerHTML = `
    <div class="page home">
      <button class="btn-theme home-theme" id="btn-theme" title="Toggle theme">${currentTheme === 'espresso' ? '☀' : '☾'}</button>
      <div class="home-content">
        <div class="home-brand">
          <pre class="home-banner" aria-hidden="true">██████
██░░░░░███
███    ░░███ █████ ████  ██████  ████████  █████ ████ █████████████
░███     ░███░░███ ░███  ███░░███░░███░░███░░███ ░███ ░░███░░███░░███
░███   ██░███ ░███ ░███ ░███ ░███ ░███ ░░░  ░███ ░███  ░███ ░███ ░███
░░███ ░░████  ░███ ░███ ░███ ░███ ░███      ░███ ░███  ░███ ░███ ░███
 ░░░██████░██ ░░████████░░██████  █████     ░░████████ █████░███ █████
   ░░░░░░ ░░   ░░░░░░░░  ░░░░░░  ░░░░░       ░░░░░░░░ ░░░░░ ░░░ ░░░░░</pre>
          <p class="home-subtitle">Planning poker p2p — no accounts, no server.</p>
        </div>
        <div class="home-actions">
          <button id="btn-new" class="btn-primary">New room</button>
          <div class="join">
            <input id="join-code" class="join-input" placeholder="Room code (e.g. A3F2B1C4)" maxlength="8" />
            <button id="btn-join" class="btn-ghost">Join</button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#btn-new').addEventListener('click', () => {
    navigate(`/room/${generateRoomId()}`);
  });

  root.querySelector('#btn-join').addEventListener('click', () => {
    const code = root.querySelector('#join-code').value.trim().toUpperCase();
    if (code.length === 8) navigate(`/room/${code}`);
  });

  root.querySelector('#btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'espresso';
    const next = current === 'espresso' ? 'arena' : 'espresso';
    document.documentElement.setAttribute('data-theme', next);
    root.querySelector('#btn-theme').textContent = next === 'espresso' ? '☀' : '☾';
    localStorage.setItem('quorum-theme', next);
  });
}
