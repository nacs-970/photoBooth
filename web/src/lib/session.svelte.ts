import type { ScreenName, Shot, CameraInfo } from './types.ts';
import { SHOT_COUNT, COUNTDOWN_MS } from './config.ts';

/**
 * Session state machine.
 *
 * CRITICAL (Pitfall 4 — RESEARCH.md): Export an object, NOT individual primitive bindings.
 * Primitive bindings cannot be re-assigned across module boundaries in Svelte 5.
 * Object property access is proxied and reactive across module boundaries.
 */
export const session = $state({
  screen: 'idle' as ScreenName,
  shots: [] as Shot[],
  currentShotIndex: 0,
  disconnected: false,
  cameraInfo: null as CameraInfo | null,
  config: {
    shotCount: SHOT_COUNT,
    countdownMs: COUNTDOWN_MS,
  },
});

/**
 * Begin a new session.
 * Clears all shots, resets index, transitions to countdown_preview.
 */
export function startSession(): void {
  session.shots = [];
  session.currentShotIndex = 0;
  session.screen = 'countdown_preview';
}

/**
 * Save (or overwrite) a captured shot at the given index.
 * Revokes the previous objectUrl if the slot is occupied (T-01-IL mitigation).
 * Retake-in-place: SESS-04 — new capture replaces shots[N] at the same index.
 */
export function saveShot(blob: Blob, index: number): void {
  // Revoke existing objectUrl at this index to prevent memory leak (T-01-IL)
  if (session.shots[index]?.objectUrl) {
    URL.revokeObjectURL(session.shots[index].objectUrl);
  }
  session.shots[index] = { blob, objectUrl: URL.createObjectURL(blob) };
}

/**
 * Advance to the next shot.
 * Increments currentShotIndex. Transitions to photo_grid after all shots taken.
 */
export function nextShot(): void {
  session.currentShotIndex++;
  if (session.currentShotIndex >= session.config.shotCount) {
    session.screen = 'photo_grid';
  } else {
    session.screen = 'countdown_preview';
  }
}

/**
 * Reset to idle state.
 * Revokes ALL object URLs before clearing shots array (T-01-IL mitigation).
 */
export function resetSession(): void {
  session.shots.forEach((s) => URL.revokeObjectURL(s.objectUrl));
  session.shots = [];
  session.currentShotIndex = 0;
  session.screen = 'idle';
}

/**
 * Transition to the review screen.
 * Called by CountdownScreen after capture + flash sequence completes.
 */
export function goToReview(): void {
  session.screen = 'review';
}

/**
 * Show the disconnect modal (CAM-04 — Plan 04 wires the full modal component).
 */
export function showDisconnect(): void {
  session.disconnected = true;
}

/**
 * Hide the disconnect modal.
 */
export function hideDisconnect(): void {
  session.disconnected = false;
}

/**
 * Store the capability probe result from GET /api/camera/info.
 */
export function setCameraInfo(info: CameraInfo): void {
  session.cameraInfo = info;
}
