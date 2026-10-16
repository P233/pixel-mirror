# Architecture

Pixel Mirror is a client-side custom element. `src/main.ts` registers and mounts it;
`src/bootstrap.ts` owns listeners, cross-tab invalidation, and mount cleanup.

## State ownership

| Owner                                   | Persistent state                                   | Runtime state                                                               |
| --------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `stores/gridStore.svelte.ts`            | Grid library, selected grid, grid appearance       | Command queue and load status                                               |
| `stores/mockupStore.svelte.ts`          | Mockup library, selected mockup, mockup appearance | Command queue and load status                                               |
| `features/overlay/controller.svelte.ts` | None                                               | Gestures, inspection transforms, page/image sizes, image URL and load token |
| `stores/dockStore.svelte.ts`            | Dock appearance                                    | Current panel                                                               |
| `platform/database.ts`                  | IndexedDB records                                  | Connection lifecycle                                                        |

The active Grid configuration is derived from the library and selected ID. It has
no second cache or separate asynchronous lookup. The overlay controller reads
Mockup state and issues appearance actions; the library does not call the controller.
Temporary interaction belongs to the displayed image session and is discarded when
that session is cleared, replaced, fails, or unmounts.

## Commands and appearance writes

Resource commands maintain resources and their selected references in one
IndexedDB transaction. Activation also shows and unlocks the Mockup. Grid Reset
replaces the library, default selection, and complete Grid appearance together.
Commands return committed data, so publishing local state requires no separate
post-commit read. Resource state is published only after transaction completion.

Each feature serializes its resource commands. Uploads reserve their place before
image decoding, so a later Clear runs after the upload. Rejected commands preserve
the local projection and let subsequent commands proceed.

Ordinary appearance patches exclude selected IDs at the type and runtime
boundaries. `platform/settings.svelte.ts` applies edits immediately, merges queued
patches, and allows one active appearance write per group. Resource commits wait
for an active appearance write and pause later saves until publication. Reset or
activation retires the dirty fields it replaces; edits made during a commit survive.
A failed ordinary save keeps its fields for the next edit, without automatic retries.

## Cross-tab consistency and lifecycle

One BroadcastChannel per mounted element announces only the affected library name
after a successful resource command. The receiving page refreshes from IndexedDB
without rebroadcasting. Refresh requests are coalesced, including invalidations
received during a read. Focus and remount also refresh, including when channels are
unavailable.

Refresh retains valid local selections and local appearance. A deleted Mockup
clears the local selection; Grid falls back to a valid saved/default selection.
Appearance is not live-mirrored between pages. Pending edits and form drafts stay
local. Transactions order committed writes; the system does not globally order
click times across tabs. Tabs running older bundles should be refreshed to use the
same command protocol.

Unmount closes the channel, removes mount listeners, invalidates image loads, and
revokes the current URL. Feature stores retain their projections; remount refreshes
resources and recreates the displayed image URL.

## Persistence and rendering

The schema remains IndexedDB version 3. Images use bytes and MIME types; version
1/2 data and unreleased version 3 Blob records remain readable. Full-size images
are loaded separately from library metadata. Missing legacy size metadata is
resolved by loading the image.

Placement and saved offsets use document coordinates. `MockupOverlay.svelte`
renders a document-sized alignment clip inside a fixed viewport. A separate,
non-animated scroll translation converts document coordinates into viewport
coordinates. Image transforms retain their existing gesture/animation behavior.
Overlay positioning preserves host `html` styles. Page measurement does not
temporarily resize the overlay.
Scroll translation runs on the main thread. Asynchronous browser scrolling can
get ahead while that thread is busy; this adapter does not guarantee synchronization
with compositor scrolling on every frame.
Page-size observation still handles resize, host DOM changes, resource loads, and
completed transitions so bottom alignment follows growing or shrinking content.

Fixed overlays still follow the browser's containing-block rules. Root-level
`transform` or `contain: layout` can change their positioning; this existing Dock
and Grid limitation remains outside the supported positioning contract.
