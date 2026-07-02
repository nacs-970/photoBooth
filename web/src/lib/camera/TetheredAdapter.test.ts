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

describe('TetheredAdapter (Wave 3/4 contract — todo)', () => {
  let adapter: TetheredAdapter;

  beforeEach(() => {
    adapter = new TetheredAdapter();
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
  it.todo('capture() posts to /api/camera/capture and resolves with a JPEG Blob');
  it.todo('capture() stamps session.sessionStartedAt on first call');
  it.todo('capture() does NOT overwrite session.sessionStartedAt on subsequent calls');

  // --- dispose() ---
  it.todo('dispose() releases the MJPEG <img> src and clears internal references');

  // --- onDisconnect(cb) ---
  it.todo('onDisconnect(cb) fires when the MJPEG stream errors out');
});
