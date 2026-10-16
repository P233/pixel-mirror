<script lang="ts">
  // Svelte
  import { tick } from "svelte";
  import { on } from "svelte/events";
  // Constants
  import { OPACITY_MAX, OPACITY_MIN } from "~/constants";
  // Platform
  import { isTypingInField } from "~/platform/typing";
  // Utils
  import { isLastInputTouch } from "~/utils/device";
  // Icons
  import AlignmentIcon from "./icons/AlignmentIcon.svelte";
  import Icon from "./icons/Icon.svelte";
  import OpacityIcon from "./icons/OpacityIcon.svelte";
  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { overlayController } from "~/features/overlay/controller.svelte";
  // Components
  import GridManager from "./GridManager.svelte";
  import MockupManager from "./MockupManager.svelte";

  const ALIGNMENT_Y_VALUES: NonNullable<MockupAlignmentY>[] = ["top", "bottom"];
  const ALIGNMENT_X_VALUES: NonNullable<MockupAlignmentX>[] = ["left", "center", "right"];
  const OPACITY_PRESETS = [0.25, 0.5, 0.75, OPACITY_MAX] as const;

  type PopoverKind = "opacity" | "alignment";

  let activePopover = $state<PopoverKind | null>(null);
  let popoverAnchorX = $state<number | null>(null);
  let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let dockElement: HTMLDivElement;
  let opacityButtonEl: HTMLButtonElement;
  let alignmentButtonEl: HTMLButtonElement;

  // Touch slide on the opacity button
  let opacitySliding = $state(false);
  let opacitySlideStartX = 0;
  let opacitySlideStartValue = 0;
  let opacityPointerType = "";

  // Derived values from overlayController
  let opacityDisplay = $derived(Math.round(overlayController.opacity * 100));
  let scaleDisplay = $derived(overlayController.scale === 0.5 ? "½×" : `${overlayController.scale}×`);
  let nextDockPosition = $derived<DockPosition>(dockStore.position === "top" ? "bottom" : "top");

  // Mockup disabled states
  let isMockupDisabled = $derived(!overlayController.activeMockupId);
  let isHidden = $derived(overlayController.isHidden);
  let isLocked = $derived(overlayController.isLocked);
  let isDragging = $derived(overlayController.isDragging);

  /**
   * Controls are disabled when:
   * - No active mockup
   * - Mockup is hidden
   */
  let isControlsDisabled = $derived(isMockupDisabled || isHidden);

  // Mutual exclusion states for floating windows/popovers
  let isMockupsOpen = $derived(dockStore.mode === "mockups");
  let isGridsOpen = $derived(dockStore.mode === "grids");
  let isStudioOpen = $derived(isMockupsOpen || isGridsOpen);
  let showOpacityPopover = $derived(activePopover === "opacity" && !isControlsDisabled && !isStudioOpen);
  let showAlignmentOptions = $derived(
    activePopover === "alignment" && !isControlsDisabled && !isLocked && !isStudioOpen
  );

  let showPositionDisplay = $derived(
    dockStore.mode === "toolbar" && !showAlignmentOptions && !showOpacityPopover && !isControlsDisabled
  );

  function cancelPopoverClose() {
    if (hoverCloseTimer !== null) {
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    }
  }

  function updatePopoverAnchor(kind: PopoverKind) {
    const triggerEl = kind === "opacity" ? opacityButtonEl : alignmentButtonEl;
    if (!triggerEl || !dockElement) {
      popoverAnchorX = null;
      return;
    }
    const dockRect = dockElement.getBoundingClientRect();
    const btnRect = triggerEl.getBoundingClientRect();
    if (dockRect.width > 0 && btnRect.width > 0) {
      popoverAnchorX = btnRect.left - dockRect.left + btnRect.width / 2;
    } else if (triggerEl.offsetWidth > 0) {
      popoverAnchorX = triggerEl.offsetLeft + triggerEl.offsetWidth / 2;
    } else {
      popoverAnchorX = null;
    }
  }

  function openPopover(kind: PopoverKind) {
    cancelPopoverClose();
    updatePopoverAnchor(kind);
    activePopover = kind;
  }

  function closePopover() {
    cancelPopoverClose();
    activePopover = null;
  }

  function hasPopoverFocus() {
    const focused = (dockElement.getRootNode() as Document | ShadowRoot).activeElement;
    return !!focused?.closest(".dock__popover");
  }

  function handlePopoverMouseLeave(kind: PopoverKind, e: MouseEvent) {
    if (isLastInputTouch() || activePopover !== kind) return;

    const triggerSelector = kind === "opacity" ? ".opacity-button" : ".alignment-trigger-btn";
    const popoverSelector = kind === "opacity" ? ".dock__popover--opacity" : ".dock__popover--placement";
    const target = e.relatedTarget as Element | null;

    if (hasPopoverFocus() || target?.closest(popoverSelector) || target?.closest(triggerSelector)) {
      cancelPopoverClose();
      return;
    }

    // If the pointer is still moving inside the dock (e.g. crossing toolbar padding toward the popover),
    // wait briefly before closing so moving onto the popover cancels the close
    if (target && dockElement?.contains(target)) {
      cancelPopoverClose();
      hoverCloseTimer = setTimeout(() => {
        hoverCloseTimer = null;
        if (activePopover === kind && !hasPopoverFocus()) {
          activePopover = null;
        }
      }, 140);
      return;
    }

    closePopover();
  }

  function handleAlignmentMouseEnter() {
    if (isLastInputTouch() || isDragging || isStudioOpen || hasPopoverFocus()) return;
    openPopover("alignment");
  }

  function handleAlignmentMouseLeave(e: MouseEvent) {
    handlePopoverMouseLeave("alignment", e);
  }

  /**
   * A click restores the default alignment (top center); the matrix opens on hover.
   * Touch has no hover, so the first tap opens the matrix. Keyboard activation opens it with
   * focus inside, so every position stays reachable.
   */
  async function handleAlignmentClick(e: MouseEvent) {
    // detail is 0 for keyboard activation, which has no pointer
    if (e.detail === 0) {
      openPopover("alignment");
      await tick();
      const dots = dockElement.querySelectorAll<HTMLButtonElement>(".alignment-matrix__dot");
      (Array.from(dots).find((dot) => dot.classList.contains("active")) ?? dots[0])?.focus();
      return;
    }

    if (isLastInputTouch() && activePopover !== "alignment") {
      openPopover("alignment");
      return;
    }

    overlayController.setAlignment("top", "center");
  }

  function handleOpacityMouseEnter() {
    if (isLastInputTouch() || isDragging || isStudioOpen || hasPopoverFocus()) return;
    openPopover("opacity");
  }

  function handleOpacityMouseLeave(e: MouseEvent) {
    handlePopoverMouseLeave("opacity", e);
  }

  /**
   * Touch: slide horizontally on the opacity button to adjust it (100px = 50%)
   */
  function handleOpacityPointerDown(e: PointerEvent) {
    opacityPointerType = e.pointerType;
    if (e.pointerType !== "touch") return;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    opacitySliding = true;
    opacitySlideStartX = e.clientX;
    opacitySlideStartValue = overlayController.opacity;
  }

  function handleOpacityPointerMove(e: PointerEvent) {
    if (!opacitySliding) return;

    const dx = e.clientX - opacitySlideStartX;
    overlayController.setOpacity(opacitySlideStartValue + dx / 200);
  }

  function handleOpacityPointerEnd() {
    opacitySliding = false;
  }

  async function handleOpacityClick(e: MouseEvent) {
    if (isStudioOpen) return;
    // Keyboard activation has detail 0 and opens the controls without resetting the opacity.
    if (e.detail === 0) {
      openPopover("opacity");
      await tick();
      dockElement.querySelector<HTMLInputElement>(".opacity-slider")?.focus();
      return;
    }
    if (opacityPointerType === "touch") return;
    overlayController.resetOpacity();
  }

  function handleMockupStudioClick() {
    if (isGridsOpen) return;
    closePopover();
    if (dockStore.mode === "mockups") {
      dockStore.enterToolbar();
    } else {
      dockStore.enterMockups();
    }
  }

  function handleGridStudioClick() {
    if (isMockupsOpen) return;
    closePopover();
    if (dockStore.mode === "grids") {
      dockStore.enterToolbar();
    } else {
      dockStore.enterGrids();
    }
  }

  // Reset popover state if underlying controls become disabled or locked
  $effect(() => {
    if (isControlsDisabled || isStudioOpen || (activePopover === "alignment" && isLocked)) {
      closePopover();
    }
  });

  // Close popovers on Escape, or on a tap/click outside the dock (touch has no mouseleave)
  $effect(() => {
    if (!showAlignmentOptions && !showOpacityPopover) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A hover popover may be open while the user types in a host field; Escape belongs to that field
      const focused = (dockElement.getRootNode() as Document | ShadowRoot).activeElement;
      const isFocusInDock = !!focused && dockElement.contains(focused);
      if (!isFocusInDock && isTypingInField(e)) return;

      // Marks the key as handled, so the Escape lock shortcut skips it
      e.preventDefault();
      const trigger = activePopover === "opacity" ? opacityButtonEl : alignmentButtonEl;
      closePopover();
      if (focused?.closest(".dock__popover")) trigger.focus();
    };

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (!e.composedPath().includes(dockElement)) closePopover();
    };

    const stops = [
      on(window, "keydown", handleEscape, { capture: true }),
      on(window, "pointerdown", handlePointerDownOutside)
    ];
    return () => stops.forEach((stop) => stop());
  });

  // Effect to close studio panel when clicking outside the dock
  $effect(() => {
    if (!dockStore.isManagerMode) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!e.composedPath().includes(dockElement)) {
        dockStore.enterToolbar();
      }
    };

    let stop: (() => void) | null = null;
    const listenerTimer = setTimeout(() => {
      stop = on(window, "click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(listenerTimer);
      stop?.();
    };
  });

  $effect(() => () => cancelPopoverClose());
