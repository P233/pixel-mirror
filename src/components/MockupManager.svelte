<script lang="ts">
  // Constants
  import { ALLOWED_MIME_TYPES } from "~/constants";

  // Icons
  import Icon from "./icons/Icon.svelte";
  // Platform
  import { blobSrc } from "~/platform/blobSrc";
  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";

  let confirmingClear = $state(false);

  function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatMeta(mockup: Mockup): string {
    const parts: string[] = [];
    if (mockup.width && mockup.height) {
      parts.push(`${mockup.width}×${mockup.height}`);
    }
    const sizeText = formatBytes(mockup.fileSize);
    if (sizeText) {
      parts.push(sizeText);
    }
    return parts.join(" · ");
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      mockupManagerStore.upload(Array.from(target.files));
    }
    target.value = "";
  }

  function handleDelete(e: Event, id: string) {
    e.stopPropagation();
    if (mockupManagerStore.mockups.length <= 1) {
      confirmingClear = false;
    }
    mockupManagerStore.delete(id);
  }

  function handleSelect(id: string) {
    mockupManagerStore.select(id);
    dockStore.enterToolbar();
  }

  function handleClearClick() {
    if (!confirmingClear) {
      confirmingClear = true;
      return;
    }
    confirmingClear = false;
    mockupManagerStore.clear();
  }
</script>

