<script lang="ts">
  import SecondaryButton from './SecondaryButton.svelte';

  interface Props {
    visible: boolean;
    onRetry: () => void;
    message?: string;
  }
  let { visible, onRetry, message = 'Check the cable and try again.' }: Props = $props();
</script>

{#if visible}
  <div class="scrim" data-testid="disconnect-modal-scrim">
    <div class="panel">
      <h2 class="heading">Camera disconnected</h2>
      <p class="body">{message}</p>
      <SecondaryButton onclick={onRetry}>Retry</SecondaryButton>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .panel {
    background: var(--color-secondary);
    padding: var(--space-2xl);
    border-radius: 16px;
    max-width: 480px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .heading {
    font-size: var(--size-heading);
    font-weight: var(--weight-semibold);
    color: var(--color-text);
    margin: 0;
  }

  .body {
    font-size: var(--size-body);
    color: var(--color-text-muted);
    margin: 0;
  }
</style>
