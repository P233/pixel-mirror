<script lang="ts">
  // Constants
  import { ALLOWED_MIME_TYPES } from "~/constants";

  // Icons
  import IconDelete from "~/assets/delete-02-stroke-rounded.svg?component";
  import IconUpload from "~/assets/image-upload-stroke-rounded.svg?component";
  // Platform
  import { blobSrc } from "~/platform/blobSrc";
  // Stores
  import { DOCK_TRANSITION_DURATION, dockStore } from "~/stores/dockStore.svelte";
  import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      mockupManagerStore.upload(Array.from(target.files));
    }
    target.value = "";
  }

  function handleDelete(e: Event, id: string) {
    e.stopPropagation();
    mockupManagerStore.delete(id);
  }

  function handleSelect(id: string) {
    dockStore.enterToolbar();
    setTimeout(() => mockupManagerStore.select(id), DOCK_TRANSITION_DURATION);
  }
</script>

{#if mockupManagerStore.initialized}
  <div class="container" role="region" aria-label="Mockup Manager">
    <div class="inner">
      <div class="grid">
        <label class="upload-button">
          <span class="upload-button__icon">
            <IconUpload />
          </span>
          <span class="upload-button__text">Upload Mockups</span>
          <input type="file" accept={ALLOWED_MIME_TYPES.join(",")} multiple onchange={handleInputChange} />
        </label>

        {#each mockupManagerStore.mockups as mockup (mockup.id)}
          {@const isActive = mockupManagerStore.activeMockupId === mockup.id}
          <div class="mockup" class:active={isActive}>
            <button class="mockup__preview" type="button" disabled={isActive} onclick={() => handleSelect(mockup.id)}>
              <img class="mockup__image" {@attach blobSrc(mockup.thumbnail)} alt={mockup.filename} draggable="false" />
            </button>
            {#if isActive}
              <div class="mockup__indicator"></div>
            {/if}
            <button class="mockup__delete" onclick={(e) => handleDelete(e, mockup.id)} title="Delete mockup">
              <IconDelete />
            </button>
          </div>
        {/each}
      </div>
    </div>
    <footer class="footer">
      <button
        class="footer__button"
        data-testid="btn-clear"
        onclick={mockupManagerStore.clear}
        disabled={mockupManagerStore.mockups.length === 0}
      >
        Clear Mockups
      </button>
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
    cursor: pointer;
    outline: none;
    background: transparent;
    border: $border-width-md solid var(--mockup-border);
    border-radius: rhythm(2);
    transition: background $transition-fast ease;

    &:hover,
    &:focus-visible,
    &:has(:focus-visible) {
      @include focus-ring;
      background: var(--focus-bg);
      border-color: var(--mockup-border-hover);
    }

    &__icon {
      width: rhythm(4);
      height: rhythm(4);
      margin-bottom: rhythm(1.5);

      :global(> svg) {
        width: 100%;
        height: 100%;
      }
    }

    &__text {
      font-size: 15px;
      font-weight: 500;
      line-height: 24px;
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
      border-color: var(--mockup-border-hover);
    }

    &__preview {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border: $border-width-md solid var(--mockup-border);
      border-radius: rhythm(2);

      &:hover,
      &:focus {
        border-color: var(--mockup-border-hover);
        @include focus-ring;
      }
    }

    &__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &__indicator {
      position: absolute;
      top: rhythm(1.5);
      left: rhythm(1.5);
      width: rhythm(1.5);
      height: rhythm(1.5);
      pointer-events: none;
      background: var(--color-success);
      border-radius: 50%;
      box-shadow: 0 0 0 $border-width-md var(--dock-bg);
    }

    &__delete {
      position: absolute;
      right: rhythm(1.5);
      bottom: rhythm(1.5);
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: rhythm(4);
      height: rhythm(4);
      padding: rhythm(0.5);
      color: var(--btn-fg);
      background: var(--btn-bg);
      border-radius: rhythm(2);
      transition:
        background $transition-fast ease,
        opacity $transition-fast ease;

      @media (hover: hover) {
        opacity: 0;
      }

      :global(> svg) {
        width: rhythm(2.5);
        height: rhythm(2.5);
      }

      &:hover,
      &:focus-visible {
        background: var(--btn-hover-bg);
        opacity: 1;
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
