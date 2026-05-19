<script lang="ts">
  import type { Shot } from '$lib/types.ts';

  interface Props {
    shots: Shot[];
  }
  let { shots }: Props = $props();
</script>

<div class="photo-grid">
  {#each shots as shot, i}
    <div class="grid-cell">
      <img src={shot.objectUrl} alt="" class="grid-thumbnail" />
    </div>
  {/each}
</div>

<style>
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-md);
    padding: var(--space-lg);
    width: 100%;
    box-sizing: border-box;
  }

  .grid-cell {
    background: var(--color-secondary);
    padding: var(--space-sm);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid-thumbnail {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }
</style>
