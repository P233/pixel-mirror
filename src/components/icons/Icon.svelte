<script lang="ts">
  import { ICON_PATHS, type IconName } from "./paths";

  interface Props {
    name: IconName;
    size?: number;
  }

  let { name, size = 20 }: Props = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#each ICON_PATHS[name] as d, i (i)}
    <path {d} />
  {/each}
</svg>
