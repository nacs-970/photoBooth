<script lang="ts">
  interface Props {
    current: number;
    total: number;
  }
  let { current, total }: Props = $props();
</script>

<span class="shot-progress">Shot {current} of {total}</span>

<style>
  .shot-progress {
    font-size: var(--size-body);
    color: var(--color-text-muted);
    font-family: var(--font-family);
    line-height: 1.5;
  }
</style>
