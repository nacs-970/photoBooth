<script lang="ts">
  /**
   * CountdownScreen — combined live preview + countdown trigger + flash + capture.
   * Plan 02 delivers single-shot capture: SESS-01, SESS-02, SESS-03.
   *
   * Flow:
   *   1. Mount: show live preview + "Start" button (D-10 — no auto-start)
   *   2. Start tap: begin 3s countdown — digit updates 3→2→1
   *   3. At 0: flash + shutter + capture → saveShot → goToReview
   *
   * T-02-DoS mitigations:
   *   - Start button disabled while phase === 'counting' (no double-fire)
   *   - Countdown interval/timeout cleared in onDestroy via $effect cleanup
   */
  import { onDestroy } from 'svelte';
  import LivePreview from '../components/LivePreview.svelte';
  import CountdownRing from '../components/CountdownRing.svelte';
  import FlashOverlay from '../components/FlashOverlay.svelte';
  import PrimaryButton from '../components/PrimaryButton.svelte';
  import { cameraAdapter } from '$lib/camera/adapter.ts';
  import { playShutter } from '$lib/audio.ts';
  import { session, saveShot, clearShot, goToReview } from '$lib/session.svelte.ts';
  import { COUNTDOWN_MS, FLASH_DURATION_MS } from '$lib/config.ts';

  // Phase: pre (waiting for Start tap) | counting (ring running) | flashing (capture in progress)
  let phase = $state<'pre' | 'counting' | 'flashing'>('pre');
  let elapsed = $state(0);
  let flashVisible = $state(false);

  // Digit: counts 3 → 2 → 1, never goes below 1 while ring is filling
  let digit = $derived(Math.max(1, Math.ceil((COUNTDOWN_MS - elapsed) / 1000)));

  // Timer handles for cleanup (T-02-DoS)
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let flashTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (flashTimeoutId !== null) {
      clearTimeout(flashTimeoutId);
      flashTimeoutId = null;
    }
  }

  // Cleanup on component destroy to prevent timer leak (T-02-DoS)
  onDestroy(() => {
    clearTimers();
  });

  async function handleStart() {
    if (phase === 'counting' || phase === 'flashing') return; // guard (T-02-DoS)

    phase = 'counting';
    elapsed = 0;

    // Digit-step interval: tick elapsed by 1000ms every second
    // CSS transition handles smooth ring fill; this only drives the digit + terminal check
    const startTime = Date.now();

    intervalId = setInterval(() => {
      const now = Date.now();
      elapsed = Math.min(now - startTime, COUNTDOWN_MS);

      if (elapsed >= COUNTDOWN_MS) {
        clearInterval(intervalId!);
        intervalId = null;
        triggerCapture();
      }
    }, 50); // 50ms interval for accurate terminal detection; CSS handles smooth animation
  }

  async function triggerCapture() {
    phase = 'flashing';

    // Simultaneously: flash + shutter + capture (D-12)
    flashVisible = true;
    playShutter();
    // WR-04: fade after the normal flash duration, not when capture() settles (~4s on a DSLR).
    setTimeout(() => (flashVisible = false), FLASH_DURATION_MS);

    let blob: Blob;
    try {
      blob = await cameraAdapter.capture();
    } catch (err) {
      console.error('[CountdownScreen] capture() failed:', err);
      clearShot(session.currentShotIndex);
      // Even on failure, complete the flash sequence and advance
      flashTimeoutId = setTimeout(() => {
        flashVisible = false;
        goToReview();
      }, FLASH_DURATION_MS);
      return;
    }

    saveShot(blob, session.currentShotIndex);

    // Flash fades out after FLASH_DURATION_MS (300ms)
    flashTimeoutId = setTimeout(() => {
      flashVisible = false;
      goToReview();
    }, FLASH_DURATION_MS);
  }
</script>

<div class="countdown-screen">
  <!-- Full-bleed live preview (always visible) -->
  <div class="preview-bg">
    <LivePreview adapter={cameraAdapter} />
  </div>

  <!-- Overlay: Start button (pre) or CountdownRing (counting/flashing) -->
  <div class="overlay">
    {#if phase === 'pre'}
      <PrimaryButton onclick={handleStart} disabled={false}>Start</PrimaryButton>
    {:else if phase === 'counting' || phase === 'flashing'}
      <CountdownRing countdownMs={COUNTDOWN_MS} {digit} />
    {/if}
  </div>

  <!-- Flash overlay — always present so CSS fade-out transition fires on visible=false -->
  <FlashOverlay visible={flashVisible} />
</div>

<style>
  .countdown-screen {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--color-dominant);
  }

  .preview-bg {
    position: absolute;
    inset: 0;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  /* Re-enable pointer events on interactive children */
  .overlay :global(button),
  .overlay :global(svg) {
    pointer-events: auto;
  }
</style>
