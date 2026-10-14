<script lang="ts">
  import { on } from "svelte/events";
  import Icon from "./icons/Icon.svelte";
  import { toastStore } from "~/stores/toastStore.svelte";

  const AUTO_DISMISS_MS = 4500;
  let isHovered = $state(false);

  function dismiss() {
    // The toast is removed without a mouseleave, so its hover pause must not carry over to the next one
    isHovered = false;
    toastStore.clear();
  }

  $effect(() => {
    if (!toastStore.errorMessage) return;
    return on(window, "mousedown", dismiss);
  });

  $effect(() => {
    if (!toastStore.errorMessage || isHovered) return;

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  });
</script>

{#if toastStore.errorMessage}
  <div
    class="toast"
    role="alert"
    aria-live="assertive"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <span class="toast__icon"><Icon name="alert" size={18} /></span>
    <span class="toast__message">{toastStore.errorMessage}</span>
  </div>
{/if}

<style lang="scss">
  .toast {
    position: fixed;
    top: rhythm(2.5);
    left: 50%;
    z-index: $max-z-index;
    display: flex;
    gap: rhythm(1.25);
    align-items: flex-start;
    width: max-content;
    max-width: min(calc(100vw - #{rhythm(3)}), 440px);
    padding: rhythm(1.25) rhythm(2) rhythm(1.25) rhythm(1.5);
    font-family: var(--pm-font-sans);
    color: var(--pm-text-primary);
    background: var(--pm-surface-elevated);
    border: $border-width-sm solid var(--pm-border-strong);
    border-radius: var(--pm-radius-card);
    box-shadow: var(--pm-shadow-panel);
    transform: translateX(-50%);
    animation: toast-in 0.22s $timing-function;

    &__icon {
      flex: none;
      margin-top: 1px;
      color: var(--pm-danger-text);
    }

    &__message {
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
    }
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
