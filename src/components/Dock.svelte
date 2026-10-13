<script lang="ts">
  // Svelte
  import { onMount } from "svelte";

  // Utils
  import { isLastInputTouch, isTouchDevice } from "~/utils/device";
  // Icons
  import IconAlignBottom from "~/assets/align-bottom-stroke-rounded.svg?component";
  import IconAlignCenterX from "~/assets/align-horizontal-center-stroke-rounded.svg?component";
  import IconAlignLeft from "~/assets/align-left-stroke-rounded.svg?component";
  import IconAlignRight from "~/assets/align-right-stroke-rounded.svg?component";
  import IconAlignTop from "~/assets/align-top-stroke-rounded.svg?component";
  import IconScale from "~/assets/border-all-02-stroke-rounded.svg?component";
  import IconAlignment from "~/assets/coordinate-01-stroke-rounded.svg?component";
  import IconSide from "~/assets/flip-top-stroke-rounded.svg?component";
  import IconGridManager from "~/assets/grid-table-stroke-rounded.svg?component";
  import IconOpacity from "~/assets/idea-01-stroke-rounded.svg?component";
  import IconShow from "~/assets/image-02-stroke-rounded.svg?component";
  import IconHide from "~/assets/image-not-found-01-stroke-rounded.svg?component";
  import IconMockupManager from "~/assets/image-upload-stroke-rounded.svg?component";
  import IconMoon from "~/assets/moon-02-stroke-rounded.svg?component";
  import IconLock from "~/assets/square-lock-02-stroke-rounded.svg?component";
  import IconUnlock from "~/assets/square-unlock-02-stroke-rounded.svg?component";
  import IconSun from "~/assets/sun-03-stroke-rounded.svg?component";
  // Stores
  import { DOCK_TRANSITION_DURATION, dockStore } from "~/stores/dockStore.svelte";
  import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
  // Components
  import GridManager from "./GridManager.svelte";
  import MockupManager from "./MockupManager.svelte";

  let showAlignmentOptions = $state(false);
  let dockElement: HTMLDivElement;

  // Mobile touch state for opacity slider
  let opacitySliding = $state(false);
  let opacitySlideStartX = 0;
  let opacitySlideStartValue = 0;

  // Derived values from mockupOverlayStore
  let opacityDisplay = $derived(Math.round(mockupOverlayStore.opacity * 100));
  let scaleDisplay = $derived(mockupOverlayStore.scale === 0.5 ? ".5x" : `${mockupOverlayStore.scale}x`);

  // Mockup disabled states
  let isMockupDisabled = $derived(!mockupOverlayStore.activeMockupId);
  let isHidden = $derived(mockupOverlayStore.isHidden);
  let isLocked = $derived(mockupOverlayStore.isLocked);
  let isDragging = $derived(mockupOverlayStore.isDragging);

  /**
   * Controls are disabled when:
   * - No active mockup
   * - Mockup is hidden
   */
  let isControlsDisabled = $derived(isMockupDisabled || isHidden);

  let showPositionDisplay = $derived(dockStore.mode === "toolbar" && !showAlignmentOptions && !isControlsDisabled);

  function handleAlignmentMouseEnter() {
    // Skip hover behavior if last input was touch (prevents accidental activation on hybrid devices)
    if (isLastInputTouch()) return;
    if (isDragging) return;
    showAlignmentOptions = true;
  }

  function handleAlignmentMouseLeave(e: MouseEvent) {
    // Skip if last input was touch
    if (isLastInputTouch()) return;

    const target = e.relatedTarget as Element | null;
    const isRelatedToAlignment = target?.closest(".dock__popover") || target?.closest(".alignment-trigger-btn");

    if (!isRelatedToAlignment) {
      showAlignmentOptions = false;
    }
  }

  // ============================================
  // Mobile Touch Handlers
  // ============================================

  /**
   * Handle alignment button click - three-stage cycle:
   * 1. If popover is closed: open popover
   * 2. If popover is open AND alignment is NOT top-center: set to top-center
   * 3. If popover is open AND alignment IS top-center: close popover
   *
   * This behavior is consistent for both desktop and mobile.
   * Desktop can also open popover via hover.
   */
  function handleAlignmentClick() {
    const isTopCenter = mockupOverlayStore.alignmentY === "top" && mockupOverlayStore.alignmentX === "center";

    if (!showAlignmentOptions) {
      // Stage 1: Open popover
      showAlignmentOptions = true;
    } else if (!isTopCenter) {
      // Stage 2: Set to top-center (popover stays open)
      mockupOverlayStore.setAlignment("top", "center");
    } else {
      // Stage 3: Already at top-center, close popover
      showAlignmentOptions = false;
    }
  }

  /**
   * Start opacity touch slide
   */
  function handleOpacityTouchStart(e: TouchEvent) {
    if (!isTouchDevice()) return;

    e.preventDefault();
    opacitySliding = true;
    opacitySlideStartX = e.touches[0].clientX;
    opacitySlideStartValue = mockupOverlayStore.opacity;

    window.addEventListener("touchmove", handleOpacityTouchMove, { passive: false });
    window.addEventListener("touchend", handleOpacityTouchEnd);
  }

  /**
   * Handle opacity touch move - adjust opacity based on horizontal slide
   */
  function handleOpacityTouchMove(e: TouchEvent) {
    if (!opacitySliding) return;

    e.preventDefault();
    const dx = e.touches[0].clientX - opacitySlideStartX;
    // 100px slide = 50% opacity change
    const deltaOpacity = dx / 200;
    const newOpacity = opacitySlideStartValue + deltaOpacity;
    mockupOverlayStore.setOpacity(newOpacity);
  }

  /**
   * End opacity touch slide
   */
  function handleOpacityTouchEnd() {
    opacitySliding = false;
    window.removeEventListener("touchmove", handleOpacityTouchMove);
    window.removeEventListener("touchend", handleOpacityTouchEnd);
  }

  // Effect to close alignment popover when clicking outside the dock on mobile
  $effect(() => {
    if (!isTouchDevice() || !showAlignmentOptions) return;

    const handleOutsideDock = (e: Event) => {
      const path = e.composedPath();
      // Close only if clicking outside the entire dock
      if (!path.includes(dockElement)) {
        showAlignmentOptions = false;
      }
    };

    // Use setTimeout to avoid closing immediately on the same tap that opened it
    const timer = setTimeout(() => {
      window.addEventListener("touchend", handleOutsideDock);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("touchend", handleOutsideDock);
    };
  });

  $effect(() => {
    if (!dockStore.isManagerMode) return;

    const showTimer = setTimeout(() => {
      dockStore.managerVisible = true;
    }, DOCK_TRANSITION_DURATION);

    const handleClickOutside = (e: MouseEvent) => {
      const path = e.composedPath();
      if (!path.includes(dockElement)) {
        dockStore.enterToolbar();
      }
    };

    const listenerTimer = setTimeout(() => {
      window.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(listenerTimer);
      window.removeEventListener("click", handleClickOutside);
    };
  });

  onMount(() => {
    dockStore.init();
  });
</script>

<div
  bind:this={dockElement}
  class="dock"
  class:at-top={dockStore.position === "top"}
  class:is-manager={dockStore.isManagerMode}
  class:is-dragging={isDragging}
  style:--transition-duration="{DOCK_TRANSITION_DURATION}ms"
  style:width="{dockStore.size.width}px"
  style:height="{dockStore.size.height}px"
  hidden={!dockStore.initialized || mockupOverlayStore.isSolidOrZoomed}
>
  {#if dockStore.mode === "toolbar" && dockStore.toolbarVisible}
    <div class="toolbar">
      <button
        class="icon-button"
        data-testid="btn-visibility"
        disabled={isMockupDisabled}
        onclick={mockupOverlayStore.toggleVisibility}
        title={isHidden ? "Show mockup" : "Hide mockup"}
      >
        {#if isHidden}
          <IconHide />
        {:else}
          <IconShow />
        {/if}
      </button>
      <button
        class="icon-button"
        data-testid="btn-lock"
        disabled={isControlsDisabled}
        onclick={() => mockupOverlayStore.toggleLock()}
        title={isLocked ? "Unlock mockup position" : "Lock mockup position"}
      >
        {#if isLocked}
          <IconLock />
        {:else}
          <IconUnlock />
        {/if}
      </button>
      <button
        class="icon-button opacity-button"
        class:sliding={opacitySliding}
        data-testid="btn-opacity"
        disabled={isControlsDisabled}
        onclick={mockupOverlayStore.resetOpacity}
        ontouchstart={isTouchDevice() ? handleOpacityTouchStart : undefined}
        title="Opacity (Click to reset, Ctrl+Scroll to adjust)"
      >
        <IconOpacity />
        <span class="opacity-button__value">{opacityDisplay}</span>
      </button>
      <button
        class="icon-button alignment-trigger-btn"
        data-testid="btn-alignment"
        disabled={isControlsDisabled || isLocked}
        onmouseenter={handleAlignmentMouseEnter}
        onmouseleave={handleAlignmentMouseLeave}
        onclick={handleAlignmentClick}
        title="Alignment (Click for top-center)"
      >
        <IconAlignment />
      </button>
      <button
        class="icon-button scale-button"
        data-testid="btn-scale"
        disabled={isControlsDisabled || isLocked}
        onclick={mockupOverlayStore.cycleScale}
        title="Scale (1x ↔ 0.5x)"
      >
        <IconScale />
        <span class="scale-button__value">{scaleDisplay}</span>
      </button>
      <button
        class="icon-button"
        data-testid="btn-mockup-manager"
        onclick={dockStore.enterMockups}
        title="Mockup Manager"
      >
        <IconMockupManager />
      </button>
      <button class="icon-button" data-testid="btn-grid-manager" onclick={dockStore.enterGrids} title="Grid Manager">
        <IconGridManager />
      </button>
      <button class="icon-button" data-testid="btn-theme" onclick={dockStore.toggleTheme} title="Toggle theme">
        {#if dockStore.theme === "dark"}
          <IconSun />
        {:else}
          <IconMoon />
        {/if}
      </button>
      <button
        class="icon-button"
        class:flip={dockStore.position === "top"}
        data-testid="btn-position"
        onclick={dockStore.togglePosition}
        title="Toggle dock position"
      >
        <IconSide />
      </button>
    </div>

    {#if showAlignmentOptions && !isControlsDisabled && !isLocked}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="dock__popover" onmouseleave={handleAlignmentMouseLeave}>
        <div class="alignment-group alignment-group--vertical">
          <button
            class="alignment-button"
            class:active={mockupOverlayStore.alignmentY === "top"}
            onclick={() => mockupOverlayStore.setAlignmentY("top")}
            title="Align top"
          >
            <IconAlignTop />
          </button>
          <button
            class="alignment-button"
            class:active={mockupOverlayStore.alignmentY === "bottom"}
            onclick={() => mockupOverlayStore.setAlignmentY("bottom")}
            title="Align bottom"
          >
            <IconAlignBottom />
          </button>
        </div>
        <div class="alignment-group alignment-group--horizontal">
          <button
            class="alignment-button"
            class:active={mockupOverlayStore.alignmentX === "left"}
            onclick={() => mockupOverlayStore.setAlignmentX("left")}
            title="Align left"
          >
            <IconAlignLeft />
          </button>
          <button
            class="alignment-button"
            class:active={mockupOverlayStore.alignmentX === "center"}
            onclick={() => mockupOverlayStore.setAlignmentX("center")}
            title="Align center horizontally"
          >
            <IconAlignCenterX />
          </button>
          <button
            class="alignment-button"
            class:active={mockupOverlayStore.alignmentX === "right"}
            onclick={() => mockupOverlayStore.setAlignmentX("right")}
            title="Align right"
          >
            <IconAlignRight />
          </button>
        </div>
      </div>
    {/if}
  {:else if dockStore.mode === "mockups" && dockStore.managerVisible}
    <div class="manager-wrapper">
      <MockupManager />
    </div>
  {:else if dockStore.mode === "grids" && dockStore.managerVisible}
    <div class="manager-wrapper">
      <GridManager />
    </div>
  {/if}

  {#if showPositionDisplay}
    <div class="dock__coordinates">{mockupOverlayStore.positionDisplay}</div>
  {/if}
</div>

<style lang="scss">
  .dock {
    position: fixed;
    right: rhythm(1);
    bottom: rhythm(3);
    left: rhythm(1);
    z-index: $max-z-index;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: calc(100vw - #{rhythm(2)});
    max-height: 75vh;
    margin-right: auto;
    margin-left: auto;
    font-family: "Arial", sans-serif;
    color: var(--dock-fg);
    outline: $outline-width solid var(--dock-outline);
    background: var(--dock-bg);
    border: $border-width-md solid var(--dock-border);
    border-radius: rhythm(4);
    transform: translateZ(0);
    transition:
      width var(--transition-duration) $timing-function,
      height var(--transition-duration) $timing-function,
      border-radius var(--transition-duration) $timing-function;
    will-change: width, height, border-radius;

    &[hidden] {
      display: none !important;
    }

    // Prevent pinch zoom and text selection on dock elements
    // touch-action is NOT inherited, so mustbe set on each element
    &,
    * {
      touch-action: pan-x pan-y;
      user-select: none;
    }

    &.at-top {
      top: rhythm(5);
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
      padding: 0 rhythm(1);
      margin: auto;
      font-family: monospace;
      font-size: 12px;
      line-height: 20px;
      color: var(--btn-fg);
      white-space: nowrap;
      background: var(--btn-bg);
      border-radius: rhythm(2);
    }

    &__popover {
      position: absolute;
      bottom: 100%;
      left: 74px;
      z-index: 2;
      display: flex;
      align-items: center;
      padding: rhythm(0.5) rhythm(0.5) 0;
      overflow: hidden;
      background: var(--dock-bg);
      border: $border-width-md solid var(--dock-border);
      border-bottom: none;
      border-radius: rhythm(1.5) rhythm(1.5) 0 0;
    }
  }

  .toolbar,
  .dock__popover {
    :global(button:focus) {
      outline: none;
    }
  }

  .toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    max-width: 100%;
    padding: 0 rhythm(1);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .icon-button {
    @include icon-button;

    &.flip {
      transform: rotate(180deg);

      &:active {
        transform: scale(0.95) rotate(180deg);
      }
    }
  }

  .opacity-button {
    position: relative;

    &.sliding {
      background: var(--focus-bg);
      opacity: 1;
    }

    &__value {
      position: absolute;
      top: 14px;
      right: 0;
      left: 0;
      z-index: 1;
      font-size: 8px;
      font-weight: 700;
      line-height: 12px;
      text-align: center;
    }
  }

  .scale-button {
    position: relative;

    &__value {
      position: absolute;
      inset: 0;
      z-index: 1;
      height: 16px;
      margin: auto;
      font-size: 11.5px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
    }
  }

  .alignment-group {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: rhythm(0.75);

    + .alignment-group {
      margin-left: rhythm(0.5);
    }

    &--vertical {
      background: var(--align-y-bg);

      .alignment-button {
        &:hover {
          background: var(--align-y-hover);
        }

        &:active,
        &.active {
          background: var(--align-y-active);
        }
      }
    }

    &--horizontal {
      background: var(--align-x-bg);

      .alignment-button {
        &:hover {
          background: var(--align-x-hover);
        }

        &:active,
        &.active {
          background: var(--align-x-active);
        }
      }
    }
  }

  .alignment-button {
    padding: 2px;
    border-radius: rhythm(0.75);

    &:focus-visible {
      @include focus-ring($border-width-md);
    }

    :global(> svg) {
      width: 24px;
      height: 24px;
    }
  }

  .manager-wrapper {
    width: 100%;
    height: 100%;

    :global(.inner) {
      animation: fadeIn $transition-fast $timing-function;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  // Mobile responsive styles - reduce border radius when manager is open
  @media (max-width: 680px) {
    .dock.is-manager {
      border-radius: rhythm(3);
    }
  }
</style>
