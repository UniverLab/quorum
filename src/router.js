/** History-based router — clean URLs (/about instead of /#/about).
 *  Vite dev server handles SPA fallback; production needs a redirect rule. */

const routes = {};
let cleanup = null;

export function register(pattern, handler) {
  routes[pattern] = handler;
}

export function setCleanup(fn) {
  cleanup = fn;
}

export function navigate(path) {
  history.pushState(null, '', path);
  resolve();
}

function resolve() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const path = window.location.pathname || '/';
  const roomMatch = path.match(/^\/room\/([A-Za-z0-9]+)$/);

  document.body.classList.toggle('is-room', !!roomMatch);

  if (roomMatch) {
    routes['/room/:id']?.(roomMatch[1]);
    return;
  }

  if (routes[path]) {
    routes[path]();
    return;
  }

  routes['/']?.();
}

export function start() {
  window.addEventListener('popstate', resolve);
  // Handle link clicks for SPA navigation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Let external links and hash links pass through
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    e.preventDefault();
    navigate(href);
  });
  resolve();
}
