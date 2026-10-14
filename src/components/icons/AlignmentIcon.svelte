<script lang="ts">
  interface Props {
    /** The aligned position to mark; nothing is marked while either axis is moved freely */
    x: MockupAlignmentX;
    y: MockupAlignmentY;
    size?: number;
  }

  let { x, y, size = 20 }: Props = $props();

  // Lucide grip-horizontal's 2x3 layout (like the alignment matrix), spread to the full icon width
  const COLUMNS = { left: 4, center: 12, right: 20 } as const;
  const ROWS = { top: 8, bottom: 16 } as const;
  const DOTS = (["top", "bottom"] as const).flatMap((row) =>
    (["left", "center", "right"] as const).map((column) => ({ row, column, cx: COLUMNS[column], cy: ROWS[row] }))
  );

  let hasMark = $derived(x !== null && y !== null);
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
  {#each DOTS as dot (`${dot.row}-${dot.column}`)}
    {#if dot.row === y && dot.column === x}
      <circle class="mark" cx={dot.cx} cy={dot.cy} r="3.75" fill="currentColor" />
    {:else}
      <circle cx={dot.cx} cy={dot.cy} r="2.25" fill="currentColor" opacity={hasMark ? 0.45 : 1} />
    {/if}
  {/each}
</svg>
