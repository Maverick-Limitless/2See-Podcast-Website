<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    /** Stagger position inside a group, in steps. */
    index?: number;
    /** ms delay added per index step. */
    step?: number;
    /** Skip the entrance and show immediately. */
    immediate?: boolean;
    as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'footer';
    children?: import('svelte').Snippet;
  }

  const { index = 0, step = 55, immediate = false, as = 'div', children }: Props = $props();

  let visible = $state(immediate);
  let node = $state<HTMLElement | null>(null);

  onMount(() => {
    if (immediate || typeof IntersectionObserver === 'undefined') {
      visible = true;
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible = true;
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    if (node) observer.observe(node);
    return () => observer.disconnect();
  });
</script>

<svelte:element
  this={as}
  bind:this={node}
  data-reveal
  class:is-revealed={visible}
  style="--reveal-delay: {index * step}ms"
>
  {#if children}{@render children()}{/if}
</svelte:element>
