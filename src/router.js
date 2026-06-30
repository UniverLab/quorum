/** Hash-based router — no server config needed for static hosting. */

const routes = {};

export function register(pattern, handler) {
  routes[pattern] = handler;
}

export function navigate(hash) {
  window.location.hash = hash;
}

function resolve() {
  const hash = window.location.hash.slice(1) || '/';
  const roomMatch = hash.match(/^\/room\/([A-Za-z0-9]+)$/);

  if (roomMatch) {
    routes['/room/:id']?.(roomMatch[1]);
    return;
  }

  routes['/']?.();
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
