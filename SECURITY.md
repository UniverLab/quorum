# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Quorum, please report it responsibly.

**Do not open a public GitHub issue.**

Email: **jheison.mb@univerlab.org**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

You should receive an initial response within **72 hours**.

## Scope

This policy applies to the Quorum web application at `quorum.univerlab.org` and the source code in this repository.

## Architecture Notes

- Quorum uses peer-to-peer WebRTC connections — there is no server storing your data
- BitTorrent trackers are used only for initial peer signaling, not for data transfer
- Signaling payloads are encrypted with the room ID as the key
- All state lives in browser memory and is lost when all participants close their tabs
