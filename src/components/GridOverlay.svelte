<script lang="ts">
  import { on } from "svelte/events";
  // Stores
  import { gridStore } from "~/stores/gridStore.svelte";
  import { overlayController } from "~/features/overlay/controller.svelte";

  let isGridVisible = $derived(!overlayController.isSolidOrZoomed);
  let scrollOffset = $state(0);

  $effect(() => {
    if (!gridStore.showSpacingGrid || !isGridVisible) return;
    const update = () => {
      scrollOffset = window.scrollY;
    };
    update();
    return on(window, "scroll", update, { passive: true });
  });

  function scaleValue(value: string, multiplier: number): string {
    return value.replace(/[\d.]+/, (n) => String(+n * multiplier));
  }

  function outsideGutter(grid: LayoutGridConfig): string {
    // Solve P = g(W - 2P)/2: percentage gaps use the content width after padding.
    return grid.gutterWidth.endsWith("%")
      ? scaleValue(grid.width, 0.5 / (1 + 100 / parseFloat(grid.gutterWidth)))
      : scaleValue(grid.gutterWidth, 0.5);
  }
</script>

{#if gridStore.showSpacingGrid && isGridVisible}
  <div
    class="spacing-grid"
    style:background-position-y={`${-scrollOffset}px`}
    style:background-image="linear-gradient(to bottom, {gridStore.spacingGridColor}
    {gridStore.spacingGridHeight}, transparent {gridStore.spacingGridHeight})"
    style:background-size="100% {scaleValue(gridStore.spacingGridHeight, 2)}"
  ></div>
{/if}

{#if gridStore.showLayoutGrid && gridStore.activeLayoutGrid && isGridVisible}
  {@const grid = gridStore.activeLayoutGrid}
  <div class="layout-grid layout-grid--{grid.position}">
    <div
      class="layout-grid__inner"
      style:width={grid.width}
      style:padding-left={grid.isGutterOnOutside ? outsideGutter(grid) : undefined}
      style:padding-right={grid.isGutterOnOutside ? outsideGutter(grid) : undefined}
      style:gap={grid.gutterWidth}
    >
      {#each { length: grid.columns }, i (i)}
        <div class="layout-grid__column" style:background={gridStore.layoutGridColor}></div>
      {/each}
    </div>
  </div>
{/if}

<style lang="scss">
  .spacing-grid {
    position: fixed;
    inset: 0;
    z-index: $max-z-index - 1;
    pointer-events: none;
  }

  .layout-grid {
    position: fixed;
    inset: 0;
    z-index: $max-z-index - 2;
    display: flex;
    overflow: hidden;
    overflow: clip;
    pointer-events: none;

    &--center {
      justify-content: center;
    }
    &--left {
      justify-content: flex-start;
    }
    &--right {
      justify-content: flex-end;
    }

    &__inner {
      display: flex;
      flex-shrink: 0;
      height: 100%;
    }

    &__column {
      flex: 1;
      height: 100%;
    }
  }
</style>
