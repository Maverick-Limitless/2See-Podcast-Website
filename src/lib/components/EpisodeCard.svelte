<script lang="ts">
  import FormatDate from './FormatDate.svelte';
  import Duration from './Duration.svelte';
  import type { EpisodeSummary } from '$lib/shared/types';

  interface Props {
    episode: EpisodeSummary;
    /** Index inside its group, for stagger. */
    index: number;
    /** Text-led tiles carry no image. */
    textLed?: boolean;
  }

  const { episode, index, textLed = false }: Props = $props();
  const spanClass = $derived(episode.spanClass);

  const href = `/episodes/${episode.slug}`;
  const isPersian = $derived(episode.language === 'fa');
  const title = $derived(episode.originalTitle !== '' ? episode.originalTitle : episode.title);
</script>

<article
  class="{spanClass} card"
  class:card--featured={episode.featured}
  class:card--portrait={episode.format === 'short'}
  class:card--square={episode.format === 'brief'}
>
  {#if !textLed && episode.thumbnail}
    <div class="card__frame">
      <img
        class="card__image"
        src={episode.thumbnail}
        alt=""
        width="1280"
        height="720"
        loading={index < 2 ? 'eager' : 'lazy'}
        decoding={index < 2 ? 'sync' : 'async'}
        fetchpriority={index < 2 ? 'high' : 'auto'}
      />
      <span class="card__format card__format--{episode.format}">
        {episode.format === 'short' ? 'Short' : episode.format === 'brief' ? 'Brief' : 'Episode'}
      </span>
    </div>
  {:else}
    <span class="card__format card__format--{episode.format}">
      {episode.format === 'short' ? 'Short' : episode.format === 'brief' ? 'Brief' : 'Episode'}
    </span>
  {/if}

  <div class="card__body">
    <p class="card__eyebrow">
      {#if episode.episodeNumber !== null}
        <span class="card__number">
          {episode.series === '2See Brief' ? `CW${episode.episodeNumber}` : `EP ${episode.episodeNumber}`}
        </span>
      {/if}
      {#if episode.category}<span class="card__dot"></span><span>{episode.category}</span>{/if}
    </p>

    <h3 class="card__title" class:card__title--persian={isPersian} dir="auto">
      <a class="card__link" {href} dir="auto">{title}</a>
    </h3>

    {#if episode.summary}
      <p class="card__summary" class:card__summary--persian={isPersian} dir="auto">
        {episode.summary}
      </p>
    {/if}

    <div class="card__foot">
      <FormatDate iso={episode.publishedAt} />
      {#if episode.durationSeconds}
        <span aria-hidden="true">·</span>
        <Duration seconds={episode.durationSeconds} />
      {/if}
      {#if episode.guests.length > 0}
        <span aria-hidden="true">·</span>
        <span>with {episode.guests[0]}</span>
      {/if}
    </div>
  </div>
</article>
