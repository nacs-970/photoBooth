<script lang="ts">
  /**
   * PhotoGridScreen — post-session photo grid stub.
   * Mounts on session.screen === 'photo_grid'.
   *
   * Shows all captured thumbnails and a "Start New Session" CTA.
   * Tapping Start New Session revokes all object URLs and returns to idle.
   */
  import PhotoGrid from '../components/PhotoGrid.svelte';
  import PrimaryButton from '../components/PrimaryButton.svelte';
  import { session, resetSession } from '$lib/session.svelte.ts';
</script>

<div class="photo-grid-screen">
  <h1 class="heading">Your photos</h1>
  <PhotoGrid shots={session.shots} />
  <div class="cta-row">
    <PrimaryButton onclick={resetSession}>Start New Session</PrimaryButton>
  </div>
</div>

<style>
  .photo-grid-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100vw;
    min-height: 100vh;
    background: var(--color-dominant);
    box-sizing: border-box;
    overflow-y: auto;
  }

  .heading {
    font-size: var(--size-heading);
    font-weight: var(--weight-semibold);
    color: var(--color-text);
    font-family: var(--font-family);
    margin: var(--space-xl) 0 var(--space-lg);
    line-height: 1.2;
  }

  .cta-row {
    margin-top: var(--space-2xl);
    margin-bottom: var(--space-2xl);
  }
</style>
