<script lang="ts">
  import FormatDate from './FormatDate.svelte';
  import type { StorySummary } from '$lib/shared/types';

  interface Props {
    story: StorySummary;
    index: number;
    textLed?: boolean;
  }

  const { story, index, textLed = false }: Props = $props();
  const spanClass = $derived(story.spanClass);
  const href = $derived(`/stories/${story.slug}`);
</script>

<article class="{spanClass} card" class:card--featured={story.featured}>
  {#if !textLed && story.coverImage}
    <div class="card__frame">
      <img
        class="card__image"
        src={story.coverImage}
        alt={story.coverAlt}
        width="1280"
        height="720"
        loading={index < 2 ? 'eager' : 'lazy'}
        decoding={index < 2 ? 'sync' : 'async'}
        fetchpriority={index < 2 ? 'high' : 'auto'}
      />
    </div>
  {/if}

  <div class="card__body">
    {#if story.category || story.featured}
      <p class="card__eyebrow">
        {#if story.featured}<span class="card__dot"></span><span>Featured</span>{/if}
        {#if story.category}<span class="card__dot"></span><span>{story.category}</span>{/if}
      </p>
    {/if}

    <h3 class="card__title">
      <a class="card__link" {href}>{story.title}</a>
    </h3>

    {#if story.subtitle}
      <p class="card__summary">{story.subtitle}</p>
    {:else if story.summary}
      <p class="card__summary">{story.summary}</p>
    {/if}

    <div class="card__foot">
      <FormatDate iso={story.publishedAt} />
      <span aria-hidden="true">·</span>
      <span>{story.readingMinutes} min read</span>
      {#if story.author}
        <span aria-hidden="true">·</span>
        <span>{story.author}</span>
      {/if}
    </div>
  </div>
</article>
