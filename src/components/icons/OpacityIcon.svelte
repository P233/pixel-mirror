<script lang="ts">
  interface Props {
    /** 0–1: how far the circle is filled from the bottom, like a liquid level */
    level: number;
    size?: number;
  }

  let { level, size = 20 }: Props = $props();

  const CENTER = 12;
  const RADIUS = 9;

  // The part of the circle below the fill line: a chord closed by the lower arc
  let fillPath = $derived.by(() => {
    const fill = Math.min(Math.max(level, 0), 1);
    if (fill === 0) return "";
    if (fill === 1)
      return `M${CENTER - RADIUS} ${CENTER}a${RADIUS} ${RADIUS} 0 1 0 ${2 * RADIUS} 0a${RADIUS} ${RADIUS} 0 1 0 ${-2 * RADIUS} 0`;
    const y = CENTER + RADIUS - 2 * RADIUS * fill;
    const halfChord = Math.sqrt(RADIUS ** 2 - (y - CENTER) ** 2);
    const largeArc = fill > 0.5 ? 1 : 0;
    return `M${CENTER - halfChord} ${y}A${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${CENTER + halfChord} ${y}Z`;
  });
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  aria-hidden="true"
  focusable="false"
>
  <circle cx="12" cy="12" r="9" />
  {#if fillPath}
    <path d={fillPath} fill="currentColor" stroke="none" />
  {/if}
</svg>
