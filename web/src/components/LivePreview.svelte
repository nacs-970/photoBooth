<script lang="ts">
  import { onMount } from 'svelte';
  import type { CameraAdapter } from '$lib/camera/CameraAdapter.ts';

  interface Props {
    adapter: CameraAdapter | null;
  }
  let { adapter }: Props = $props();

  let videoEl: HTMLVideoElement;

  onMount(() => {
    if (adapter && videoEl) {
      adapter.attachPreview(videoEl).catch((err) => {
        console.error('[LivePreview] attachPreview failed:', err);
      });
    }
  });
</script>

<video
  bind:this={videoEl}
  autoplay
  playsinline
  muted
  class="live-preview"
  aria-label="Live camera preview"
>
  <track kind="captions" />
</video>

<style>
  .live-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--color-dominant);
    display: block;
  }
</style>
