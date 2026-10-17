<script lang="ts">
  import EpisodeCard from '$lib/components/EpisodeCard.svelte';

  let { data } = $props();

  const formats = [
    { value: 'all', label: 'Everything' },
    { value: 'episode', label: 'Conversations' },
    { value: 'brief', label: 'Weekly brief' },
    { value: 'short', label: 'Shorts' }
  ] as const;

  const episodes = $derived(data.episodes);
  const filters = $derived(data.filters);
  let pending = $state(false);
</script>

<svelte:head>
  <title>Episodes — {data.site.siteTitle}</title>
  <meta name="description" content="Every published episode of {data.site.siteTitle}: long conversations, the weekly brief, and shorts." />
  <meta property="og:title" content="Episodes — {data.site.siteTitle}" />
  <meta property="og:type" content="website" />
  {#if data.origin}<link rel="canonical" href="{data.origin}/episodes" />{/if}
</svelte:head>

<section class="section section--tight">
  <div class="section__inner">
    <p class="section__eyebrow">Archive</p>
    <h1 class="section__title" style="font-size: var(--t-h1)">Episodes</h1>
    <p class="section__meta">
      {episodes.total} published item{episodes.total === 1 ? '' : 's'}. Titles and descriptions are
      reproduced as published, in their original language.
    </p>
  </div>
</section>

<!-- Search and filters. Form submission is a plain GET, so it works with
     JavaScript disabled and produces a shareable URL. -->
<div class="section__inner" style="padding-bottom: 0">
  <form class="toolbar" method="get" action="/episodes" role="search">
    <div class="toolbar__search">
      <label class="visually-hidden" for="q">Search episodes</label>
      <input
        class="input"
        id="q"
        type="search"
        name="q"
        value={filters.query}
        placeholder="Search title, guest or topic"
      />
    </div>

    {#if data.categories.length > 0}
      <div>
        <label class="visually-hidden" for="category">Category</label>
        <select class="select" id="category" name="category">
          <option value="">All categories</option>
          {#each data.categories as category (category)}
            <option value={category} selected={filters.category === category}>{category}</option>
          {/each}
        </select>
      </div>
    {/if}

    <button class="btn btn--ghost btn--small" type="submit">Search</button>
  </form>

  <div class="chips" style="padding-bottom: 1.25rem" role="group" aria-label="Filter by format">
    {#each formats as format (format.value)}
      <a
        class="chip"
        href="/episodes?format={format.value}{filters.query ? `&q=${encodeURIComponent(filters.query)}` : ''}"
        aria-current={filters.format === format.value ? 'true' : undefined}
      >
        {format.label}
      </a>
    {/each}

    {#if filters.format !== 'all' || filters.query !== '' || filters.category !== ''}
      <a class="chip" href="/episodes" aria-label="Clear the search and filters">
        Clear filters &#10005;
      </a>
    {/if}
  </div>
</div>

<section class="section" style="padding-top: 0">
  <div class="section__inner">
    {#if episodes.items.length === 0}
      <div class="empty-state">
        <h2 class="empty-state__title">Nothing matched</h2>
        <p class="empty-state__body">
          No episodes match that search. Try a shorter term, or clear the filters to see the whole
          archive.
        </p>
        <p style="margin-top: 1.25rem">
          <a class="btn btn--ghost btn--small" href="/episodes">Clear filters</a>
        </p>
      </div>
    {:else}
      <div class="mosaic">
        {#each episodes.items as episode, index (episode.id)}
          <EpisodeCard {episode} {index} textLed={index % 5 === 4} />
        {/each}
      </div>

      {#if episodes.hasMore}
        <div style="margin-top: 2.5rem; display: flex; justify-content: center">
          <a class="btn btn--ghost" href="/episodes?page={episodes.page + 1}">
            Load {Math.min(episodes.pageSize, episodes.total - episodes.items.length)} more
          </a>
        </div>
      {/if}
    {/if}
  </div>
</section>
