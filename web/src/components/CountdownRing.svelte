<script lang="ts">
  /**
   * CountdownRing — 240px SVG progress ring with centered numeral.
   * Ring fill is CSS @keyframes (fires once on mount) — not JS-driven.
   * Passing elapsed as a prop caused the transition to restart every 50ms,
   * so the ring never completed. CSS animation is interrupt-free.
   *
   * Props:
   *   countdownMs: number — total countdown duration in ms (drives animation-duration)
   *   digit: number — discrete numeral to display (3 → 2 → 1)
   */
  let { countdownMs = 3000, digit } = $props<{
    countdownMs: number;
    digit: number;
  }>();

  const RADIUS = 108;
  const STROKE = 8;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
</script>

<svg
  width="240"
  height="240"
  viewBox="0 0 240 240"
  aria-label="Countdown timer"
  style="--circ: {CIRCUMFERENCE}; --cd-ms: {countdownMs}ms;"
>
  <!-- Track ring (secondary surface) -->
  <circle
    cx="120"
    cy="120"
    r={RADIUS}
    stroke="var(--color-secondary)"
    stroke-width={STROKE}
    fill="none"
  />
  <!-- Progress arc — CSS animation fires once on mount, runs for countdownMs -->
  <circle
    class="progress-arc"
    cx="120"
    cy="120"
    r={RADIUS}
    stroke="var(--color-accent)"
    stroke-width={STROKE}
    fill="none"
    stroke-linecap="round"
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={CIRCUMFERENCE}
    transform="rotate(-90 120 120)"
  />
  <!-- Centered countdown digit -->
  <text
    x="120"
    y="120"
    text-anchor="middle"
    dominant-baseline="central"
    font-size="96"
    font-weight="600"
    fill="var(--color-text)"
  >{digit}</text>
</svg>

<style>
  .progress-arc {
    animation: countdown-fill var(--cd-ms) linear forwards;
  }
  @keyframes countdown-fill {
    from { stroke-dashoffset: var(--circ); }
    to   { stroke-dashoffset: 0; }
  }
</style>
