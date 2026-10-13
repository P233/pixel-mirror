<script lang="ts">
  // Svelte
  import { onMount } from "svelte";

  // Stores
  import { gridOverlayStore } from "~/stores/gridOverlayStore.svelte";
  import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

  onMount(() => {
    gridOverlayStore.init();
  });

  let isGridVisible = $derived(!mockupOverlayStore.isSolidOrZoomed);

  function scaleValue(value: string, multiplier: number): string {
    return value.replace(/[\d.]+/, (n) => String(+n * multiplier));
  }
</script>

{#if gridOverlayStore.showSpacingGrid && isGridVisible}
  <div
    class="spacing-grid"
    style:background-image="linear-gradient(to bottom, {gridOverlayStore.spacingGridColor}
    {gridOverlayStore.spacingGridHeight}, transparent {gridOverlayStore.spacingGridHeight})"
    style:background-size="100% {scaleValue(gridOverlayStore.spacingGridHeight, 2)}"
  ></div>
{/if}

{#if gridOverlayStore.showLayoutGrid && gridOverlayStore.activeLayoutGrid && isGridVisible}
  {@const grid = gridOverlayStore.activeLayoutGrid}
  <div class="layout-grid layout-grid--{grid.position}">
    <div
      class="layout-grid__inner"
      style:width={grid.width}
      style:padding-left={grid.isGutterOnOutside ? scaleValue(grid.gutterWidth, 0.5) : undefined}
      style:padding-right={grid.isGutterOnOutside ? scaleValue(grid.gutterWidth, 0.5) : undefined}
      style:gap={grid.gutterWidth}
    >
      {#each { length: grid.columns }, i (i)}
        <div class="layout-grid__column" style:background={gridOverlayStore.layoutGridColor}></div>
      {/each}
    </div>
  </div>
{/if}

<style lang="scss">
  .spacing-grid {
    position: absolute;
    inset: 0;
    z-index: $max-z-index - 1;
    pointer-events: none;
  }

  .layout-grid {
    position: fixed;
    inset: 0;
    z-index: $max-z-index - 2;
    display: flex;
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
      height: 100%;
    }

    &__column {
      flex: 1;
      height: 100%;
    }
  }
</style>
