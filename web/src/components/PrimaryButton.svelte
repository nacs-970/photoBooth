<script lang="ts">
  interface Props {
    onclick?: () => void;
    children?: import('svelte').Snippet;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
  }
  let { onclick, children, type = 'button', disabled = false }: Props = $props();
</script>

<button {type} {disabled} {onclick} class="primary-btn">
  {@render children?.()}
</button>

<style>
  .primary-btn {
    background: var(--color-accent);
    color: var(--color-dominant);
    font-size: var(--size-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-family);
    min-height: var(--touch-min);
    padding: var(--space-md) var(--space-xl);
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    line-height: 1.3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 100ms ease;
    user-select: none;
  }

  .primary-btn:active {
    transform: scale(0.97);
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