{#if mockupManagerStore.initialized}
  <div class="container" role="region" aria-label="Mockup Manager">
    <header class="studio-header">
      <div class="studio-header__title-group">
        <h3 class="studio-header__title">Mockup Studio</h3>
        <span class="studio-header__badge">{mockupManagerStore.mockups.length}</span>
      </div>
      <span class="studio-header__hint">Drop PNG, JPG, WebP, or GIF anywhere on the page</span>
    </header>
    <div class="inner">
      <div class="grid">
        <label class="upload-button">
          <span class="upload-button__icon">
            <Icon name="upload" size={28} />
          </span>
          <span class="upload-button__text">Upload Mockups</span>
          <span class="upload-button__subtext">Click or drag files</span>
          <input type="file" accept={ALLOWED_MIME_TYPES.join(",")} multiple onchange={handleInputChange} />
        </label>

        {#each mockupManagerStore.mockups as mockup (mockup.id)}
          {@const isActive = mockupManagerStore.activeMockupId === mockup.id}
          {@const metaText = formatMeta(mockup)}
          <div class="mockup" class:active={isActive}>
            <button class="mockup__preview" type="button" disabled={isActive} onclick={() => handleSelect(mockup.id)}>
              <img class="mockup__image" {@attach blobSrc(mockup.thumbnail)} alt={mockup.filename} draggable="false" />
              <div class="mockup__meta">
                <span class="mockup__filename" title={mockup.filename}>{mockup.filename}</span>
                {#if metaText}
                  <span class="mockup__details">{metaText}</span>
                {/if}
              </div>
            </button>
            {#if isActive}
              <div class="mockup__indicator" title="Active mockup">Active</div>
            {/if}
            <button
              class="mockup__delete"
              type="button"
              onclick={(e) => handleDelete(e, mockup.id)}
              title="Delete mockup"
            >
              <Icon name="delete" size={16} />
            </button>
          </div>
        {/each}
      </div>
    </div>
    <footer class="footer">
      {#if confirmingClear && mockupManagerStore.mockups.length > 0}
        <button
          class="footer__button footer__button--ghost"
          type="button"
          data-testid="btn-cancel-clear"
          onclick={() => (confirmingClear = false)}
        >
          Cancel
        </button>
      {/if}
      <button
        class="footer__button"
        class:footer__button--ghost={!(confirmingClear && mockupManagerStore.mockups.length > 0)}
        class:footer__button--danger={confirmingClear && mockupManagerStore.mockups.length > 0}
        type="button"
        data-testid="btn-clear"
        onclick={handleClearClick}
        disabled={mockupManagerStore.mockups.length === 0}
      >
        {confirmingClear && mockupManagerStore.mockups.length > 0 ? "Confirm Clear?" : "Clear Mockups"}
      </button>
      <button class="footer__button" type="button" data-testid="btn-close" onclick={dockStore.enterToolbar}>
        Close
      </button>
    </footer>
  </div>
{/if}

<style lang="scss">
  .container {
    @include manager-container;
  }

  .studio-header {
    display: flex;
    flex-shrink: 0;
    gap: rhythm(1.5);
    align-items: center;
    justify-content: space-between;
    padding: rhythm(2) rhythm(3);
    border-bottom: $border-width-sm solid var(--pm-border-subtle);

    &__title-group {
      display: flex;
      gap: rhythm(1);
      align-items: center;
    }

    &__title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--pm-text-primary);
    }

    &__badge {
      padding: 2px 8px;
      font-family: var(--pm-font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--pm-accent-text);
      background: var(--pm-accent-subtle);
      border-radius: var(--pm-radius-pill);
    }

    &__hint {
      font-size: 12px;
      color: var(--pm-text-secondary);

      @media (max-width: 560px) {
        display: none;
      }
    }
  }

  .inner {
    @include manager-inner;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: rhythm(2);
  }

  .upload-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    padding: rhythm(2);
    text-align: center;
    cursor: pointer;
    outline: none;
    background: var(--pm-surface-subtle);
    border: $border-width-md dashed var(--pm-border-strong);
    border-radius: var(--pm-radius-card);
    transition:
      background $transition-fast ease,
      border-color $transition-fast ease;

    &:hover,
    &:has(:focus-visible) {
      background: var(--pm-accent-subtle);
      border-color: var(--pm-accent);
    }

    &:has(:focus-visible) {
      @include focus-ring;
    }

    &__icon {
      width: rhythm(3.5);
      height: rhythm(3.5);
      margin-bottom: rhythm(1);
      color: var(--pm-accent-text);
    }

    &__text {
      font-size: 13px;
      font-weight: 600;
      line-height: 18px;
      color: var(--pm-text-primary);
    }

    &__subtext {
      margin-top: 2px;
      font-size: 11px;
      color: var(--pm-text-secondary);
    }
  }

  input[type="file"] {
    @include visually-hidden;
  }

  .mockup {
    position: relative;
    aspect-ratio: 1 / 1;

    @media (hover: hover) {
      &:hover .mockup__delete {
        opacity: 1;
      }
    }

    &.active .mockup__preview {
      border-color: var(--pm-accent);
      box-shadow: 0 0 0 2px var(--pm-accent-subtle);
    }

    &__preview {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--pm-surface-subtle);
      border: $border-width-md solid var(--pm-mockup-border);
      border-radius: var(--pm-radius-card);
      transition: border-color $transition-fast ease;

      &:hover:not(:disabled),
      &:focus-visible {
        border-color: var(--pm-mockup-border-hover);
      }

      &:focus-visible {
        @include focus-ring;
      }
    }

    &__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }

    &__meta {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: rhythm(2) rhythm(1.25) rhythm(1);
      text-align: left;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.42) 65%, transparent 100%);
    }

    &__filename {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      font-weight: 600;
      line-height: 14px;
      color: #fff;
      white-space: nowrap;
    }

    &__details {
      font-family: var(--pm-font-mono);
      font-size: 10px;
      line-height: 13px;
      color: rgba(255, 255, 255, 0.8);
    }

    &__indicator {
      position: absolute;
      top: rhythm(1);
      left: rhythm(1);
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 700;
      line-height: 14px;
      color: var(--pm-accent-fg);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      pointer-events: none;
      background: var(--pm-accent);
      border-radius: var(--pm-radius-pill);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    &__delete {
      position: absolute;
      top: rhythm(1);
      right: rhythm(1);
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: rhythm(3.5);
      height: rhythm(3.5);
      padding: rhythm(0.5);
      color: #fff;
      background: rgba(24, 24, 27, 0.72);
      border-radius: var(--pm-radius-control);
      backdrop-filter: blur(4px);
      transition:
        background $transition-fast ease,
        opacity $transition-fast ease;

      @media (hover: hover) {
        opacity: 0;
      }

      &:hover,
      &:focus-visible {
        background: var(--pm-danger);
        opacity: 1;
      }

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  @media (max-width: 680px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 480px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
