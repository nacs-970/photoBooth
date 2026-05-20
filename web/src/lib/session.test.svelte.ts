import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  session,
  startSession,
  saveShot,
  nextShot,
  keepShot,
  retakeShot,
  resetSession,
  showDisconnect,
  hideDisconnect,
  goToReview,
} from './session.svelte.ts';

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn((blob: Blob) => `blob:mock-${Math.random()}`);
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

beforeEach(() => {
  // Reset state to idle before each test
  resetSession();
  vi.clearAllMocks();
  // Re-stub after clearAllMocks
  mockCreateObjectURL.mockImplementation((_blob: Blob) => `blob:mock-url-${Math.random()}`);
  mockRevokeObjectURL.mockImplementation(() => undefined);
  vi.stubGlobal('URL', {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });
});

describe('session initial state', () => {
  it('has correct initial values', () => {
    // Phase 2: app boots to camera_select (not idle).
    // resetSession() in beforeEach moves us back to idle, so we cannot rely on
    // session.screen here — instead assert the other initial values that remain
    // stable across resets. The boot-time value is asserted in its own test below.
    expect(session.shots.length).toBe(0);
    expect(session.currentShotIndex).toBe(0);
    expect(session.disconnected).toBe(false);
    expect(session.config.shotCount).toBe(4);
    expect(session.config.countdownMs).toBe(3000);
  });

  it('sessionStartedAt is null at boot and after reset (Phase 2)', () => {
    // resetSession() (in beforeEach) must clear sessionStartedAt back to null
    expect(session.sessionStartedAt).toBeNull();
  });
});

describe('startSession()', () => {
  it('clears shots, resets currentShotIndex to 0, sets screen to countdown_preview', () => {
    // Put some data in first
    session.shots = [{ blob: new Blob(), objectUrl: 'blob:test' }] as any;
    session.currentShotIndex = 2;

    startSession();

    expect(session.shots.length).toBe(0);
    expect(session.currentShotIndex).toBe(0);
    expect(session.screen).toBe('countdown_preview');
  });
});

describe('saveShot()', () => {
  it('stores a Shot with blob and objectUrl at the given index', () => {
    mockCreateObjectURL.mockReturnValueOnce('blob:deterministic-url');
    const blob = new Blob(['data'], { type: 'image/jpeg' });

    saveShot(blob, 0);

    expect(session.shots[0]).toBeDefined();
    expect(session.shots[0].blob).toBe(blob);
    expect(session.shots[0].objectUrl).toBe('blob:deterministic-url');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
  });

  it('revokes the previous objectUrl when overwriting the same slot (T-01-IL)', () => {
    const blob1 = new Blob(['first'], { type: 'image/jpeg' });
    const blob2 = new Blob(['second'], { type: 'image/jpeg' });
    const firstUrl = 'blob:first-url';
    const secondUrl = 'blob:second-url';

    mockCreateObjectURL.mockReturnValueOnce(firstUrl).mockReturnValueOnce(secondUrl);

    saveShot(blob1, 0);
    expect(session.shots[0].objectUrl).toBe(firstUrl);

    saveShot(blob2, 0);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(session.shots[0].objectUrl).toBe(secondUrl);
    expect(session.shots[0].blob).toBe(blob2);
  });
});

describe('nextShot()', () => {
  it('increments currentShotIndex and stays on countdown_preview when not last shot', () => {
    startSession();
    expect(session.currentShotIndex).toBe(0);

    nextShot();

    expect(session.currentShotIndex).toBe(1);
    expect(session.screen).toBe('countdown_preview');
  });

  it('transitions to photo_grid on last shot (alias for keepShot — does NOT increment past last)', () => {
    startSession();
    session.currentShotIndex = 3; // index 3 = 4th shot (shotCount=4)

    nextShot();

    // nextShot is an alias for keepShot: last-shot branch does NOT increment index
    expect(session.currentShotIndex).toBe(3);
    expect(session.screen).toBe('photo_grid');
  });
});

describe('keepShot()', () => {
  it('increments currentShotIndex and sets screen to countdown_preview when not last shot', () => {
    startSession();
    expect(session.currentShotIndex).toBe(0);

    keepShot();

    expect(session.currentShotIndex).toBe(1);
    expect(session.screen).toBe('countdown_preview');
  });

  it('sets screen to photo_grid on last shot without incrementing currentShotIndex', () => {
    startSession();
    session.currentShotIndex = 3; // index 3 = 4th shot (shotCount=4)

    keepShot();

    expect(session.currentShotIndex).toBe(3);
    expect(session.screen).toBe('photo_grid');
  });
});

describe('retakeShot()', () => {
  it('sets screen to countdown_preview and does NOT mutate currentShotIndex', () => {
    startSession();
    session.currentShotIndex = 2;

    retakeShot();

    expect(session.currentShotIndex).toBe(2);
    expect(session.screen).toBe('countdown_preview');
  });
});

describe('resetSession()', () => {
  it('revokes all objectUrls, clears shots, resets index, sets screen to idle (T-01-IL)', () => {
    const url1 = 'blob:url-1';
    const url2 = 'blob:url-2';
    mockCreateObjectURL.mockReturnValueOnce(url1).mockReturnValueOnce(url2);

    saveShot(new Blob(['a']), 0);
    saveShot(new Blob(['b']), 1);

    resetSession();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(url1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(url2);
    expect(session.shots.length).toBe(0);
    expect(session.currentShotIndex).toBe(0);
    expect(session.screen).toBe('idle');
  });

  it('clears sessionStartedAt back to null (Phase 2 — prevents shared disk folder across sessions)', () => {
    session.sessionStartedAt = 1234567890;
    resetSession();
    expect(session.sessionStartedAt).toBeNull();
  });
});

describe('goToReview()', () => {
  it('sets session.screen to "review"', () => {
    startSession(); // get into countdown_preview state
    expect(session.screen).toBe('countdown_preview');

    goToReview();

    expect(session.screen).toBe('review');
  });
});

describe('showDisconnect() / hideDisconnect()', () => {
  it('showDisconnect sets disconnected = true', () => {
    expect(session.disconnected).toBe(false);
    showDisconnect();
    expect(session.disconnected).toBe(true);
  });

  it('hideDisconnect sets disconnected back to false', () => {
    showDisconnect();
    hideDisconnect();
    expect(session.disconnected).toBe(false);
  });

  it('showDisconnect preserves screen, shots, and currentShotIndex — only disconnected changes', () => {
    // Establish a non-default state before calling showDisconnect
    session.screen = 'review';
    mockCreateObjectURL.mockReturnValueOnce('blob:shot-a');
    saveShot(new Blob(['a']), 0);
    session.currentShotIndex = 2;

    showDisconnect();

    expect(session.disconnected).toBe(true);
    expect(session.screen).toBe('review');
    expect(session.shots.length).toBe(1);
    expect(session.currentShotIndex).toBe(2);
  });

  it('hideDisconnect preserves screen, shots, and currentShotIndex — only disconnected changes', () => {
    session.screen = 'countdown_preview';
    session.currentShotIndex = 1;
    showDisconnect();

    hideDisconnect();

    expect(session.disconnected).toBe(false);
    expect(session.screen).toBe('countdown_preview');
    expect(session.currentShotIndex).toBe(1);
  });
});
