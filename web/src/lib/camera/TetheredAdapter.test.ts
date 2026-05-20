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
import { describe, it } from 'vitest';
import { TetheredAdapter } from './TetheredAdapter.ts';

describe('TetheredAdapter (Wave 3/4 contract — todo)', () => {
  // Compile-time guard: ensure the import resolves and the class is constructable.
  // This catches accidental removal of the placeholder class before Wave 3 lands.
  it('the placeholder class is importable and constructable', () => {
    const a = new TetheredAdapter();
    if (!a) throw new Error('TetheredAdapter constructor failed');
  });

  // --- init() ---
  it.todo('init() throws when GET /api/camera/info returns gphoto2Available: false');
  it.todo('init() throws an error tagged USB_CONFLICT when the backend responds with gphoto2 -53');

  // --- attachPreview(el) ---
  it.todo('attachPreview(imgEl) sets el.src to /api/camera/stream (MJPEG)');
  it.todo('attachPreview(videoEl) throws — MJPEG cannot be attached to a <video>');

  // --- capture() ---
  it.todo('capture() posts to /api/camera/capture and resolves with a JPEG Blob');
  it.todo('capture() stamps session.sessionStartedAt on first call');
  it.todo('capture() does NOT overwrite session.sessionStartedAt on subsequent calls');

  // --- dispose() ---
  it.todo('dispose() releases the MJPEG <img> src and clears internal references');

  // --- onDisconnect(cb) ---
  it.todo('onDisconnect(cb) fires when the MJPEG stream errors out');
});
