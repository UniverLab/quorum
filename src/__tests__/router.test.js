import { describe, it, expect, vi, beforeEach } from 'vitest';

// router.js reads/writes window.location.hash — stub it
function makeLocationStub(initial = '') {
  let hash = initial;
  return {
    get hash() { return hash; },
    set hash(v) { hash = v; },
  };
}

describe('router — resolve', () => {
  beforeEach(() => {
    // Reset module between tests so route registry is fresh
    vi.resetModules();
  });

  it('calls the "/" handler for empty hash', async () => {
    global.window = { location: makeLocationStub(''), addEventListener: vi.fn() };

    const { register, start } = await import('../router.js');
    const homeFn = vi.fn();
    register('/', homeFn);
    start();

    expect(homeFn).toHaveBeenCalledOnce();
  });

  it('calls "/room/:id" handler and passes the room ID', async () => {
    global.window = { location: makeLocationStub('#/room/ABCD1234'), addEventListener: vi.fn() };

    const { register, start } = await import('../router.js');
    const roomFn = vi.fn();
    register('/room/:id', roomFn);
    start();

    expect(roomFn).toHaveBeenCalledWith('ABCD1234');
  });

  it('calls cleanup before resolving a new route', async () => {
    global.window = { location: makeLocationStub(''), addEventListener: vi.fn() };

    const { register, setCleanup, start } = await import('../router.js');
    const cleanup = vi.fn();
    const homeFn = vi.fn();

    setCleanup(cleanup);
    register('/', homeFn);
    start();

    expect(cleanup).toHaveBeenCalledOnce();
  });
});
