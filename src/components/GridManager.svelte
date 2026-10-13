<script lang="ts">
  // Svelte
  import { onMount } from "svelte";

  // Icons
  import IconDelete from "~/assets/delete-02-stroke-rounded.svg?component";
  import IconToggle from "~/assets/toggle-on-stroke-rounded.svg?component";
  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { gridManagerStore } from "~/stores/gridManagerStore.svelte";
  import { gridOverlayStore } from "~/stores/gridOverlayStore.svelte";
  // Utils
  import { withDefaultUnit } from "~/utils/validation";

  onMount(() => {
    gridManagerStore.init();
  });

  // Editable drafts: each resets only when its own store value changes (e.g., after save or reset),
  // so saving one field doesn't discard unsaved edits in the others
  let spacingGridHeightInput = $derived(gridOverlayStore.spacingGridHeight);
  let spacingGridColorInput = $derived(gridOverlayStore.spacingGridColor);
  let layoutGridColorInput = $derived(gridOverlayStore.layoutGridColor);

  let canUpdateSpacingGridHeight = $derived(
    spacingGridHeightInput.trim() !== "" && spacingGridHeightInput !== gridOverlayStore.spacingGridHeight
  );
  let canUpdateSpacingGridColor = $derived(
    spacingGridColorInput.trim() !== "" && spacingGridColorInput !== gridOverlayStore.spacingGridColor
  );
  let canUpdateLayoutGridColor = $derived(
    layoutGridColorInput.trim() !== "" && layoutGridColorInput !== gridOverlayStore.layoutGridColor
  );

  let newGridWidth = $state("");
  let newGridColumns = $state("");
  let newGridGutter = $state("");
  let newGridGutterOutside = $state(true);
  let newGridPosition = $state<LayoutGridPosition>("center");

  let canAddGrid = $derived(
    newGridWidth.trim() && newGridGutter.trim() && /^\d+$/.test(newGridColumns) && Number(newGridColumns) > 0
  );

  function handleKeydown(e: KeyboardEvent, updateFn: () => void, isChanged: boolean) {
    if (e.key === "Enter" && isChanged) {
      updateFn();
    }
  }

  function updateSpacingHeight() {
    gridManagerStore.updateSpacingGridHeight(spacingGridHeightInput.trim());
  }

  function updateSpacingColor() {
    gridManagerStore.updateSpacingGridColor(spacingGridColorInput.trim());
  }

  function updateLayoutColor() {
    gridManagerStore.updateLayoutGridColor(layoutGridColorInput.trim());
  }

  async function handleAddGrid() {
    const id = await gridManagerStore.add({
      width: withDefaultUnit(newGridWidth),
      columns: Number(newGridColumns),
      gutterWidth: withDefaultUnit(newGridGutter),
      isGutterOnOutside: newGridGutterOutside,
      position: newGridPosition
    });
    // Keep the user's input when validation or saving failed
    if (!id) return;

    newGridWidth = "";
    newGridColumns = "";
    newGridGutter = "";
    newGridGutterOutside = true;
    newGridPosition = "center";
  }
</script>

