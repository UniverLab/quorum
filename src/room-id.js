/**
 * Generates URL-safe room IDs with 80 bits of entropy (16 chars × 5 bits).
 *
 * The room ID is the only credential to a room. Trystero announces
 * hash(appId + roomId) on public WebTorrent trackers, so an attacker can
 * precompute hashes for the whole ID space and match them against observed
 * announces — the space must be far too large to enumerate (the previous
 * 32-bit IDs were GPU-crackable offline in minutes).
 *
 * Crockford base32 alphabet (no I/L/O/U): 32 chars divides 256 evenly, so
 * `byte % 32` stays uniform.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
}
