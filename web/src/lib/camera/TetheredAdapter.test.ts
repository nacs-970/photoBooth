/**
 * Tests for web/src/lib/camera/TetheredAdapter.ts
 *
 * Wave 1 scope (this plan): scaffold ONLY.
 *
 * The current TetheredAdapter is a placeholder that throws from every method.
 * Wave 3 (preview) and Wave 4 (capture) will replace it with the real gphoto2
 * backend integration — at which point each `it.todo(...)` below MUST be
 * converted to a passing `it(...)` test.
 *
 * Behaviors enumerated here are the contract Wave 3/4 must satisfy. Keeping the
 * stubs in this file (rather than in a planning document) means the test runner
 * will surface them as outstanding work on every CI run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TetheredAdapter } from './TetheredAdapter.ts';

vi.mock('$lib/session.svelte.ts', () => ({
  session: {
    currentShotIndex: 0,
    sessionStartedAt: null as number | null,
  }
}));

import { session } from '$lib/session.svelte.ts';

describe('TetheredAdapter (Wave 3/4 contract — todo)', () => {
  let adapter: TetheredAdapter;

  beforeEach(() => {
    adapter = new TetheredAdapter();
    session.currentShotIndex = 0;
    session.sessionStartedAt = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the placeholder class is importable and constructable', () => {
    expect(adapter).toBeDefined();
  });

  // --- init() ---
  it('init() resolves when fetch returns gphoto2Available: true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gphoto2Available: true, usbConflict: false })
    }));
    await expect(adapter.init()).resolves.toBeUndefined();
  });

  it('init() throws when GET /api/camera/info returns gphoto2Available: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gphoto2Available: false, usbConflict: false })
    }));
    await expect(adapter.init()).rejects.toThrow('No DSLR detected');
  });

  it('init() throws an error tagged USB_CONFLICT when the backend responds with gphoto2 -53', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gphoto2Available: false, usbConflict: true })
    }));
    await expect(adapter.init()).rejects.toThrow('USB_CONFLICT');
  });

  // --- attachPreview(el) ---
  it('attachPreview(imgEl) sets el.src to /api/camera/stream (MJPEG)', async () => {
    const imgEl = document.createElement('img');
    await adapter.attachPreview(imgEl);
    expect(imgEl.src).toContain('/api/camera/stream');
  });

  it('attachPreview(videoEl) throws — MJPEG cannot be attached to a <video>', async () => {
    const videoEl = document.createElement('video');
    await expect(adapter.attachPreview(videoEl)).rejects.toThrow('TetheredAdapter requires HTMLImageElement');
  });

  // --- capture() ---
  it('capture() posts to /api/camera/capture and resolves with a JPEG Blob', async () => {
    session.currentShotIndex = 2;
    session.sessionStartedAt = 12345;
    
    const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => mockBlob
    });
    vi.stubGlobal('fetch', fetchMock);

    const blob = await adapter.capture();
    
    expect(blob).toBe(mockBlob);
    expect(fetchMock).toHaveBeenCalledWith('/api/camera/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shotIndex: 2, sessionId: 12345 }),
    });
  });

  it('capture() stamps session.sessionStartedAt on first call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob()
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(session.sessionStartedAt).toBeNull();
    await adapter.capture();
    expect(session.sessionStartedAt).not.toBeNull();
    expect(typeof session.sessionStartedAt).toBe('number');
  });

  it('capture() does NOT overwrite session.sessionStartedAt on subsequent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob()
    });
    vi.stubGlobal('fetch', fetchMock);

    session.sessionStartedAt = 99999;
    await adapter.capture();
    expect(session.sessionStartedAt).toBe(99999);
  });

  it('capture() re-sets imgEl.src after successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob()
    });
    vi.stubGlobal('fetch', fetchMock);

    const imgEl = document.createElement('img');
    await adapter.attachPreview(imgEl);
    
    const initialSrc = imgEl.src;
    
    // Simulate time passing
    vi.spyOn(Date, 'now').mockReturnValue(9999999);
    
    await adapter.capture();
    
    expect(imgEl.src).not.toBe(initialSrc);
    expect(imgEl.src).toContain('/api/camera/stream?t=9999999');
  });

  it('capture() throws when response is non-200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(adapter.capture()).rejects.toThrow('Capture failed: 500');
  });

  // --- dispose() ---
  it('dispose() releases the MJPEG <img> src and clears internal references', async () => {
    const imgEl = document.createElement('img');
    await adapter.attachPreview(imgEl);
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob()
    });
    vi.stubGlobal('fetch', fetchMock);
    await adapter.capture();
    
    await adapter.dispose();
    
    expect(imgEl.getAttribute('src')).toBeNull();
    expect(imgEl.onerror).toBeNull();
  });

  // --- attachPreview(canvasEl) ---
  function stubCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    return canvas;
  }

  it('attachPreview(canvasEl) fetches /api/camera/stream', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    await adapter.attachPreview(stubCanvas());
    expect(fetchMock.mock.calls[0][0]).toContain('/api/camera/stream');
  });

  it('dispose() aborts the canvas stream fetch', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    await adapter.attachPreview(stubCanvas());
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal;
    await adapter.dispose();
    expect(signal.aborted).toBe(true);
  });

  // --- onDisconnect(cb) ---
  it('onDisconnect(cb) fires when the MJPEG stream errors out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const cb = vi.fn();
    adapter.onDisconnect(cb);
    await adapter.attachPreview(stubCanvas());
    await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
  });

  it('onDisconnect(cb) does not fire when a re-attach aborts the previous stream', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const cb = vi.fn();
    adapter.onDisconnect(cb);
    await adapter.attachPreview(stubCanvas());
    await adapter.attachPreview(stubCanvas()); // aborts stream #1; callback is still registered
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).not.toHaveBeenCalled();
  });

  it('onDisconnect(cb) does not fire when the stream is aborted by dispose()', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const cb = vi.fn();
    adapter.onDisconnect(cb);
    await adapter.attachPreview(stubCanvas());
    await adapter.dispose();
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).not.toHaveBeenCalled();
  });

  // --- detached-canvas watchdog ---
  describe('canvas watchdog', () => {
    let canvas: HTMLCanvasElement;

    /** fetch that never delivers a frame and rejects only when aborted. */
    function hangingFetch() {
      return vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
        init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }));
    }

    beforeEach(() => {
      vi.useFakeTimers();
      canvas = stubCanvas();
      document.body.appendChild(canvas);
    });

    afterEach(() => {
      canvas.remove();
      vi.useRealTimers();
    });

    it('aborts the stream when the canvas leaves the DOM, even with no frame', async () => {
      const fetchMock = hangingFetch();
      vi.stubGlobal('fetch', fetchMock);
      await adapter.attachPreview(canvas);
      const signal: AbortSignal = fetchMock.mock.calls[0][1].signal;

      vi.advanceTimersByTime(500);
      expect(signal.aborted).toBe(false);

      canvas.remove();
      vi.advanceTimersByTime(500);
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('runs one watchdog interval while streaming and none after dispose', async () => {
      vi.stubGlobal('fetch', hangingFetch());
      await adapter.attachPreview(canvas);
      expect(vi.getTimerCount()).toBe(1);
      await adapter.dispose();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('re-attach replaces the watchdog instead of adding a second one', async () => {
      vi.stubGlobal('fetch', hangingFetch());
      await adapter.attachPreview(canvas);
      await adapter.attachPreview(canvas);
      expect(vi.getTimerCount()).toBe(1);
      await adapter.dispose();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the watchdog when the stream fails (disconnect path)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      const cb = vi.fn();
      adapter.onDisconnect(cb);
      await adapter.attachPreview(canvas);
      await vi.advanceTimersByTimeAsync(0);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
