<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { session, setCameraInfo, hideDisconnect, showDisconnect } from '$lib/session.svelte.ts';
  import type { CameraInfo } from '$lib/types.ts';
  import { cameraAdapter } from '$lib/camera/adapter.ts';
  import IdleScreen from './screens/IdleScreen.svelte';
  import CountdownScreen from './screens/CountdownScreen.svelte';
  import ReviewScreen from './screens/ReviewScreen.svelte';
  import PhotoGridScreen from './screens/PhotoGridScreen.svelte';
  import DisconnectModal from './components/DisconnectModal.svelte';

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

  /**
   * Retry handler for DisconnectModal.
   * dispose() → init() → re-register onDisconnect → dispatch camera-reattach.
   * On success: hideDisconnect(). On failure: keep modal visible so user can try again.
   * T-04-DoS mitigation: dispose() always called before init() to prevent stream leak.
   */
  async function handleRetry(): Promise<void> {
    try {
      await cameraAdapter.dispose();
      await cameraAdapter.init();
      cameraAdapter.onDisconnect(showDisconnect);
      // Signal LivePreview (and any other consumers) to re-attach the new stream
      window.dispatchEvent(new CustomEvent('camera-reattach'));
      hideDisconnect();
    } catch (err) {
      console.error('[App] Retry camera init failed — modal stays visible:', err);
      // Do NOT call hideDisconnect — keep modal visible so user can tap Retry again
    }
  }
</script>

{#key session.screen}
  <div class="screen-wrapper" transition:fade={{ duration: 250, easing: cubicOut }}>
    {#if session.screen === 'idle'}
      <IdleScreen />
    {:else if session.screen === 'countdown_preview'}
      <CountdownScreen />
    {:else if session.screen === 'review'}
      <ReviewScreen />
    {:else if session.screen === 'photo_grid'}
      <PhotoGridScreen />
    {/if}
  </div>
{/key}

<!-- DisconnectModal is mounted OUTSIDE the {#key} block so it is not unmounted
     on screen transitions. It renders above all screens via z-index. -->
<DisconnectModal visible={session.disconnected} onRetry={handleRetry} />

<style>
  .screen-wrapper {
    width: 100vw;
    height: 100vh;
    position: absolute;
    inset: 0;
  }
</style>
