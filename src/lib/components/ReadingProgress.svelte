<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Reading-progress rail for long-form pages.
   *
   * A two-pixel amber line under the masthead that fills as the visitor reads.
   * Only transform is animated, so it never triggers layout; under reduced
   * motion it is replaced by a static neutral line rather than animating.
   */
  let bar = $state<HTMLElement | null>(null);
  let supported = $state(true);

  onMount(() => {
    if (typeof IntersectionObserver === 'undefined' || !window.matchMedia) {
      supported = false;
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) {
      supported = false;
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const read = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      bar?.style.setProperty('transform', `scaleX(${read})`);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  });
</script>

{#if supported}
  <div class="progress-rail" aria-hidden="true">
    <div class="progress-rail__bar" bind:this={bar}></div>
  </div>
{/if}
