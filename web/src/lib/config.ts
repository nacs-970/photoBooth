export const SHOT_COUNT = 4;
export const COUNTDOWN_MS = 3000;
export const FLASH_DURATION_MS = 300;
export const TOAST_DISPLAY_MS = 1200;
export const TRANSITION_MS = 250;

// Security mitigation T-01-T: validate config ranges at module load
if (SHOT_COUNT <= 0 || SHOT_COUNT > 10 || COUNTDOWN_MS <= 0) {
  throw new Error(
    `Invalid config: SHOT_COUNT=${SHOT_COUNT} (must be 1–10), COUNTDOWN_MS=${COUNTDOWN_MS} (must be > 0)`,
  );
}
