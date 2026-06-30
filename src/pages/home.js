import { navigate } from '../router.js';
import { generateRoomId } from '../room-id.js';

export function renderHome(root) {
  root.innerHTML = `
    <div class="page home">
      <h1>Quorum</h1>
      <p>Planning poker — no accounts, no server.</p>
      <button id="btn-new">New room</button>
      <div class="join">
        <input id="join-code" placeholder="Room code (e.g. A3F2B1C4)" maxlength="8" />
        <button id="btn-join">Join</button>
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
}
