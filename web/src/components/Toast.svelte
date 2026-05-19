<script lang="ts">
  interface Props {
    visible: boolean;
    message: string;
  }
  let { visible, message }: Props = $props();
</script>

<div class="toast" class:visible>
  {message}
</div>

<style>
  .toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--color-secondary);
    color: var(--color-text);
    font-size: var(--size-heading);
    font-weight: var(--weight-semibold);
    font-family: var(--font-family);
    padding: var(--space-md) var(--space-xl);
    border-radius: 16px;
    opacity: 0;
    z-index: 10000;
    transition: opacity 150ms ease-out;
    pointer-events: none;
    white-space: nowrap;
  }

  .toast.visible {
    opacity: 1;
  }
</style>
