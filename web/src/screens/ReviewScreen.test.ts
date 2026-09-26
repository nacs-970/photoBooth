/**
 * Tests for web/src/screens/ReviewScreen.svelte — CR-03 (02-REVIEW):
 * Keep / Retake act once per screen; extra taps are ignored.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReviewScreen from './ReviewScreen.svelte';
import { session } from '$lib/session.svelte';
import { TOAST_DISPLAY_MS } from '$lib/config';

beforeEach(() => {
  vi.useFakeTimers();
  const blob = new Blob(['x'], { type: 'image/jpeg' });
  session.shots = [{ blob, objectUrl: 'blob:shot-0' }];
  session.currentShotIndex = 0;
  session.screen = 'review';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReviewScreen', () => {
  it('a double tap on Keep advances only one shot', async () => {
    const { getByText } = render(ReviewScreen);
    const keep = getByText('Keep');

    await fireEvent.click(keep);
    await vi.advanceTimersByTimeAsync(100);
    await fireEvent.click(keep);
    await vi.advanceTimersByTimeAsync(TOAST_DISPLAY_MS * 3);

    expect(session.currentShotIndex).toBe(1);
    expect(session.screen).toBe('countdown_preview');
  });

  it('Retake during the "Photo saved" toast still cancels the Keep', async () => {
    const { getByText } = render(ReviewScreen);

    await fireEvent.click(getByText('Keep'));
    await vi.advanceTimersByTimeAsync(100);
    await fireEvent.click(getByText('Retake'));
    await vi.advanceTimersByTimeAsync(TOAST_DISPLAY_MS * 3);

    expect(session.currentShotIndex).toBe(0);
    expect(session.screen).toBe('countdown_preview');
  });

  it('a tap on Keep after the Keep timer fired is ignored', async () => {
    // Slot 1 filled too, so the Keep button stays rendered after the index advances.
    session.shots[1] = { blob: session.shots[0].blob, objectUrl: 'blob:shot-1' };
    const { getByText } = render(ReviewScreen);
    const keep = getByText('Keep');

    await fireEvent.click(keep);
    await vi.advanceTimersByTimeAsync(TOAST_DISPLAY_MS + 10);
    // The old screen is still on screen during the 250ms fade-out.
    await fireEvent.click(keep);
    await vi.advanceTimersByTimeAsync(TOAST_DISPLAY_MS * 3);

    expect(session.currentShotIndex).toBe(1);
  });
});
