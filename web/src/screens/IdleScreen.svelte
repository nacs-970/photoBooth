<script lang="ts">
  import { onMount } from 'svelte';
  import LivePreview from '../components/LivePreview.svelte';
  import PrimaryButton from '../components/PrimaryButton.svelte';
  import { startSession } from '$lib/session.svelte.ts';
  import { cameraAdapter } from '$lib/camera/adapter.ts';

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
