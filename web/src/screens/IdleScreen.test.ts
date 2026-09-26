/**
 * Tests for web/src/screens/IdleScreen.svelte — WR-03 (02-REVIEW):
 * after IDLE_PREVIEW_MS with no interaction the live preview is detached (so the
 * stream closes and the server's idle shell close can run); the next tap re-attaches it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import IdleScreen from './IdleScreen.svelte';
import { IDLE_PREVIEW_MS } from '$lib/config';

const fakeAdapter = vi.hoisted(() => ({
  init: vi.fn(async () => {}),
  attachPreview: vi.fn(async () => {}),
  capture: vi.fn(async () => new Blob()),
  dispose: vi.fn(async () => {}),
  onDisconnect: vi.fn(),
}));

vi.mock('$lib/camera/adapter.ts', () => ({ cameraAdapter: fakeAdapter }));

beforeEach(() => {
  vi.useFakeTimers();
  fakeAdapter.attachPreview.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('IdleScreen idle preview detach', () => {
  it('detaches the live preview after IDLE_PREVIEW_MS without interaction', async () => {
    const { container } = render(IdleScreen);
    await tick();
    expect(container.querySelector('.live-preview')).not.toBeNull();
    expect(fakeAdapter.attachPreview).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(IDLE_PREVIEW_MS - 1000);
    expect(container.querySelector('.live-preview')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(container.querySelector('.live-preview')).toBeNull();
  });

  it('re-attaches the preview on the next tap', async () => {
    const { container } = render(IdleScreen);
    await vi.advanceTimersByTimeAsync(IDLE_PREVIEW_MS);
    await tick();
    expect(container.querySelector('.live-preview')).toBeNull();

    await fireEvent.pointerDown(window);
    await tick();
    expect(container.querySelector('.live-preview')).not.toBeNull();
    expect(fakeAdapter.attachPreview).toHaveBeenCalledTimes(2);
  });

  it('an interaction restarts the idle timer', async () => {
    const { container } = render(IdleScreen);
    await vi.advanceTimersByTimeAsync(IDLE_PREVIEW_MS - 1000);
    await fireEvent.pointerDown(window);
    await vi.advanceTimersByTimeAsync(2000);
    await tick();
    expect(container.querySelector('.live-preview')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(IDLE_PREVIEW_MS);
    await tick();
    expect(container.querySelector('.live-preview')).toBeNull();
  });
});
