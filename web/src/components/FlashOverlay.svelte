<script lang="ts">
  /**
   * FlashOverlay — full-screen white flash on capture.
   * SESS-02, D-12: 300ms ease-out fade-out.
   *
   * Always rendered (not conditionally mounted) so the CSS transition fires
   * on both visible=true → visible=false transitions.
   */
  interface Props {
    visible: boolean;
  }
  let { visible }: Props = $props();
</script>

<div
  data-testid="flash-overlay"
  class="flash"
  class:visible
></div>

<style>
  .flash {
    position: fixed;
    inset: 0;
    background: #FFFFFF;
    opacity: 0;
    pointer-events: none;
    z-index: 9999;
    transition: opacity var(--motion-flash) ease-out;
  }

  .flash.visible {
    opacity: 1;
  }
</style>
