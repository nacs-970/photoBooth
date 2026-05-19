<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { session, setCameraInfo } from '$lib/session.svelte.ts';
  import type { CameraInfo } from '$lib/types.ts';
  import IdleScreen from './screens/IdleScreen.svelte';

  onMount(async () => {
    try {
      const res = await fetch('/api/camera/info');
      if (res.ok) {
        const info = (await res.json()) as CameraInfo;
        setCameraInfo(info);
      }
    } catch (err) {
      console.error('[App] Could not reach /api/camera/info:', err);
    }
  });
</script>

{#key session.screen}
  <div class="screen-wrapper" transition:fade={{ duration: 250, easing: cubicOut }}>
    {#if session.screen === 'idle'}
      <IdleScreen />
    {:else if session.screen === 'countdown_preview'}
      <div class="placeholder">Countdown screen placeholder — Plan 02 wires this up</div>
    {:else if session.screen === 'review'}
      <div class="placeholder">Review screen placeholder — Plan 02 wires this up</div>
    {:else if session.screen === 'photo_grid'}
      <div class="placeholder">Photo grid placeholder — Plan 03 wires this up</div>
    {/if}
  </div>
{/key}

<style>
  .screen-wrapper {
    width: 100vw;
    height: 100vh;
    position: absolute;
    inset: 0;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background: var(--color-dominant);
    color: var(--color-text-muted);
    font-size: var(--size-body);
  }
</style>
