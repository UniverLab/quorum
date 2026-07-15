import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeLocationStub(pathname = '/') {
  return {
    get pathname() { return pathname; },
  };
}

function mockDocument() {
  return {
    addEventListener: vi.fn(),
    body: { classList: { toggle: vi.fn() } },
  };
}

describe('router — resolve', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls the "/" handler for root path', async () => {
    global.window = { location: makeLocationStub('/'), addEventListener: vi.fn(), history: { pushState: vi.fn() } };
    global.document = mockDocument();

    const { register, start } = await import('../router.js');
    const homeFn = vi.fn();
    register('/', homeFn);
    start();

    expect(homeFn).toHaveBeenCalledOnce();
  });

  it('calls "/room/:id" handler and passes the room ID', async () => {
    global.window = { location: makeLocationStub('/room/ABCD1234'), addEventListener: vi.fn(), history: { pushState: vi.fn() } };
    global.document = mockDocument();

    const { register, start } = await import('../router.js');
    const roomFn = vi.fn();
    register('/room/:id', roomFn);
    start();

    expect(roomFn).toHaveBeenCalledWith('ABCD1234');
  });

  it('calls cleanup before resolving a new route', async () => {
    global.window = { location: makeLocationStub('/'), addEventListener: vi.fn(), history: { pushState: vi.fn() } };
    global.document = mockDocument();

    const { register, setCleanup, start } = await import('../router.js');
    const cleanup = vi.fn();
    const homeFn = vi.fn();

    setCleanup(cleanup);
    register('/', homeFn);
    start();

    expect(cleanup).toHaveBeenCalledOnce();
  });
});
