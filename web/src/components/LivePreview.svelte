<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CameraAdapter } from '$lib/camera/CameraAdapter.ts';
  import { TetheredAdapter } from '$lib/camera/TetheredAdapter.ts';

  interface Props {
    adapter: CameraAdapter | null;
  }
  let { adapter }: Props = $props();

  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;

  function reAttach() {
    if (adapter) {
      const el = adapter instanceof TetheredAdapter ? canvasEl : videoEl;
      if (el) {
        adapter.attachPreview(el).catch((err) => {
          console.error('[LivePreview] re-attach after retry failed:', err);
        });
      }
    }
  }

  $effect(() => {
    if (adapter) {
      const el = adapter instanceof TetheredAdapter ? canvasEl : videoEl;
      if (el) {
        adapter.attachPreview(el).catch((err) => {
          console.error('[LivePreview] attachPreview failed:', err);
        });
      }
    }
  });

  onMount(() => {
    // Listen for camera-reattach event dispatched by App.svelte handleRetry on success
    window.addEventListener('camera-reattach', reAttach);
  });

  onDestroy(() => {
    window.removeEventListener('camera-reattach', reAttach);
  });
</script>

{#if adapter instanceof TetheredAdapter}
  <canvas bind:this={canvasEl} class="live-preview" aria-label="Live DSLR preview"></canvas>
{:else}
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
{/if}

<style>
  .live-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--color-dominant);
    display: block;
  }
</style>
