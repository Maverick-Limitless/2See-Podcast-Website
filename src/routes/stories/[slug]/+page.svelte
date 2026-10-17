<script lang="ts">
  import ReadingProgress from '$lib/components/ReadingProgress.svelte';
  import { page } from '$app/state';

  let { data } = $props();
  const story = $derived(data.story);
  const canonical = $derived(
    data.origin
      ? `${data.origin}/stories/${story.slug}`
      : `${page.url.origin}/stories/${story.slug}`
  );
</script>

<svelte:head>
  <title>{story.metaTitle || story.title} — {data.site.siteTitle}</title>
  <meta name="description" content={story.metaDescription || story.summary.slice(0, 300)} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={story.metaTitle || story.title} />
  <meta property="og:description" content={story.metaDescription || story.summary.slice(0, 300)} />
  {#if story.coverImage}<meta property="og:image" content={story.coverImage} />{/if}
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<ReadingProgress />

<article class="article">
  <header class="article__head">
    {#if story.category}
      <p class="article__eyebrow">{story.category}</p>
    {/if}
    <h1 class="article__title">{story.title}</h1>
    {#if story.subtitle}
      <p class="article__subtitle">{story.subtitle}</p>
    {/if}

    <div class="article__byline">
      {#if story.author}<span>By <strong>{story.author}</strong></span>{/if}
      <span>Published <strong>{story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</strong></span>
      <span><strong>{story.readingMinutes} min read</strong></span>
    </div>
  </header>

  {#if story.coverImage}
    <figure class="article__cover" style="margin: 0 auto 2rem; max-width: var(--max)">
      <img src={story.coverImage} alt={story.coverAlt} width="1280" height="720" loading="eager" />
      {#if story.coverCaption}
        <figcaption class="article__cover-caption">{story.coverCaption}</figcaption>
      {/if}
    </figure>
  {/if}

  <!--
    The body is rendered at write time by the allowlisted Markdown renderer and
    stored as HTML. It is never re-rendered here and never contains raw input.
  -->
  <div class="prose">
    {#if story.bodyHtml}
      {@html story.bodyHtml}
    {/if}
  </div>

  <div class="share">
    <span class="share__label">Share</span>
    <button class="share__link" type="button" onclick={() => navigator.clipboard?.writeText(canonical)}>
      Copy link
    </button>
    <a class="share__link" href="/stories">Back to stories</a>
  </div>
</article>
