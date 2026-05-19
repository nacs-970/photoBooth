<script lang="ts">
  import { onMount } from 'svelte';
  import LivePreview from '../components/LivePreview.svelte';
  import PrimaryButton from '../components/PrimaryButton.svelte';
  import { startSession } from '$lib/session.svelte.ts';
  import { cameraAdapter } from '$lib/camera/adapter.ts';
  import { unlockAudio } from '$lib/audio.ts';

  onMount(async () => {
    try {
      await cameraAdapter.init();
    } catch (err) {
      console.error('[IdleScreen] Camera init failed:', err);
      // Plan 04 wires the full permission-denied / disconnect handling.
      // For Plan 01, log the error and let the user see a dark preview.
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
