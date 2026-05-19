<script lang="ts">
  /**
   * ReviewScreen — per-shot review with Keep / Retake.
   * Mounts on session.screen === 'review'.
   *
   * Flow:
   *   - Shows current shot thumbnail, shot progress, Keep and Retake buttons.
   *   - Keep (not last): show "Photo saved" toast for TOAST_DISPLAY_MS, then keepShot().
   *   - Keep (last shot): keepShot() immediately (goes to photo_grid).
   *   - Retake: retakeShot() immediately (back to countdown_preview, slot preserved until saveShot).
   *
   * T-03-DoS mitigation: setTimeout handles stored and cleared in handleRetake and onDestroy.
   */
  import { onDestroy } from 'svelte';
  import ReviewPanel from '../components/ReviewPanel.svelte';
  import Toast from '../components/Toast.svelte';
  import { session, keepShot, retakeShot } from '$lib/session.svelte.ts';
  import { TOAST_DISPLAY_MS } from '$lib/config.ts';

  let toastVisible = $state(false);

  // Timer handles for cleanup (T-03-DoS)
  let toastHideTimer: ReturnType<typeof setTimeout> | undefined;
  let keepShotTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers(): void {
    if (toastHideTimer !== undefined) {
      clearTimeout(toastHideTimer);
      toastHideTimer = undefined;
    }
    if (keepShotTimer !== undefined) {
      clearTimeout(keepShotTimer);
      keepShotTimer = undefined;
    }
  }

  // Cleanup on component destroy to prevent timer leak (T-03-DoS)
  onDestroy(() => {
    clearTimers();
  });

  function handleKeep(): void {
    const isLastShot = session.currentShotIndex >= session.config.shotCount - 1;
    if (isLastShot) {
      // Last shot: go directly to photo_grid, no toast
      keepShot();
    } else {
      // Between shots: show toast, then advance
      toastVisible = true;
      // Fade out toast at 1050ms (150ms fade-out completes at 1200ms)
      toastHideTimer = setTimeout(() => {
        toastVisible = false;
        toastHideTimer = undefined;
      }, TOAST_DISPLAY_MS - 150);
      // Advance to next shot after full toast duration (1200ms total)
      keepShotTimer = setTimeout(() => {
        keepShotTimer = undefined;
        keepShot();
      }, TOAST_DISPLAY_MS);
    }
  }

  function handleRetake(): void {
    // Cancel any in-flight toast timers (T-03-DoS)
    clearTimers();
    toastVisible = false;
    retakeShot();
  }
</script>

<div class="review-screen">
  {#if session.shots[session.currentShotIndex]}
    <ReviewPanel
      shot={session.shots[session.currentShotIndex]}
      current={session.currentShotIndex + 1}
      total={session.config.shotCount}
      onKeep={handleKeep}
      onRetake={handleRetake}
    />
  {/if}
  <Toast visible={toastVisible} message="Photo saved" />
</div>

<style>
  .review-screen {
    width: 100vw;
    height: 100vh;
    position: relative;
    background: var(--color-dominant);
  }
</style>
