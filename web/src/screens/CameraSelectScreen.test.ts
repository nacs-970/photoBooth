/**
 * Tests for web/src/screens/CameraSelectScreen.svelte
 *
 * Phase 2 Wave 1 (this plan): the screen renders two tiles, probes
 * GET /api/camera/info on mount, and shows "Checking…" until the probe resolves.
 *
 * Selection-side effects (setCameraAdapter + session.screen = 'idle') are
 * covered by Wave 5 integration tests; this file scopes to render + probe.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import CameraSelectScreen from './CameraSelectScreen.svelte';

// Hold the deferred fetch promise so we can control probe resolution per-test
let resolveFetch: ((value: unknown) => void) | null = null;
let rejectFetch: ((reason?: unknown) => void) | null = null;

beforeEach(() => {
  resolveFetch = null;
  rejectFetch = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve, reject) => {
          resolveFetch = resolve;
          rejectFetch = reject;
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CameraSelectScreen', () => {
  it('renders Tethered DSLR and Webcam tiles', async () => {
    const { getByText, getByTestId } = render(CameraSelectScreen);

    // Both tile names are present
    expect(getByText('Tethered DSLR')).toBeTruthy();
    expect(getByText('Webcam')).toBeTruthy();

    // Root has the documented test id
    expect(getByTestId('camera-select-screen')).toBeTruthy();

    // Resolve probe so the unmount cleanup does not see an orphaned pending fetch
    resolveFetch!(
      new Response(JSON.stringify({ gphoto2Available: true }), { status: 200 }),
    );
  });

  it("DSLR tile shows 'Checking…' while the probe is in-flight", () => {
    const { getByText } = render(CameraSelectScreen);
    // Probe never resolves in this test — initial state must show the loading copy
    expect(getByText('Checking…')).toBeTruthy();
  });

  it("Webcam tile always shows 'Available'", () => {
    const { getByText } = render(CameraSelectScreen);
    expect(getByText('Available')).toBeTruthy();
  });

  it("updates DSLR tile to 'Connected' when probe returns gphoto2Available: true", async () => {
    const { findByText } = render(CameraSelectScreen);

    resolveFetch!(
      new Response(JSON.stringify({ gphoto2Available: true }), { status: 200 }),
    );

    // findByText polls until the reactive update flushes
    const connected = await findByText('Connected');
    expect(connected).toBeTruthy();
  });

  it("updates DSLR tile to 'Not detected' when probe returns gphoto2Available: false", async () => {
    const { findByText } = render(CameraSelectScreen);

    resolveFetch!(
      new Response(JSON.stringify({ gphoto2Available: false }), { status: 200 }),
    );

    const notDetected = await findByText('Not detected');
    expect(notDetected).toBeTruthy();
  });

  it("falls back to 'Not detected' when the probe request fails", async () => {
    const { findByText } = render(CameraSelectScreen);

    rejectFetch!(new TypeError('network down'));

    const notDetected = await findByText('Not detected');
    expect(notDetected).toBeTruthy();
  });
});
