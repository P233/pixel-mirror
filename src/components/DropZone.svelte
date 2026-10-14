<script lang="ts">
  import Icon from "./icons/Icon.svelte";

  interface Props {
    visible: boolean;
  }

  let { visible }: Props = $props();
</script>

{#if visible}
  <div class="drop-zone" role="region" aria-label="Drop zone for mockup upload">
    <div class="drop-zone__card">
      <div class="drop-zone__icon">
        <Icon name="upload" size={40} />
      </div>
      <p class="drop-zone__text">Drop image to set as mockup</p>
      <span class="drop-zone__subtext">PNG, JPG, WebP, or GIF up to 10 MB</span>
    </div>
  </div>
{/if}

<style lang="scss">
  .drop-zone {
    position: fixed;
    inset: 0;
    z-index: $max-z-index;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.32);
    animation: fade-in $transition-fast $timing-function;

    &__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: rhythm(4) rhythm(6);
      background: var(--pm-surface-elevated);
      border: 2px dashed var(--pm-accent);
      border-radius: var(--pm-radius-panel);
      box-shadow: var(--pm-shadow-panel);
      animation: scale-in $transition-fast $timing-function;
    }

    &__icon {
      margin-bottom: rhythm(1.5);
      color: var(--pm-accent-text);
    }

    &__text {
      margin: 0;
      font-family: var(--pm-font-sans);
      font-size: 15px;
      font-weight: 600;
      color: var(--pm-text-primary);
    }

    &__subtext {
      margin-top: 4px;
      font-family: var(--pm-font-sans);
      font-size: 12px;
      color: var(--pm-text-secondary);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
