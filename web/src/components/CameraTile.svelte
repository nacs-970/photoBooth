<script lang="ts">
  /**
   * CameraTile — interactive tile for camera source selection on CameraSelectScreen.
   *
   * Spec: .planning/phases/02-tethered-dslr-capture-gphoto2/02-UI-SPEC.md
   *   - Camera name: Display size (96px / 600 semibold), #F5F5F7
   *   - Status pill below: Body size (18px / 400 regular), optional 8px dot
   *   - Tile surface: #1F1F25 (Secondary), 12px radius, 280x320 minimum
   *   - Press feedback: 100ms ease-out → #2A2A2F, 50ms return (no scale)
   *   - Status pill fade-in: 150ms ease-in when transitioning from 'checking'
   */
  type Status = 'checking' | 'connected' | 'not-detected' | 'available';

  interface Props {
    cameraName: string;
    status: Status;
    onSelect: () => void;
  }

  let { cameraName, status, onSelect }: Props = $props();

  const statusConfig: Record<
    Status,
    { dot: 'connected' | 'unavailable' | null; text: string; textColor: 'neutral' | 'muted' }
  > = {
    checking: { dot: null, text: 'Checking…', textColor: 'muted' },
    connected: { dot: 'connected', text: 'Connected', textColor: 'neutral' },
    'not-detected': { dot: 'unavailable', text: 'Not detected', textColor: 'muted' },
    available: { dot: null, text: 'Available', textColor: 'neutral' },
  };

  // testid uses lowercase, hyphenated form so tests can target tiles by name.
  // Wrapped in $derived so the reference is captured through Svelte 5 reactivity
  // rather than at module-eval time (avoids state_referenced_locally warning).
  const testId = $derived(`camera-tile-${cameraName.toLowerCase().replace(/ /g, '-')}`);
</script>

<button
  type="button"
  class="tile"
  data-testid={testId}
  onclick={onSelect}
>
  <span class="name">{cameraName}</span>
  <span class="status status-{status}">
    {#if statusConfig[status].dot}
      <span class="dot dot-{statusConfig[status].dot}" aria-hidden="true"></span>
    {/if}
    <span class="status-text status-text-{statusConfig[status].textColor}">
      {statusConfig[status].text}
    </span>
  </span>
</button>

<style>
  .tile {
    /* Reset button defaults */
    appearance: none;
    border: 0;
    margin: 0;
    cursor: pointer;

    /* Layout: vertical stack, content centered */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    /* Dimensions per UI-SPEC */
    min-width: 280px;
    min-height: 320px;
    padding: 32px;
    gap: 16px;

    /* Surface */
    background: #1f1f25; /* --color-secondary */
    border-radius: 12px;
    color: #f5f5f7;

    /* Press feedback: 100ms ease-out → #2A2A2F */
    transition: background-color 100ms ease-out;
  }

  .tile:active {
    background: #2a2a2f; /* --color-surface-pressed */
    /* 50ms return is the released-state transition; same property, different duration */
    transition: background-color 50ms ease-out;
  }

  .tile:focus-visible {
    outline: 2px solid #ffcc00; /* Accent — focus ring only, not a fill */
    outline-offset: 4px;
  }

  .name {
    font-size: 96px; /* Display */
    font-weight: 600;
    line-height: 1;
    color: #f5f5f7;
    text-align: center;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 18px; /* Body */
    font-weight: 400;

    /* Status pill fade-in: 150ms ease-in from 'checking' to resolved state */
    animation: status-fade-in 150ms ease-in;
  }

  /* Override animation for the initial 'checking' state so it does not fade in
     on first paint — only resolved states (connected / not-detected / available
     after a checking→resolved transition) get the fade. */
  .status-checking {
    animation: none;
  }

  .status-text-neutral {
    color: #f5f5f7;
  }

  .status-text-muted {
    color: #9a9aa3;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot-connected {
    background: #3ddc84; /* --color-status-connected */
  }

  .dot-unavailable {
    background: #9a9aa3; /* --color-status-unavailable */
  }

  @keyframes status-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
