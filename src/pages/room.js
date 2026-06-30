import { joinRoom } from 'trystero/torrent';

const APP_ID = 'quorum-univerlab-v1';

export function renderRoom(root, roomId) {
  root.innerHTML = `
    <div class="page room">
      <header>
        <span class="logo">Quorum</span>
        <span class="room-code">${roomId}</span>
      </header>

      <section class="p2p-status">
        <p id="status">Connecting…</p>
        <p id="peer-count">Peers: 0</p>
      </section>

      <section class="ping-test">
        <button id="btn-ping">Send ping</button>
        <ul id="log"></ul>
      </section>
    </div>
  `;

  const statusEl = root.querySelector('#status');
  const peerCountEl = root.querySelector('#peer-count');
  const logEl = root.querySelector('#log');

  function log(msg) {
    const li = document.createElement('li');
    li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(li);
  }

  const room = joinRoom({ appId: APP_ID }, roomId);
  const [sendPing, getPing] = room.makeAction('ping');

  room.onPeerJoin((peerId) => {
    peerCountEl.textContent = `Peers: ${Object.keys(room.getPeers()).length}`;
    statusEl.textContent = 'Connected';
    log(`Peer joined: ${peerId.slice(0, 8)}`);
  });

  room.onPeerLeave((peerId) => {
    peerCountEl.textContent = `Peers: ${Object.keys(room.getPeers()).length}`;
    log(`Peer left: ${peerId.slice(0, 8)}`);
  });

  getPing((data, peerId) => {
    log(`Ping from ${peerId.slice(0, 8)}: ${data.msg}`);
  });

  root.querySelector('#btn-ping').addEventListener('click', () => {
    sendPing({ msg: 'hello from ' + roomId });
    log('Ping sent');
  });

  // Copy link to clipboard on room code click
  root.querySelector('.room-code').addEventListener('click', async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url).catch(() => {});
    log('Link copied to clipboard');
  });
}
