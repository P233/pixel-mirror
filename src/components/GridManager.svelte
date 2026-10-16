<script lang="ts">
  // Svelte
  import { tick } from "svelte";
  // Components
  import ColorField from "./ColorField.svelte";
  import Icon from "./icons/Icon.svelte";
  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { gridStore } from "~/stores/gridStore.svelte";
  // Utils
  import { withDefaultUnit } from "~/utils/validation";

  const SPACING_HEIGHT_PRESETS = ["4px", "8px", "16px"] as const;

  const uid = $props.id();

  // Editable draft: resets only when the stored height changes (e.g., after save or reset), so saving
  // another field doesn't discard an unsaved edit here (the color fields keep their own drafts)
  let spacingGridHeightInput = $derived(gridStore.spacingGridHeight);

  // The new-grid form is folded away until needed, which keeps the panel short
  let isAddingGrid = $state(false);
  let newGridButton = $state<HTMLButtonElement>();
  let newGridWidthInput = $state<HTMLInputElement>();
  let newGridWidth = $state("");
  let newGridColumns = $state("");
  let newGridGutter = $state("");
  let newGridGutterOutside = $state(true);
  let newGridPosition = $state<LayoutGridPosition>("center");
  let confirmingReset = $state(false);
  let resetButton = $state<HTMLButtonElement>();

  let canAddGrid = $derived(
    newGridWidth.trim() && newGridGutter.trim() && /^\d+$/.test(newGridColumns) && Number(newGridColumns) > 0
  );

  function describeGrid(grid: LayoutGridConfig) {
    return {
      summary: `${grid.width} · ${grid.columns} columns · ${grid.gutterWidth} gutters`,
      details: `${grid.position[0].toUpperCase()}${grid.position.slice(1)} · ${grid.isGutterOnOutside ? "outer gutters" : "no outer gutters"}`
    };
  }

  function handleFieldKeydown(e: KeyboardEvent, commitFn: () => void) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitFn();
    }
  }

  function commitSpacingHeight() {
    const trimmed = spacingGridHeightInput.trim();
    if (!trimmed) {
      spacingGridHeightInput = gridStore.spacingGridHeight;
      return;
    }
    if (trimmed !== gridStore.spacingGridHeight) {
      gridStore.updateSpacingGridHeight(trimmed);
    }
  }

  async function openNewGridForm() {
    isAddingGrid = true;
    await tick();
    newGridWidthInput?.focus();
  }

  async function closeNewGridForm() {
    isAddingGrid = false;
    newGridWidth = "";
    newGridColumns = "";
    newGridGutter = "";
    newGridGutterOutside = true;
    newGridPosition = "center";
    await tick();
    newGridButton?.focus();
  }

  async function handleAddGrid(e: SubmitEvent) {
    e.preventDefault();
    if (!canAddGrid) return;

    const id = await gridStore.add({
      width: withDefaultUnit(newGridWidth),
      columns: Number(newGridColumns),
      gutterWidth: withDefaultUnit(newGridGutter),
      isGutterOnOutside: newGridGutterOutside,
      position: newGridPosition
    });
    // Keep the user's input when validation or saving failed
    if (id) await closeNewGridForm();
  }

  async function handleResetClick() {
    if (gridStore.isResetting) return;
    if (!confirmingReset) {
      confirmingReset = true;
      return;
    }
    const root = resetButton?.getRootNode() as Document | ShadowRoot | undefined;
    const hadFocus = root?.activeElement === resetButton;
    const succeeded = await gridStore.reset();
    if (succeeded) {
      confirmingReset = false;
      isAddingGrid = false;
      newGridWidth = "";
      newGridColumns = "";
      newGridGutter = "";
    }
    await tick();
    if (hadFocus && resetButton?.isConnected) resetButton.focus();
  }
</script>