{#if gridManagerStore.initialized}
  <div class="container">
    <div class="inner">
      <section class="section">
        <header class="header">
          <h3 class="header__title">Spacing Grids</h3>
          <button
            class="header__toggle-button"
            class:enabled={gridOverlayStore.showSpacingGrid}
            data-testid="btn-toggle-spacing"
            onclick={gridManagerStore.toggleSpacingGrid}
          >
            <IconToggle />
          </button>
        </header>

        <div
          class="section__content"
          class:disabled={!gridOverlayStore.showSpacingGrid}
          inert={!gridOverlayStore.showSpacingGrid}
        >
          <fieldset class="fieldset">
            <legend class="fieldset__legend">Spacing Grid Height</legend>
            <input
              class="fieldset__input"
              type="text"
              bind:value={spacingGridHeightInput}
              onkeydown={(e) => handleKeydown(e, updateSpacingHeight, canUpdateSpacingGridHeight)}
              spellcheck="false"
            />
            <button class="fieldset__button" disabled={!canUpdateSpacingGridHeight} onclick={updateSpacingHeight}
              >Update</button
            >
          </fieldset>

          <fieldset class="fieldset" style:background-color={spacingGridColorInput}>
            <legend class="fieldset__legend">Spacing Grid Color</legend>
            <input
              class="fieldset__input"
              type="text"
              bind:value={spacingGridColorInput}
              onkeydown={(e) => handleKeydown(e, updateSpacingColor, canUpdateSpacingGridColor)}
              spellcheck="false"
            />
            <button class="fieldset__button" disabled={!canUpdateSpacingGridColor} onclick={updateSpacingColor}
              >Update</button
            >
          </fieldset>
        </div>
      </section>

      <section class="section">
        <div class="header">
          <h3 class="header__title">Layout Grids</h3>
          <button
            class="header__toggle-button"
            class:enabled={gridOverlayStore.showLayoutGrid}
            data-testid="btn-toggle-layout"
            onclick={gridManagerStore.toggleLayoutGrid}
          >
            <IconToggle />
          </button>
        </div>

        <div
          class="section__content"
          class:disabled={!gridOverlayStore.showLayoutGrid}
          inert={!gridOverlayStore.showLayoutGrid}
        >
          <fieldset class="fieldset" style:background-color={layoutGridColorInput}>
            <legend class="fieldset__legend">Layout Grid Color</legend>
            <input
              class="fieldset__input"
              type="text"
              bind:value={layoutGridColorInput}
              onkeydown={(e) => handleKeydown(e, updateLayoutColor, canUpdateLayoutGridColor)}
              spellcheck="false"
            />
            <button class="fieldset__button" onclick={updateLayoutColor} disabled={!canUpdateLayoutGridColor}
              >Update</button
            >
          </fieldset>

          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Width</th>
                  <th>Columns</th>
                  <th>Gutter Width</th>
                  <th>Outer Gutter</th>
                  <th>Position</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each gridManagerStore.layoutGrids as grid (grid.id)}
                  {@const isActive = gridOverlayStore.activeLayoutGridId === grid.id}
                  <tr
                    class:active={isActive}
                    onclick={() => gridManagerStore.setActiveLayoutGrid(grid.id)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        gridManagerStore.setActiveLayoutGrid(grid.id);
                      }
                    }}
                  >
                    <td>{grid.width}</td>
                    <td>{grid.columns}</td>
                    <td>{grid.gutterWidth}</td>
                    <td>{grid.isGutterOnOutside ? "Yes" : "No"}</td>
                    <td style="text-transform: capitalize;">{grid.position}</td>
                    <td class="table__actions">
                      <button
                        class="table__button table__button--delete"
                        onclick={(e) => {
                          e.stopPropagation();
                          gridManagerStore.delete(grid.id);
                        }}
                        disabled={isActive}
                        title={isActive ? "Cannot delete active grid" : "Delete this grid"}
                        aria-label="Delete grid"
                      >
                        <IconDelete />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <input type="text" placeholder="1140px" bind:value={newGridWidth} spellcheck="false" />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="12"
                      bind:value={newGridColumns}
                      spellcheck="false"
                    />
                  </td>
                  <td>
                    <input type="text" placeholder="24px" bind:value={newGridGutter} spellcheck="false" />
                  </td>
                  <td>
                    <select bind:value={newGridGutterOutside}>
                      <option value={true}>Yes</option>
                      <option value={false}>No</option>
                    </select>
                  </td>
                  <td>
                    <select bind:value={newGridPosition}>
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </td>
                  <td>
                    <button class="table__add-button" onclick={handleAddGrid} disabled={!canAddGrid}>Add</button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
    <footer class="footer">
      <button class="footer__button" data-testid="btn-reset" onclick={gridManagerStore.reset}>Reset All Settings</button
      >
      <button class="footer__button" data-testid="btn-close" onclick={dockStore.enterToolbar}>Close</button>
    </footer>
  </div>
{/if}

