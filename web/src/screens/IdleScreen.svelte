<script lang="ts">
  import { onMount } from 'svelte';
  import LivePreview from '../components/LivePreview.svelte';
  import PrimaryButton from '../components/PrimaryButton.svelte';
  import { startSession, showDisconnect } from '$lib/session.svelte.ts';
  import { cameraAdapter } from '$lib/camera/adapter.ts';
  import { unlockAudio } from '$lib/audio.ts';

  onMount(async () => {
    try {
      await cameraAdapter.init();
      // Wire disconnect callback BEFORE attachPreview so we never miss a disconnect
      // that fires between init() and the first video frame (CAM-04).
      cameraAdapter.onDisconnect(showDisconnect);
    } catch (err: unknown) {
      const domErr = err as DOMException;
      if (domErr?.name === 'NotAllowedError') {
        // Permission-denied path: console-only in Phase 1.
        // A dedicated permission-denied screen is acknowledged as deferred polish.
        // The app surfaces the generic DisconnectModal as a user-visible fallback
        // if the user taps Retry after revoking permission (T-04-Crash mitigation).
        console.warn('[IdleScreen] Camera permission denied:', err);
      } else {
        // Any other init failure (e.g. hardware error, device busy):
        // surface the disconnect modal so the user sees a bounded error, not a blank screen.
        console.error('[IdleScreen] Camera init failed:', err);
        window.dispatchEvent(new CustomEvent('camera-init-error', { detail: { message: err instanceof Error ? err.message : String(err) } }));
        showDisconnect();
      }
    }
  });

  function handleStart() {
    // CRITICAL — Pitfall 2, T-02-Aud: unlockAudio MUST be called synchronously
    // in the same click handler as startSession(), with NO await between them.
    // Any async gap breaks user-gesture inheritance and causes NotAllowedError.
    unlockAudio();
    startSession();
  }
</script>

<div class="idle-screen">
  <div class="preview-bg">
    <LivePreview adapter={cameraAdapter} />
  </div>
  <div class="overlay">
    <PrimaryButton onclick={handleStart}>Tap to Start</PrimaryButton>
  </div>
</div>

<style>
  .idle-screen {
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
  }
</style>