{#if gridStore.initialized}
  <div class="container" role="region" aria-label="Grid Manager">
    <div class="inner" inert={gridStore.isResetting}>
      <section class="section">
        <header class="section__header">
          <div class="section__heading">
            <h3 class="section__title" id="{uid}-spacing-title">Spacing Grids</h3>
            <span class="section__hint">Vertical rhythm</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gridStore.showSpacingGrid}
            aria-labelledby="{uid}-spacing-title"
            class="switch"
            data-testid="btn-toggle-spacing"
            onclick={gridStore.toggleSpacingGrid}
          >
            <span class="switch__thumb"></span>
          </button>
        </header>

        <div
          class="section__body fields"
          class:disabled={!gridStore.showSpacingGrid}
          inert={!gridStore.showSpacingGrid}
        >
          <div class="field">
            <label class="field__label" for="{uid}-spacing-height">Height</label>
            <div class="field__row">
              <input
                id="{uid}-spacing-height"
                class="control control--short"
                type="text"
                placeholder="8px"
                title="Stripe height in px or rem"
                bind:value={spacingGridHeightInput}
                onchange={commitSpacingHeight}
                onkeydown={(e) => handleFieldKeydown(e, commitSpacingHeight)}
                spellcheck="false"
              />
              <div class="presets" role="group" aria-label="Height presets">
                {#each SPACING_HEIGHT_PRESETS as preset (preset)}
                  <button
                    type="button"
                    class="preset"
                    aria-pressed={gridStore.spacingGridHeight === preset}
                    onclick={() => gridStore.updateSpacingGridHeight(preset)}
                  >
                    {preset}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <ColorField
            value={gridStore.spacingGridColor}
            fallback="#ff0000"
            pickerLabel="Pick spacing grid color"
            opacityLabel="Spacing grid opacity"
            pickerTestId="picker-spacing-color"
            onchange={gridStore.updateSpacingGridColor}
          />
        </div>
      </section>

      <section class="section">
        <header class="section__header">
          <div class="section__heading">
            <h3 class="section__title" id="{uid}-layout-title">Layout Grids</h3>
            <span class="section__hint">Columns and gutters</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gridStore.showLayoutGrid}
            aria-labelledby="{uid}-layout-title"
            class="switch"
            data-testid="btn-toggle-layout"
            onclick={gridStore.toggleLayoutGrid}
          >
            <span class="switch__thumb"></span>
          </button>
        </header>

        <div class="section__body" class:disabled={!gridStore.showLayoutGrid} inert={!gridStore.showLayoutGrid}>
          <div class="fields">
            <ColorField
              value={gridStore.layoutGridColor}
              fallback="#0000ff"
              pickerLabel="Pick layout grid color"
              opacityLabel="Layout grid opacity"
              pickerTestId="picker-layout-color"
              onchange={gridStore.updateLayoutGridColor}
            />
          </div>

          <div class="field">
            <div class="grids-header">
              <span class="field__label" id="{uid}-grids-label">Grids</span>
              {#if !isAddingGrid}
                <button bind:this={newGridButton} type="button" class="text-button" onclick={openNewGridForm}>
                  <Icon name="plus" size={14} />
                  New grid
                </button>
              {/if}
            </div>

            <div class="grid-list" role="radiogroup" aria-labelledby="{uid}-grids-label">
              {#each gridStore.layoutGrids as grid (grid.id)}
                {@const isActive = gridStore.activeLayoutGridId === grid.id}
                {@const description = describeGrid(grid)}
                <div class="grid-option" class:active={isActive}>
                  <label class="grid-option__choice">
                    <input
                      type="radio"
                      class="grid-option__radio"
                      name="{uid}-active-grid"
                      checked={isActive}
                      onchange={() => gridStore.setActiveLayoutGrid(grid.id)}
                    />
                    <span class="grid-option__mark" aria-hidden="true"></span>
                    <span class="grid-option__text">
                      <span class="grid-option__summary">{description.summary}</span>
                      <span class="grid-option__details">{description.details}</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    class="grid-option__delete"
                    onclick={() => gridStore.delete(grid.id)}
                    disabled={isActive}
                    title={isActive ? "The grid in use can't be deleted" : "Delete this grid"}
                    aria-label="Delete grid {description.summary}"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              {/each}
            </div>
          </div>

          {#if isAddingGrid}
            <form class="new-grid" aria-label="New grid" onsubmit={handleAddGrid}>
              <div class="field">
                <label class="field__label" for="{uid}-new-width">Width</label>
                <input
                  bind:this={newGridWidthInput}
                  id="{uid}-new-width"
                  class="control"
                  type="text"
                  placeholder="1044px"
                  bind:value={newGridWidth}
                  spellcheck="false"
                />
              </div>
              <div class="field">
                <label class="field__label" for="{uid}-new-columns">Columns</label>
                <input
                  id="{uid}-new-columns"
                  class="control"
                  type="text"
                  inputmode="numeric"
                  placeholder="12"
                  bind:value={newGridColumns}
                  spellcheck="false"
                />
              </div>
              <div class="field">
                <label class="field__label" for="{uid}-new-gutter">Gutter</label>
                <input
                  id="{uid}-new-gutter"
                  class="control"
                  type="text"
                  placeholder="24px"
                  bind:value={newGridGutter}
                  spellcheck="false"
                />
              </div>
              <div class="field">
                <label class="field__label" for="{uid}-new-outer">Outer gutters</label>
                <select id="{uid}-new-outer" class="control" bind:value={newGridGutterOutside}>
                  <option value={true}>Yes</option>
                  <option value={false}>No</option>
                </select>
              </div>
              <div class="field">
                <label class="field__label" for="{uid}-new-position">Position</label>
                <select id="{uid}-new-position" class="control" bind:value={newGridPosition}>
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div class="new-grid__actions">
                <button type="button" class="button button--ghost" onclick={closeNewGridForm}>Cancel</button>
                <button type="submit" class="button" disabled={!canAddGrid}>Add grid</button>
              </div>
            </form>
          {/if}
        </div>
      </section>
    </div>
    <footer class="footer">
      {#if confirmingReset}
        <button
          type="button"
          class="footer__button footer__button--ghost"
          data-testid="btn-cancel-reset"
          onclick={() => (confirmingReset = false)}
        >
          Cancel
        </button>
      {/if}
      <button
        type="button"
        class="footer__button"
        class:footer__button--ghost={!confirmingReset}
        class:footer__button--danger={confirmingReset}
        bind:this={resetButton}
        disabled={gridStore.isResetting}
        data-testid="btn-reset"
        onclick={handleResetClick}
      >
        {confirmingReset ? "Confirm Reset?" : "Reset All Settings"}
      </button>
      <button type="button" class="footer__button" data-testid="btn-close" onclick={dockStore.enterToolbar}>
        Close
      </button>
    </footer>
  </div>
{/if}

<style lang="scss">
  .container {
    @include manager-container;
  }

  .inner {
    @include manager-inner;
    display: flex;
    flex-direction: column;
    gap: rhythm(2.5);
  }

  .footer {
    @include manager-footer;

    &__button {
      @include manager-footer-button;

      &--ghost {
        @include btn-ghost;
      }

      &--danger {
        @include btn-danger;
      }
    }
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: rhythm(1.5);

    & + & {
      padding-top: rhythm(2.5);
      border-top: $border-width-sm solid var(--pm-border-subtle);
    }

    &__header {
      display: flex;
      gap: rhythm(2);
      align-items: center;
      justify-content: space-between;
    }

    &__heading {
      display: flex;
      flex-wrap: wrap;
      column-gap: rhythm(1);
      align-items: baseline;
      min-width: 0;
    }

    &__title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
      color: var(--pm-text-primary);
    }

    &__hint {
      font-size: 12px;
      color: var(--pm-text-secondary);
    }

    &__body {
      display: flex;
      flex-direction: column;
      gap: rhythm(1.5);
      transition: opacity $transition-fast ease;

      &.disabled {
        pointer-events: none;
        opacity: 0.45;
      }
    }
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: rhythm(1.5) rhythm(2);
    // Keeps side-by-side controls in line even when one label wraps
    align-items: end;

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;

    &__label {
      @include field-label;
    }

    &__row {
      display: flex;
      gap: rhythm(1);
      align-items: center;
    }
  }

  .control {
    @include form-control;
    width: 100%;
    min-width: 0;

    &::placeholder {
      color: var(--pm-text-muted);
    }

    &:focus-visible {
      @include form-control-focus;
    }

    &--short {
      flex: 0 1 auto;
      width: 112px;
    }
  }

  // Our own chevron, inset from the edge: the native arrow hugs the border
  select.control {
    padding-right: rhythm(4.5);
    font-family: var(--pm-font-sans);
    appearance: none;
    cursor: pointer;
    background-image: var(--pm-select-arrow);
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 16px;
  }

  .presets {
    display: flex;
    gap: 4px;
  }

  .preset {
    height: 28px;
    padding: 0 rhythm(1);
    font-family: var(--pm-font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--pm-text-secondary);
    border: $border-width-sm solid var(--pm-border-subtle);
    border-radius: 6px;
    transition:
      background $transition-fast ease,
      color $transition-fast ease,
      border-color $transition-fast ease;

    &:hover {
      color: var(--pm-text-primary);
      background: var(--pm-surface-hover);
    }

    &:focus-visible {
      @include focus-ring;
    }

    &[aria-pressed="true"] {
      color: var(--pm-accent-text);
      background: var(--pm-accent-subtle);
      border-color: transparent;
    }
  }

  .switch {
    position: relative;
    flex: none;
    width: 34px;
    height: 20px;
    background: var(--pm-switch-off);
    border-radius: var(--pm-radius-pill);
    // The off track alone is too faint to show the control's bounds (needs 3:1)
    box-shadow: inset 0 0 0 $border-width-sm var(--pm-border-control);
    transition: background $transition-fast ease;

    &:focus-visible {
      @include focus-ring;
    }

    &__thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform $transition-fast $timing-function;
    }

    &[aria-checked="true"] {
      background: var(--pm-accent);
      box-shadow: none;

      .switch__thumb {
        background: var(--pm-accent-fg);
        transform: translateX(14px);
      }
    }
  }

  .grids-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
  }

  .text-button {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 24px;
    padding: 0 rhythm(1);
    font-size: 12px;
    font-weight: 600;
    color: var(--pm-accent-text);
    border-radius: 6px;
    transition: background $transition-fast ease;

    &:hover {
      background: var(--pm-accent-subtle);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .grid-list {
    overflow: hidden;
    border: $border-width-sm solid var(--pm-border-strong);
    border-radius: var(--pm-radius-card);
  }

  .grid-option {
    position: relative;
    display: flex;
    align-items: center;
    transition: background $transition-fast ease;

    & + & {
      border-top: $border-width-sm solid var(--pm-border-subtle);
    }

    &:hover {
      background: var(--pm-surface-hover);
    }

    &.active {
      background: var(--pm-surface-active);
    }

    &__choice {
      display: flex;
      flex: 1;
      gap: rhythm(1.25);
      align-items: center;
      min-width: 0;
      padding: rhythm(1) rhythm(1.5);
      cursor: pointer;

      &:has(:focus-visible) {
        box-shadow: inset 0 0 0 $border-width-md var(--pm-focus-ring);
      }
    }

    &.active &__choice {
      cursor: default;
    }

    &__radio {
      @include visually-hidden;
    }

    &__mark {
      display: grid;
      flex: none;
      place-items: center;
      width: 16px;
      height: 16px;
      border: 1.5px solid var(--pm-border-control);
      border-radius: 50%;

      &::after {
        width: 8px;
        height: 8px;
        content: "";
        border-radius: 50%;
      }
    }

    &__radio:checked + &__mark {
      border-color: var(--pm-accent);

      &::after {
        background: var(--pm-accent);
      }
    }

    &__text {
      display: flex;
      flex-wrap: wrap;
      gap: 2px rhythm(1);
      align-items: baseline;
      min-width: 0;
      font-size: 13px;
      line-height: 18px;
    }

    &__summary {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--pm-text-primary);
    }

    &__details {
      font-size: 12px;
      color: var(--pm-text-secondary);
    }

    &__delete {
      display: grid;
      flex: none;
      place-items: center;
      width: 32px;
      height: 32px;
      margin-right: rhythm(0.75);
      color: var(--pm-text-secondary);
      border-radius: 6px;
      transition: color $transition-fast ease;

      &:hover:not(:disabled) {
        color: var(--pm-danger-text);
      }

      &:focus-visible {
        @include focus-ring;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }
  }

  .new-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.8fr) minmax(0, 1.2fr) minmax(0, 1fr);
    gap: rhythm(1.25) rhythm(1);
    // Keeps the controls in line if a label wraps
    align-items: end;
    padding: rhythm(1.5);
    background: var(--pm-surface-subtle);
    border: $border-width-sm solid var(--pm-border-subtle);
    border-radius: var(--pm-radius-card);

    @media (max-width: 560px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__actions {
      display: flex;
      grid-column: 1 / -1;
      gap: rhythm(1);
      justify-content: flex-end;
    }
  }

  .button {
    @include btn-base;
    height: rhythm(3.75);
    padding: 0 rhythm(1.5);
    font-size: 12px;
    font-weight: 600;

    border: $border-width-sm solid transparent;

    &--ghost {
      @include btn-ghost;
    }
  }
</style>
