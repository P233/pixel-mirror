<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { on } from "svelte/events";
  import { fromPickedColor, parseColor, toPickerValue, toRgbaString } from "~/utils/color";

  interface Props {
    /** The saved color; the field resets to it whenever it changes */
    value: string;
    /** Shown by the color picker while the text isn't a color it can read */
    fallback: string;
    pickerLabel: string;
    opacityLabel: string;
    pickerTestId?: string;
    onchange: (color: string) => void;
  }

  let { value, fallback, pickerLabel, opacityLabel, pickerTestId, onchange }: Props = $props();

  const uid = $props.id();
  // Alpha for a picked color when the current text has none we can read (grid colors are faint)
  const DEFAULT_ALPHA = 0.05;
  // Only Safari's native picker can pick alpha so far; elsewhere opacity is set on the field itself
  const HAS_NATIVE_ALPHA = typeof HTMLInputElement !== "undefined" && "alpha" in HTMLInputElement.prototype;
  // Wheel distance per percent: a mouse-wheel notch (100px) moves 5%, trackpads move finer
  const PIXELS_PER_PERCENT = 20;

  // Editable draft: resets only when the saved color changes, so a rejected value stays visible
  let draft = $derived(value);
  let color = $derived(parseColor(draft));
  let opacityPercent = $derived(color ? Math.round(color.a * 100) : 100);
  let pickerValue = $derived(toPickerValue(color, fallback, DEFAULT_ALPHA, HAS_NATIVE_ALPHA));

  // `alpha` isn't in Svelte's element types yet. The value is set again after it: assigned before the
  // attribute existed, it lost its alpha
  const nativeAlpha: Attachment<HTMLInputElement> = (input) => {
    input.setAttribute("alpha", "");
    input.value = pickerValue;
  };

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      draft = value;
      return;
    }
    if (trimmed !== value) onchange(trimmed);
  }

  function apply(next: string) {
    draft = next;
    onchange(next);
  }

  function setOpacity(percent: number) {
    if (!color) return;
    const alpha = Math.min(Math.max(Math.round(percent), 0), 100) / 100;
    if (alpha !== color.a) apply(toRgbaString({ ...color, a: alpha }));
  }

  function handlePick(e: Event) {
    const picked = parseColor((e.currentTarget as HTMLInputElement).value);
    if (picked) apply(toRgbaString(fromPickedColor(picked, color, DEFAULT_ALPHA, HAS_NATIVE_ALPHA)));
  }

  function handleTextKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  function handleOpacityKeydown(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 1;
    const targets: Record<string, number> = {
      ArrowUp: opacityPercent + step,
      ArrowRight: opacityPercent + step,
      ArrowDown: opacityPercent - step,
      ArrowLeft: opacityPercent - step,
      PageUp: opacityPercent + 10,
      PageDown: opacityPercent - 10,
      Home: 0,
      End: 100
    };
    if (!(e.key in targets)) return;
    e.preventDefault();
    setOpacity(targets[e.key]);
  }

  // Scrolling anywhere over the field changes the opacity (non-passive, to keep the panel from scrolling).
  // Scrolling down raises it, as Ctrl+Scroll does for the mockup
  const wheelOpacity: Attachment<HTMLElement> = (node) => {
    let pendingPercent = 0;
    return on(
      node,
      "wheel",
      (e: WheelEvent) => {
        if (!color) return;
        e.preventDefault();
        const pixels =
          e.deltaY *
          (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1);
        pendingPercent += pixels / PIXELS_PER_PERCENT;
        const steps = Math.trunc(pendingPercent);
        if (steps === 0) return;
        pendingPercent -= steps;
        setOpacity(opacityPercent + steps);
      },
      { passive: false }
    );
  };
</script>

<div class="color-field">
  <label class="color-field__label" for="{uid}-text">Color</label>
  <div class="color-field__control" title="Scroll to change the opacity" {@attach wheelOpacity}>
    <span class="swatch">
      <span class="swatch__preview" style:background-color={draft}></span>
      <input
        type="color"
        class="swatch__picker"
        value={pickerValue}
        {@attach nativeAlpha}
        data-testid={pickerTestId}
        aria-label={pickerLabel}
        oninput={handlePick}
      />
    </span>
    <input
      id="{uid}-text"
      class="color-field__text"
      type="text"
      bind:value={draft}
      onchange={commit}
      onkeydown={handleTextKeydown}
      spellcheck="false"
    />
    {#if color}
      <span
        class="color-field__opacity"
        role="spinbutton"
        tabindex="0"
        aria-label={opacityLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={opacityPercent}
        aria-valuetext="{opacityPercent}%"
        onkeydown={handleOpacityKeydown}
      >
        {opacityPercent}%
      </span>
    {/if}
  </div>
</div>

<style lang="scss">
  .color-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;

    &__label {
      @include field-label;
    }

    &__control {
      @include form-control;
      display: flex;
      gap: rhythm(1);
      align-items: center;
      padding-right: 4px;
      padding-left: 6px;

      &:has(:focus-visible) {
        @include form-control-focus;
      }
    }

    &__text {
      flex: 1;
      align-self: stretch;
      min-width: 0;
      padding: 0;
      font: inherit;
      color: inherit;
      outline: none;
      background: transparent;
      border: none;
    }

    &__opacity {
      flex: none;
      min-width: 44px;
      padding: 2px 6px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      line-height: 18px;
      color: var(--pm-text-secondary);
      text-align: right;
      cursor: ns-resize;
      background: var(--pm-surface-subtle);
      border-radius: 5px;

      // The whole field shows a ring for any focused part; this marks the part the arrow keys change
      &:focus-visible {
        color: var(--pm-text-primary);
        @include focus-ring(-2px);
      }
    }
  }

  .swatch {
    position: relative;
    flex: none;
    width: 20px;
    height: 20px;
    overflow: hidden;
    background:
      linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-position:
      0 0,
      0 4px,
      4px -4px,
      -4px 0;
    background-size: 8px 8px;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px var(--pm-border-strong);

    &:has(.swatch__picker:focus-visible) {
      @include focus-ring(1px);
    }

    &__preview {
      position: absolute;
      inset: 0;
    }

    &__picker {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      cursor: pointer;
      border: none;
      opacity: 0;
    }
  }
</style>
