export const SHOT_COUNT = 4;
export const COUNTDOWN_MS = 3000;
export const FLASH_DURATION_MS = 300;
export const TOAST_DISPLAY_MS = 1200;
export const TRANSITION_MS = 250;
// Idle screen: detach the live preview after this long with no interaction, so the
// DSLR stream closes and the server's idle shell close (SHELL_IDLE_MS) can run.
export const IDLE_PREVIEW_MS = 5 * 60_000;

// Security mitigation T-01-T: validate config ranges at module load
if (SHOT_COUNT <= 0 || SHOT_COUNT > 10 || COUNTDOWN_MS <= 0) {
  throw new Error(
    `Invalid config: SHOT_COUNT=${SHOT_COUNT} (must be 1–10), COUNTDOWN_MS=${COUNTDOWN_MS} (must be > 0)`,
  );
}
