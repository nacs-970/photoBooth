<script lang="ts">
  /**
   * CountdownRing — 240px SVG progress ring with centered numeral.
   * Pattern 4: SVG stroke-dashoffset (RESEARCH.md)
   * D-11: Fills as time passes; number centered in ring.
   *
   * Props:
   *   elapsed: number — milliseconds elapsed since countdown start
   *   countdownMs: number — total countdown duration (default COUNTDOWN_MS = 3000)
   *   digit: number — discrete numeral to display (3 → 2 → 1)
   */
  let { elapsed = 0, countdownMs = 3000, digit } = $props<{
    elapsed: number;
    countdownMs: number;
    digit: number;
  }>();

  const RADIUS = 108;
  const STROKE = 8;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // dashoffset: full circumference at elapsed=0, 0 at elapsed=countdownMs
  let dashoffset = $derived(CIRCUMFERENCE * (1 - elapsed / countdownMs));
</script>

<svg width="240" height="240" viewBox="0 0 240 240" aria-label="Countdown timer">
  <!-- Track ring (secondary surface) -->
  <circle
    cx="120"
    cy="120"
    r={RADIUS}
    stroke="var(--color-secondary)"
    stroke-width={STROKE}
    fill="none"
  />
  <!-- Progress arc — starts at top (rotate -90deg) -->
  <circle
    cx="120"
    cy="120"
    r={RADIUS}
    stroke="var(--color-accent)"
    stroke-width={STROKE}
    fill="none"
    stroke-linecap="round"
    stroke-dasharray={CIRCUMFERENCE}
    stroke-dashoffset={dashoffset}
    transform="rotate(-90 120 120)"
    style="transition: stroke-dashoffset {countdownMs}ms linear;"
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