<style lang="scss">
  .container {
    @include manager-container;
  }

  .inner {
    @include manager-inner;
  }

  .footer {
    @include manager-footer;

    &__button {
      @include manager-footer-button;
    }
  }

  .section {
    &:not(:last-child) {
      margin-bottom: rhythm(4);
    }

    &__content {
      transition: opacity $transition-fast ease;

      &.disabled {
        pointer-events: none;
        opacity: 0.5;
      }
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: rhythm(1);

    &__title {
      margin: 0;
      font-size: 18px;
      line-height: rhythm(3);
    }

    &__toggle-button {
      @include btn-base;
      display: flex;
      gap: rhythm(0.5);
      align-items: center;
      width: 116px;
      padding: 0 rhythm(1.25);
      font-size: 15px;
      line-height: rhythm(4);

      &::after {
        flex: 1;
        text-align: center;
        content: "Disabled";
      }

      &.enabled::after {
        content: "Enabled";
      }

      :global(> svg) {
        flex: none;
      }

      :global(#toggle-trigger) {
        transform: translateX(-8px);
        transition: transform 0.25s $timing-function;
      }

      &.enabled :global(#toggle-trigger) {
        transform: translateX(0);
      }
    }
  }

  .fieldset {
    display: flex;
    align-items: center;
    padding: rhythm(1) rhythm(2);
    margin: 0 0 rhythm(2);
    border: $border-width-md solid var(--border-medium);
    border-radius: rhythm(1.5);

    &:has(:focus-visible) {
      @include focus-ring;

      > .fieldset__legend {
        @include focus-ring;
      }
    }

    &__legend {
      padding: 0 rhythm(1);
      margin-left: rhythm(-0.5);
      font-size: 15px;
      line-height: 24px;
      color: var(--btn-fg);
      background: var(--btn-bg);
      border-radius: rhythm(0.75);
    }

    &__input {
      display: block;
      flex: 1;
      width: 100%;
      padding: rhythm(1) rhythm(1) rhythm(1) 0;
      font-family: monospace;
      font-size: 16px;
      line-height: rhythm(3);
      color: var(--input-text);
      outline: none;
      background: transparent;
      border: none;

      &::placeholder {
        color: var(--input-placeholder);
      }
    }

    &__button {
      @include btn-base;
      padding: 0 rhythm(1.5);
      font-size: 14px;
      line-height: rhythm(3);
    }
  }

  .table-wrapper {
    margin-top: rhythm(2.5);
    overflow: auto;
    border: $border-width-md solid var(--border-medium);
    border-radius: rhythm(1.5);
  }

  .table {
    width: max-content;
    min-width: 100%;
    font-size: 15px;
    line-height: 16px;
    text-align: left;
    white-space: nowrap;
    border-spacing: 0;
    border-collapse: collapse;

    &__actions {
      text-align: center;
    }

    &__button--delete {
      color: var(--text-secondary);
      border-radius: rhythm(1);
      transition: color $transition-fast ease;

      :global(> svg) {
        width: rhythm(2);
        height: rhythm(2);
        margin-top: 2px;
      }

      &:hover:not(:disabled) {
        color: var(--color-danger);
      }

      &:focus-visible {
        @include focus-ring($border-width-md);
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }

    > thead {
      color: var(--text-primary);
      border-bottom: $border-width-sm solid var(--border-light);
    }

    > tbody {
      color: var(--text-secondary);
      text-transform: capitalize;

      > tr {
        cursor: pointer;
        outline: none;
        border-bottom: $border-width-sm solid var(--border-light);
        transition:
          background $transition-fast ease,
          color $transition-fast ease;

        &:hover {
          background: var(--color-success-bg);
        }

        &:focus-visible {
          box-shadow: inset 0 0 0 $border-width-md var(--focus-ring);
        }

        &.active {
          color: var(--color-success);
          cursor: default;
          background: var(--color-success-bg);

          &:hover {
            background: var(--color-success-bg);
          }

          &:focus-visible {
            box-shadow: inset 0 0 0 $border-width-md var(--focus-ring);
          }
        }
      }
    }

    th {
      height: rhythm(5);
      padding: 0 rhythm(1);

      &:not(:last-child) {
        border-right: $border-width-sm solid var(--border-light);
      }
    }

    td {
      height: rhythm(4);
      padding: 0 rhythm(1);

      &:not(:last-child) {
        border-right: $border-width-sm solid var(--border-light);
      }
    }

    > tfoot {
      td {
        height: rhythm(5);
        padding: 0 rhythm(1);
      }

      input,
      select {
        height: rhythm(3);
        padding: 0 rhythm(0.5);
        font-size: 15px;
        color: var(--input-text);
        outline: none;
        background: var(--input-bg);
        border: $border-width-sm solid var(--input-border);
        border-radius: rhythm(0.75);

        // Prevent iOS Safari auto-zoom on input focus (requires >= 16px)
        @media (max-width: 680px) {
          font-size: 16px;
        }

        &:focus-visible {
          @include focus-ring($border-width-md);
        }
      }

      input {
        width: 72px;

        &::placeholder {
          color: var(--input-placeholder);
        }
      }

      select {
        cursor: pointer;
      }
    }

    &__add-button {
      @include btn-base;
      height: rhythm(3);
      padding: 0 rhythm(1.5);
      font-size: 14px;
    }
  }
</style>
