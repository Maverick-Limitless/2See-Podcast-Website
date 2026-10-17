<script lang="ts">
  import ReadingProgress from '$lib/components/ReadingProgress.svelte';
  import EpisodePlayer from '$lib/components/EpisodePlayer.svelte';
  import Duration from '$lib/components/Duration.svelte';
  import FormatDate from '$lib/components/FormatDate.svelte';
  import EpisodeCard from '$lib/components/EpisodeCard.svelte';
  import { page } from '$app/state';

  let { data } = $props();
  const episode = $derived(data.episode);
  const isPersian = $derived(episode.language === 'fa');
  const paragraphs = $derived(
    episode.description
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p !== '')
  );

  const canonical = $derived(
    data.origin ? `${data.origin}/episodes/${episode.slug}` : `${page.url.origin}/episodes/${episode.slug}`
  );
</script>

<svelte:head>
  <title>{episode.originalTitle || episode.title} — {data.site.siteTitle}</title>
  <meta name="description" content={episode.summary.slice(0, 300)} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content={episode.originalTitle || episode.title} />
  <meta property="og:description" content={episode.summary.slice(0, 300)} />
  <meta property="og:image" content={episode.thumbnail} />
  <meta property="og:video" content={data.watchUrl} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<ReadingProgress />

<article class="article">
  <header class="article__head">
    <p class="article__eyebrow">
      {#if episode.episodeNumber !== null}
        {episode.series === '2See Brief' ? `Weekly brief CW${episode.episodeNumber}` : `Episode ${episode.episodeNumber}`}
      {:else}
        {episode.format === 'short' ? 'Short' : 'Episode'}
      {/if}
      {#if episode.category} · {episode.category}{/if}
    </p>
    <h1 class="article__title" class:persian={isPersian}>
      {episode.originalTitle || episode.title}
    </h1>
    {#if episode.summary && !episode.description.includes(episode.summary.slice(0, 60))}
      <p class="article__subtitle" class:persian={isPersian}>{episode.summary}</p>
    {/if}

    <div class="article__byline">
      <span>Published <strong><FormatDate iso={episode.publishedAt} /></strong></span>
      {#if episode.durationSeconds}
        <span>Duration <strong><Duration seconds={episode.durationSeconds} /></strong></span>
      {/if}
      {#if episode.guests.length > 0}
        <span>
          {episode.guests.length > 1 ? 'Guests' : 'Guest'}
          <strong>{episode.guests.join(', ')}</strong>
        </span>
      {/if}
    </div>
  </header>

  <EpisodePlayer
    videoId={episode.youtubeId}
    thumbnail={episode.thumbnail}
    title={episode.originalTitle || episode.title}
    watchUrl={data.watchUrl}
  />

  <div class="grid-detail" style="display: grid; gap: 2.5rem; align-items: start;">
    <div class="prose" class:prose--persian={isPersian}>
      {#if paragraphs.length > 0}
        {#each paragraphs as paragraph}<p>{paragraph}</p>{/each}
      {:else}
        <p>No published notes for this episode yet.</p>
      {/if}
    </div>

    <aside>
      <dl class="facts">
        {#if episode.series}
          <div class="facts__row">
            <dt class="facts__key">Series</dt>
            <dd class="facts__value">{episode.series}</dd>
          </div>
        {/if}
        <div class="facts__row">
          <dt class="facts__key">Format</dt>
          <dd class="facts__value">
            {episode.format === 'short' ? 'Short' : episode.format === 'brief' ? 'Weekly brief' : 'Conversation'}
          </dd>
        </div>
        <div class="facts__row">
          <dt class="facts__key">Language</dt>
          <dd class="facts__value">{episode.language === 'fa' ? 'Persian' : 'English'}</dd>
        </div>
        {#if episode.tags.length > 0}
          <div class="facts__row">
            <dt class="facts__key">Topics</dt>
            <dd class="facts__value">{episode.tags.join(', ')}</dd>
          </div>
        {/if}
        <div class="facts__row">
          <dt class="facts__key">Source</dt>
          <dd class="facts__value">
            <a class="section__link" href={data.watchUrl} rel="noopener noreferrer" target="_blank">
              Original video <span aria-hidden="true">→</span>
            </a>
          </dd>
        </div>
      </dl>

      <div style="margin-top: 1.5rem">
        <p class="section__eyebrow" style="margin-bottom: 0.75rem">Share</p>
        <div class="chips">
          <a class="chip" href={data.watchUrl} rel="noopener noreferrer" target="_blank">YouTube</a>
          <button class="chip" type="button" onclick={() => navigator.clipboard?.writeText(canonical)}>
            Copy link
          </button>
        </div>
      </div>
    </aside>
  </div>

  <p style="margin-top: 2.5rem">
    <a class="section__link" href="/episodes">Back to the archive <span aria-hidden="true">→</span></a>
  </p>
</article>

{#if data.related.length > 0}
  <section class="section section--text">
    <div class="section__inner">
      <hr class="section__rule" />
      <div class="section__head">
        <div>
          <p class="section__eyebrow">Related</p>
          <h2 class="section__title">More from the archive</h2>
        </div>
      </div>
      <div class="mosaic">
        {#each data.related as related, index (related.id)}
          <EpisodeCard episode={related} {index} />
        {/each}
      </div>
    </div>
  </section>
{/if}

<style>
  @media (min-width: 900px) {
    .grid-detail {
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    }
  }
</style>
