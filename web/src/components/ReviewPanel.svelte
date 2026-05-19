<script lang="ts">
  import type { Shot } from '$lib/types.ts';
  import PrimaryButton from './PrimaryButton.svelte';
  import SecondaryButton from './SecondaryButton.svelte';
  import ShotProgress from './ShotProgress.svelte';

  interface Props {
    shot: Shot;
    current: number;
    total: number;
    onKeep: () => void;
    onRetake: () => void;
  }
  let { shot, current, total, onKeep, onRetake }: Props = $props();
</script>

<div class="review-panel">
  <div class="image-frame">
    <img
      src={shot.objectUrl}
      alt="Shot {current} of {total}"
      class="shot-image"
    />
  </div>
  <ShotProgress {current} {total} />
  <div class="button-row">
    <PrimaryButton onclick={onKeep}>Keep</PrimaryButton>
    <SecondaryButton onclick={onRetake}>Retake</SecondaryButton>
  </div>
</div>

<style>
  .review-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-lg);
    width: 100%;
    height: 100%;
    background: var(--color-dominant);
    padding: var(--space-xl);
    box-sizing: border-box;
  }

  .image-frame {
    background: var(--color-secondary);
    padding: var(--space-sm);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shot-image {
    max-width: 80vw;
    max-height: 60vh;
    object-fit: contain;
    border-radius: 4px;
    display: block;
  }

  .button-row {
    display: flex;
    flex-direction: row;
    gap: var(--space-lg);
    align-items: center;
    justify-content: center;
  }
</style>
