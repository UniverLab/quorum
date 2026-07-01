```
    ██████                                                            
  ███░░░░███                                                          
 ███    ░░███ █████ ████  ██████  ████████  █████ ████ █████████████  
░███     ░███░░███ ░███  ███░░███░░███░░███░░███ ░███ ░░███░░███░░███ 
░███   ██░███ ░███ ░███ ░███ ░███ ░███ ░░░  ░███ ░███  ░███ ░███ ░███ 
░░███ ░░████  ░███ ░███ ░███ ░███ ░███      ░███ ░███  ░███ ░███ ░███ 
 ░░░██████░██ ░░████████░░██████  █████     ░░████████ █████░███ █████
   ░░░░░░ ░░   ░░░░░░░░  ░░░░░░  ░░░░░       ░░░░░░░░ ░░░░░ ░░░ ░░░░░ 
```                                                                  

<p align="center">
  <a href="https://github.com/UniverLab/quorum/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/UniverLab/quorum/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI"/></a>
  <a href="https://quorum.univerlab.org"><img src="https://img.shields.io/badge/Live-quorum.univerlab.org-E6B24A?style=for-the-badge" alt="Live"/></a>
  <img src="https://img.shields.io/badge/Status-Active-27AE60?style=for-the-badge" alt="Status"/>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-2E8B57?style=for-the-badge" alt="License"/></a>
</p>

Browser-native planning poker for agile teams. No accounts, no server — share a room URL and estimate together. Peers talk to each other directly over WebRTC; your votes never touch a server.

**▶ [quorum.univerlab.org](https://quorum.univerlab.org)**

---

## Features

- **🃏 Planning poker** — Fibonacci deck (0, 1, 2, 3, 5, 8, 13, 21, ?); the cards auto-reveal the moment everyone has voted, with a short countdown so nothing surprises.
- **🌐 Peer-to-peer** — no cloud, no account, no relay. A shared room URL is the whole app; the browsers talk to each other directly.
- **♻️ Resilient sessions** — drop off and the round stays alive; reconnect and the state syncs back from any peer still in the room.
- **📋 Story lists** — paste a backlog (one per line, or CSV) and step through the stories in order.
- **🕵️ Zombie detection** — peers that go quiet are marked offline, so a round never stalls waiting on a ghost.

---

## How it works

Quorum uses [Trystero](https://github.com/dmotz/trystero) for peer-to-peer sync over WebRTC. The only intermediary is BitTorrent tracker signaling used to introduce peers — your votes and story names never touch a server.

## Usage

1. Open the app → **New room**
2. Share the URL with your team
3. Everyone picks a card → the deck reveals when all have voted
4. **New round** (same story) or **New story** to continue

## Stories

Paste a list (one per line) via **Load stories** to queue them up. Or type each title on the fly — voting works without a title too.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the build
npm run coverage  # tests + coverage
```

**Validate P2P**: test with two browsers on *different networks* (not two tabs). Two tabs share localStorage and sync without real P2P.

## Caveats

- Votes are visible in devtools before reveal (UI-only hiding).
- State is lost if every participant closes the tab at once.
- BitTorrent trackers may be blocked on restrictive corporate networks.

## Stack

- [Trystero](https://github.com/dmotz/trystero) — P2P via BitTorrent trackers + WebRTC
- [Vite](https://vitejs.dev) — build tooling
- Vanilla JS/CSS — no framework

---

Part of [UniverLab](https://univerlab.org) · EXP-008
