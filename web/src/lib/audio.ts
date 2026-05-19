/**
 * Shutter sound preload + user-gesture unlock + play.
 * Pattern 6: Audio Autoplay Gating (RESEARCH.md)
 *
 * Usage:
 *   1. preloadShutterSound('/sounds/shutter.mp3') at app startup (main.ts)
 *   2. unlockAudio() inside the first user-gesture handler (Tap to Start)
 *   3. playShutter() on each capture
 *
 * Security: Both play() calls wrap .catch(() => {}) so NotAllowedError and iOS silent-mode
 * failures never propagate (Pitfall 2, T-02-Aud).
 */

let shutterAudio: HTMLAudioElement | null = null;
let unlocked = false;

/**
 * Preload the shutter sound asset.
 * Creates an <audio> element with preload="auto" so the browser buffers it immediately.
 * Call this once on app startup (web/src/main.ts) so the asset is ready before first tap.
 */
export function preloadShutterSound(src: string): void {
  shutterAudio = new Audio(src);
  shutterAudio.preload = 'auto';
  shutterAudio.volume = 0.8;
}

/**
 * Unlock the AudioContext by calling a silent play/pause within a user gesture handler.
 * Must be called synchronously inside the first click/tap handler (Tap to Start).
 * Subsequent calls are no-ops (guarded by unlocked flag).
 */
export function unlockAudio(): void {
  if (unlocked || !shutterAudio) return;
  shutterAudio
    .play()
    .then(() => {
      shutterAudio!.pause();
      shutterAudio!.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      /* NotAllowedError — ignore (will try again on next gesture) */
    });
}

/**
 * Play the shutter sound.
 * Rewinds to start so rapid captures don't cut each other off.
 * Swallows rejection (iOS silent mode, policy block) — never throws.
 */
export function playShutter(): void {
  if (!shutterAudio) return;
  shutterAudio.currentTime = 0;
  shutterAudio.play().catch(() => {
    /* iOS silent mode — no crash */
  });
}