</script>

<div
  bind:this={dockElement}
  class="dock"
  class:at-top={dockStore.position === "top"}
  class:is-dragging={isDragging}
  hidden={!dockStore.initialized || overlayController.isSolidOrZoomed}
>
  <div class="toolbar" role="toolbar" aria-label="Pixel Mirror controls">
    <button
      class="icon-button"
      data-testid="btn-visibility"
      disabled={isMockupDisabled || isStudioOpen}
      onclick={overlayController.toggleVisibility}
      title={isHidden ? "Show mockup" : "Hide mockup"}
    >
      <Icon name={isHidden ? "hide" : "show"} />
    </button>
    <button
      class="icon-button"
      class:active={isLocked && !isControlsDisabled}
      data-testid="btn-lock"
      disabled={isControlsDisabled || isStudioOpen}
      aria-pressed={isLocked}
      aria-label="Lock mockup position"
      onclick={() => overlayController.toggleLock()}
      title={isLocked ? "Unlock mockup position (Click-through active)" : "Lock mockup position (Enable click-through)"}
    >
      <Icon name={isLocked ? "lock" : "unlock"} />
    </button>

    <span class="toolbar__divider" aria-hidden="true"></span>

    <button
      bind:this={opacityButtonEl}
      class="icon-button opacity-button"
      class:sliding={opacitySliding}
      class:active={showOpacityPopover}
      data-testid="btn-opacity"
      disabled={isControlsDisabled || isStudioOpen}
      aria-expanded={showOpacityPopover}
      aria-label="Opacity {opacityDisplay}%"
      style:touch-action="none"
      onclick={handleOpacityClick}
      onpointerdown={handleOpacityPointerDown}
      onpointermove={handleOpacityPointerMove}
      onpointerup={handleOpacityPointerEnd}
      onpointercancel={handleOpacityPointerEnd}
      onmouseenter={handleOpacityMouseEnter}
      onmouseleave={handleOpacityMouseLeave}
      title="Opacity (Enter to adjust, click to reset, hover or Ctrl+Scroll)"
    >
      <OpacityIcon level={overlayController.opacity} />
    </button>

    <span class="toolbar__divider" aria-hidden="true"></span>

    <button
      bind:this={alignmentButtonEl}
      class="icon-button alignment-trigger-btn"
      class:active={showAlignmentOptions}
      data-testid="btn-alignment"
      disabled={isControlsDisabled || isLocked || isStudioOpen}
      aria-expanded={showAlignmentOptions}
      onclick={handleAlignmentClick}
      onmouseenter={handleAlignmentMouseEnter}
      onmouseleave={handleAlignmentMouseLeave}
      aria-label="Alignment"
      title="Alignment (click for top center)"
    >
      <AlignmentIcon x={overlayController.alignmentX} y={overlayController.alignmentY} />
    </button>
    <button
      class="icon-button scale-button"
      data-testid="btn-scale"
      disabled={isControlsDisabled || isLocked || isStudioOpen}
      onclick={overlayController.cycleScale}
      aria-label="Scale {overlayController.scale}x"
      title="Scale (1× ↔ ½×)"
    >
      <span class="scale-button__value">{scaleDisplay}</span>
    </button>

    <span class="toolbar__divider" aria-hidden="true"></span>

    <button
      class="icon-button"
      class:active={isMockupsOpen}
      aria-pressed={isMockupsOpen}
      data-testid="btn-mockup-manager"
      disabled={isGridsOpen}
      onclick={handleMockupStudioClick}
      title="Mockup Studio"
    >
      <Icon name="mockups" />
    </button>
    <button
      class="icon-button"
      class:active={isGridsOpen}
      aria-pressed={isGridsOpen}
      data-testid="btn-grid-manager"
      disabled={isMockupsOpen}
      onclick={handleGridStudioClick}
      title="Grid Studio"
    >
      <Icon name="grids" />
    </button>

    <span class="toolbar__divider" aria-hidden="true"></span>

    <button class="icon-button" data-testid="btn-theme" onclick={dockStore.toggleTheme} title="Toggle theme">
      <Icon name={dockStore.theme === "dark" ? "sun" : "moon"} />
    </button>
    <button
      class="icon-button"
      data-testid="btn-position"
      onclick={dockStore.togglePosition}
      title="Move toolbar to the {nextDockPosition}"
    >
      <Icon name={nextDockPosition === "top" ? "dockTop" : "dockBottom"} />
    </button>
  </div>

  {#if showOpacityPopover}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="dock__popover dock__popover--opacity"
      data-testid="popover-opacity"
      style:--popover-anchor={popoverAnchorX !== null ? `${popoverAnchorX}px` : undefined}
      onmouseenter={cancelPopoverClose}
      onmouseleave={handleOpacityMouseLeave}
    >
      <div class="popover-section">
        <div class="popover-section__header">
          <span class="popover-section__label">Opacity</span>
          <button
            type="button"
            class="popover-section__reset"
            data-testid="btn-opacity-reset"
            onclick={() => overlayController.resetOpacity()}
            title="Reset opacity to 50%"
          >
            {opacityDisplay}% · Reset
          </button>
        </div>
        <input
          type="range"
          class="opacity-slider"
          data-testid="slider-opacity"
          aria-label="Mockup opacity"
          min={OPACITY_MIN * 100}
          max={OPACITY_MAX * 100}
          step="5"
          value={opacityDisplay}
          oninput={(e) => overlayController.setOpacity(Number((e.currentTarget as HTMLInputElement).value) / 100)}
        />
        <div class="chip-row">
          {#each OPACITY_PRESETS as preset (preset)}
            <button
              type="button"
              class="chip"
              class:active={Math.abs(overlayController.opacity - preset) < 0.03}
              onclick={() => overlayController.setOpacity(preset)}
            >
              {Math.round(preset * 100)}%
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if showAlignmentOptions}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="dock__popover dock__popover--placement"
      style:left={popoverAnchorX !== null ? `${popoverAnchorX}px` : undefined}
      onmouseenter={cancelPopoverClose}
      onmouseleave={handleAlignmentMouseLeave}
    >
      <div class="alignment-matrix" role="group" aria-label="2x3 alignment matrix">
        {#each ALIGNMENT_Y_VALUES as y (y)}
          {#each ALIGNMENT_X_VALUES as x (`${y}-${x}`)}
            <button
              type="button"
              class="alignment-matrix__dot"
              class:active={overlayController.alignmentY === y && overlayController.alignmentX === x}
              data-testid="matrix-{y}-{x}"
              onclick={() => overlayController.setAlignment(y, x)}
              title="Snap {y} {x}"
              aria-label="Snap {y} {x}"
            >
              <span></span>
            </button>
          {/each}
        {/each}
      </div>
    </div>
  {/if}

  {#if dockStore.mode === "mockups"}
    <div class="manager-wrapper dock__panel dock__panel--mockups">
      <MockupManager />
    </div>
  {:else if dockStore.mode === "grids"}
    <div class="manager-wrapper dock__panel dock__panel--grids">
      <GridManager />
    </div>
  {/if}

  {#if showPositionDisplay}
    <div class="dock__coordinates">{overlayController.positionDisplay}</div>
  {/if}
</div>

{#if dockStore.initialized && overlayController.isSolidOrZoomed}
  <div class="inspect-hud" class:at-top={dockStore.position === "top"} data-testid="inspect-hud">
    <span class="inspect-hud__badge">
      {overlayController.mode === "zoomed" ? "200% Zoom" : "100% Solid"}
    </span>
    <span class="inspect-hud__coords">{overlayController.positionDisplay}</span>
  </div>
{/if}

<style lang="scss">
  .dock {
    position: fixed;
    right: rhythm(1.5);
    bottom: rhythm(3);
    left: rhythm(1.5);
    z-index: $max-z-index;
    display: flex;
    align-items: center;
    justify-content: center;
    width: max-content;
    max-width: calc(100vw - #{rhythm(3)});
    margin-right: auto;
    margin-left: auto;
    font-family: var(--pm-font-sans);
    color: var(--pm-text-primary);
    background: var(--pm-surface-primary);
    border: $border-width-sm solid var(--pm-border-strong);
    border-radius: var(--pm-radius-pill);
    box-shadow: var(--pm-shadow-hud);
    backdrop-filter: var(--pm-backdrop-blur);
    transform: translateZ(0);

    &[hidden] {
      display: none !important;
    }

    &,
    * {
      touch-action: pan-x pan-y;
      user-select: none;
    }

    &.at-top {
      top: rhythm(3);
      bottom: auto;
    }

    &.is-dragging {
      pointer-events: none;
    }

    &__coordinates {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      left: 0;
      z-index: 1;
      width: max-content;
      padding: 3px rhythm(1.25);
      margin: auto;
      font-family: var(--pm-font-mono);
      font-size: 11px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      line-height: 16px;
      color: var(--pm-text-secondary);
      white-space: nowrap;
      pointer-events: none;
      background: var(--pm-surface-primary);
      border: $border-width-sm solid var(--pm-border-subtle);
      border-radius: var(--pm-radius-pill);
      box-shadow: var(--pm-shadow-hud);
      backdrop-filter: var(--pm-backdrop-blur);
    }

    &.at-top &__coordinates {
      top: calc(100% + 8px);
      bottom: auto;
    }

    &__popover {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      z-index: 3;
      display: flex;
      flex-direction: column;
      gap: rhythm(1);
      width: max-content;
      padding: rhythm(1.5);
      background: var(--pm-surface-elevated);
      border: $border-width-sm solid var(--pm-border-strong);
      border-radius: var(--pm-radius-card);
      box-shadow: var(--pm-shadow-panel);
      transform: translateX(-50%);
      animation: popover-in 0.16s $timing-function;

      &--opacity {
        --opacity-popover-width: min(232px, 100%);
        left: clamp(
          calc(var(--opacity-popover-width) / 2),
          var(--popover-anchor, 50%),
          calc(100% - var(--opacity-popover-width) / 2)
        );
        width: var(--opacity-popover-width);
        min-width: 0;
      }

      &--placement {
        padding: rhythm(1);
      }

      // Invisible hover bridge spanning the gap down to the toolbar buttons
      &::after {
        position: absolute;
        right: 0;
        bottom: -18px;
        left: 0;
        height: 18px;
        content: "";
      }
    }

    &.at-top &__popover {
      top: calc(100% + 10px);
      bottom: auto;

      &::after {
        top: -18px;
        bottom: auto;
      }
    }

    &__panel {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 50%;
      z-index: 4;
      max-width: calc(100vw - #{rhythm(3)});
      max-height: min(68vh, 560px);
      overflow: hidden;
      background: var(--pm-surface-elevated);
      border: $border-width-sm solid var(--pm-border-strong);
      border-radius: var(--pm-radius-panel);
      box-shadow: var(--pm-shadow-panel);
      transform: translateX(-50%);
      animation: popover-in 0.18s $timing-function;

      // Both panels are sized by their content, up to the max-height above

      &--mockups {
        width: min(820px, calc(100vw - #{rhythm(3)}));
      }

      &--grids {
        width: min(648px, calc(100vw - #{rhythm(3)}));
      }
    }

    &.at-top &__panel {
      top: calc(100% + 12px);
      bottom: auto;
    }
  }

  .toolbar {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    align-items: center;
    max-width: 100%;
    // Inside the scroll container, so the buttons' focus rings aren't clipped
    padding: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    &__divider {
      flex: none;
      width: 1px;
      height: 20px;
      margin: 0 rhythm(0.5);
      background: var(--pm-border-strong);
    }

    // Phones: drop the dividers and gaps so all buttons fit in 360px
    @media (max-width: 420px) {
      gap: 0;

      &__divider {
        display: none;
      }
    }
  }

  .icon-button {
    @include icon-button;
  }

  .opacity-button.sliding {
    color: var(--pm-accent-text);
    background: var(--pm-accent-subtle);
  }

  .scale-button__value {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 20px;
  }

  .popover-section {
    display: flex;
    flex-direction: column;
    gap: rhythm(1.25);

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__label {
      font-size: 11px;
      font-weight: 600;
      color: var(--pm-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    &__reset {
      padding: 2px 6px;
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
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
  }

  .opacity-slider {
    width: 100%;
    margin: 0;
    accent-color: var(--pm-accent);
    cursor: pointer;

    &:focus-visible {
      @include focus-ring;
      border-radius: var(--pm-radius-pill);
    }
  }

  .chip-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }

  .chip {
    height: 28px;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--pm-text-secondary);
    border: $border-width-sm solid var(--pm-border-strong);
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

    &.active {
      color: var(--pm-accent-text);
      background: var(--pm-accent-subtle);
      border-color: transparent;
    }
  }

  .alignment-matrix {
    display: grid;
    grid-template-rows: repeat(2, 28px);
    grid-template-columns: repeat(3, 36px);
    gap: 4px;

    &__dot {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      background: var(--pm-surface-subtle);
      border-radius: 6px;
      transition: background $transition-fast ease;

      span {
        width: 6px;
        height: 6px;
        background: var(--pm-text-muted);
        border-radius: 50%;
        transition:
          transform $transition-fast ease,
          background $transition-fast ease;
      }

      &:hover {
        background: var(--pm-surface-active);

        span {
          background: var(--pm-text-primary);
          transform: scale(1.3);
        }
      }

      &:focus-visible {
        @include focus-ring;
      }

      &.active {
        background: var(--pm-accent-subtle);

        span {
          background: var(--pm-accent);
          transform: scale(1.5);
        }
      }
    }
  }

  // Display only: clicks under it still reach the mockup (e.g. to toggle zoom)
  .inspect-hud {
    position: fixed;
    right: 0;
    bottom: rhythm(3);
    left: 0;
    z-index: $max-z-index;
    display: flex;
    gap: rhythm(1.25);
    align-items: center;
    width: max-content;
    height: 40px;
    padding: 0 rhythm(1.75) 0 6px;
    margin: auto;
    font-family: var(--pm-font-sans);
    font-size: 12px;
    color: var(--pm-text-primary);
    pointer-events: none;
    background: var(--pm-surface-primary);
    border: $border-width-sm solid var(--pm-border-strong);
    border-radius: var(--pm-radius-pill);
    box-shadow: var(--pm-shadow-hud);
    backdrop-filter: var(--pm-backdrop-blur);

    &.at-top {
      top: rhythm(3);
      bottom: auto;
    }

    &__badge {
      padding: 4px 10px;
      font-weight: 600;
      line-height: 16px;
      color: var(--pm-accent-fg);
      background: var(--pm-accent);
      border-radius: var(--pm-radius-pill);
    }

    &__coords {
      font-family: var(--pm-font-mono);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: var(--pm-text-secondary);
    }
  }

  @keyframes popover-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }
</style>
