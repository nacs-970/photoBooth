<script lang="ts">
  /**
   * CameraSelectScreen — Phase 2 Wave 1 boot screen.
   *
   * Behavior (UI-SPEC.md, CONTEXT.md D-01..D-04):
   *   - App boots here on every launch (no persistence).
   *   - On mount: GET /api/camera/info to probe gphoto2 availability.
   *   - DSLR tile: shows 'Checking…' until the probe resolves; then
   *     'Connected' (green dot) or 'Not detected' (grey dot).
   *   - Webcam tile: always 'Available' — getUserMedia is assumed to work.
   *   - Tap a tile → setCameraAdapter(new <Adapter>()) → session.screen = 'idle'.
   *
   * The 'Not detected' DSLR tile is still tappable per UI-SPEC: the host may
   * have just plugged the camera in. Tapping triggers TetheredAdapter.init()
   * which will surface the DisconnectModal on failure (Wave 5 wiring).
   */
  import { onMount } from 'svelte';
  import { session } from '$lib/session.svelte.ts';
  import { setCameraAdapter } from '$lib/camera/adapter.ts';
  import { WebcamAdapter } from '$lib/camera/WebcamAdapter.ts';
  import { TetheredAdapter } from '$lib/camera/TetheredAdapter.ts';
  import CameraTile from '../components/CameraTile.svelte';

  type DslrStatus = 'checking' | 'connected' | 'not-detected';
  let dslrStatus = $state<DslrStatus>('checking');

  onMount(async () => {
    try {
      const res = await fetch('/api/camera/info');
      if (!res.ok) {
        // Backend reachable but probe failed — treat as not detected
        dslrStatus = 'not-detected';
        return;
      }
      const info = (await res.json()) as { gphoto2Available?: boolean };
      dslrStatus = info.gphoto2Available ? 'connected' : 'not-detected';
    } catch (err) {
      // Network failure / backend down — surface as 'Not detected' (D-08).
      // The DisconnectModal path still works if the host taps the tile.
      console.warn('[CameraSelectScreen] /api/camera/info probe failed:', err);
      dslrStatus = 'not-detected';
    }
  });

  function selectDSLR(): void {
    setCameraAdapter(new TetheredAdapter());
    session.screen = 'idle';
  }

  function selectWebcam(): void {
    setCameraAdapter(new WebcamAdapter());
    session.screen = 'idle';
  }
</script>

<div class="screen" data-testid="camera-select-screen">
  <h1 class="heading">Select Camera</h1>
  <div class="tile-row">
    <CameraTile
      cameraName="Tethered DSLR"
      status={dslrStatus}
      onSelect={selectDSLR}
    />
    <CameraTile
      cameraName="Webcam"
      status="available"
      onSelect={selectWebcam}
    />
  </div>
</div>

<style>
  .screen {
    width: 100vw;
    height: 100vh;
    background: #0f0f12; /* --color-dominant */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 48px; /* 2xl from viewport top */
    box-sizing: border-box;
  }

  .heading {
    font-size: 32px; /* Heading */
    font-weight: 600;
    color: #f5f5f7; /* --color-text */
    margin: 0;
    text-align: center;
  }

  .tile-row {
    flex: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 32px; /* xl */
    flex-wrap: wrap;
  }

  /* Stack vertically if viewport is narrower than 2 tiles + gap (280*2 + 32 = 592px) */
  @media (max-width: 624px) {
    .tile-row {
      flex-direction: column;
      gap: 24px; /* lg */
    }
  }
</style>
