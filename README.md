# Quorum — EXP-008

> Browser-native planning poker. No accounts, no server, share a URL and play.

**[quorum.univerlab.org](https://quorum.univerlab.org)**

---

## How it works

Quorum uses [Trystero](https://github.com/dmotz/trystero) for peer-to-peer sync via WebRTC. The only intermediary is BitTorrent tracker signaling — your votes and story names never touch a server.

## Usage

1. Open the app → **New room**
2. Share the URL with your team
3. Everyone picks a card → cards reveal when all have voted
4. **New round** (same story) or **New story** to continue

## Stories

Paste a list (one per line) via **Load stories** to queue them up. Or type each title on the fly — voting works without a title too.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the build
```

**Validate P2P**: test with two browsers on *different networks* (not two tabs). Two tabs share localStorage and sync without real P2P.

## Caveats

- Votes are visible in devtools before reveal (UI-only hiding)
- State is lost if all participants close the tab
- BitTorrent trackers may be blocked on restrictive corporate networks

## Stack

- [Trystero](https://github.com/dmotz/trystero) — P2P via BitTorrent trackers + WebRTC
- [Vite](https://vitejs.dev) — build tooling
- Vanilla JS/CSS — no framework

---

Part of [UniverLab](https://univerlab.org) · EXP-008
