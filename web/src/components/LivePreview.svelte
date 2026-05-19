<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CameraAdapter } from '$lib/camera/CameraAdapter.ts';

  interface Props {
    adapter: CameraAdapter | null;
  }
  let { adapter }: Props = $props();

  let videoEl: HTMLVideoElement;

  function reAttach() {
    if (adapter && videoEl) {
      adapter.attachPreview(videoEl).catch((err) => {
        console.error('[LivePreview] re-attach after retry failed:', err);
      });
    }
  }

  onMount(() => {
    if (adapter && videoEl) {
      adapter.attachPreview(videoEl).catch((err) => {
        console.error('[LivePreview] attachPreview failed:', err);
      });
    }
    // Listen for camera-reattach event dispatched by App.svelte handleRetry on success
    window.addEventListener('camera-reattach', reAttach);
  });

  onDestroy(() => {
    window.removeEventListener('camera-reattach', reAttach);
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
