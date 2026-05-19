<script lang="ts">
  interface Props {
    onclick?: () => void;
    children?: import('svelte').Snippet;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }
  let { onclick, children, type = 'button', disabled = false }: Props = $props();
</script>

<button {type} {disabled} {onclick} class="secondary-btn">
  {@render children?.()}
</button>

<style>
  .secondary-btn {
    background: var(--color-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-text-muted);
    font-size: var(--size-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-family);
    min-height: var(--touch-min);
    padding: var(--space-md) var(--space-xl);
    border-radius: 8px;
    cursor: pointer;
    line-height: 1.3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 100ms ease;
    user-select: none;
  }

  .secondary-btn:active {
    transform: scale(0.97);
  }

  .secondary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
