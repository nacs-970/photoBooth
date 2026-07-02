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

  // --- onDisconnect(cb) ---
  it.todo('onDisconnect(cb) fires when the MJPEG stream errors out');
});
