<script lang="ts">
  import StoryCard from '$lib/components/StoryCard.svelte';

  let { data } = $props();
  const stories = $derived(data.stories);
  const filters = $derived(data.filters);
</script>

<svelte:head>
  <title>Stories — {data.site.siteTitle}</title>
  <meta name="description" content="Editorial articles and long-form notes from the {data.site.siteTitle} desk." />
  <meta property="og:title" content="Stories — {data.site.siteTitle}" />
  <meta property="og:type" content="website" />
  {#if data.origin}<link rel="canonical" href="{data.origin}/stories" />{/if}
</svelte:head>

<section class="section section--tight">
  <div class="section__inner">
    <p class="section__eyebrow">Editorial</p>
    <h1 class="section__title" style="font-size: var(--t-h1)">Stories</h1>
    <p class="section__meta">
      {stories.total} published article{stories.total === 1 ? '' : 's'}. Text, not video — reading
      time is measured from the actual content.
    </p>
  </div>
</section>

<div class="section__inner" style="padding-bottom: 0">
  <form class="toolbar" method="get" action="/stories" role="search">
    <div class="toolbar__search">
      <label class="visually-hidden" for="q">Search stories</label>
      <input
        class="input"
        id="q"
        type="search"
        name="q"
        value={filters.query}
        placeholder="Search title, summary or topic"
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
</div>

<section class="section" style="padding-top: 1.5rem">
  <div class="section__inner">
    {#if stories.items.length === 0}
      <div class="empty-state">
        <h2 class="empty-state__title">No stories published yet</h2>
        <p class="empty-state__body">
          Nothing matches that search. When the publisher writes an article, it appears here.
        </p>
      </div>
    {:else}
      <div class="mosaic">
        {#each stories.items as story, index (story.id)}
          <StoryCard {story} {index} textLed={index % 4 === 0} />
        {/each}
      </div>

      {#if stories.hasMore}
        <div style="margin-top: 2.5rem; display: flex; justify-content: center">
          <a class="btn btn--ghost" href="/stories?page={stories.page + 1}">
            Load {Math.min(stories.pageSize, stories.total - stories.items.length)} more
          </a>
        </div>
      {/if}
    {/if}
  </div>
</section>
