<script lang="ts">
  import EpisodeCard from '$lib/components/EpisodeCard.svelte';
  import StoryCard from '$lib/components/StoryCard.svelte';
  import Duration from '$lib/components/Duration.svelte';
  import FormatDate from '$lib/components/FormatDate.svelte';

  let { data } = $props();

  const lead = $derived(data.lead);
  const rest = $derived(data.rest ?? []);

  // Editorial framing, drawn from the channel's own description (see
  // docs/RESEARCH.md). No invented claims, no fabricated numbers.
  const introEyebrow = 'Two hosts, two registers';
</script>

<svelte:head>
  <title>{data.site.siteTitle} — {data.site.tagline}</title>
  <meta name="description" content={data.site.description} />
  {#if data.origin}<link rel="canonical" href="{data.origin}/" />{/if}
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{data.site.siteTitle} — {data.site.tagline}" />
  <meta property="og:description" content={data.site.description} />
  <meta property="og:image" content={data.site.defaultOgImage} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<!-- Hero: the thesis. The publication arrives as a pair — a long conversation
     and a weekly brief — so the hero splits into a numbered editorial
     statement and the current lead episode. -->
<section class="hero">
  <div class="hero__inner">
    <div data-reveal>
      <p class="hero__eyebrow">{introEyebrow}</p>
      <h1 class="hero__title">
        Technology, business and policy, <span class="hero__numeral">seen twice</span>
      </h1>
      <p class="hero__lede">
        {data.site.tagline}. Long conversations with guests and entrepreneurs, and a weekly
        briefing on the same territory — both aimed at making complex ideas understandable.
      </p>
    </div>

    <div class="hero__aside" data-reveal style="--reveal-delay: 120ms">
      <div class="hero__stat">
        <span class="hero__stat-value">{data.counts.episodesLong.n}</span>
        <span class="hero__stat-label">Long-form episodes</span>
      </div>
      <div class="hero__stat">
        <span class="hero__stat-value">{data.episodes.total}</span>
        <span class="hero__stat-label">Published entries</span>
      </div>
      <p class="hero__persian">
        به توسی خوش آمدید؛ جایی که دو دانشجوی ایرانی از استنفورد و هاروارد به فناوری، تجارت و
        سیاست‌گذاری می‌پردازند.
      </p>
    </div>
  </div>
</section>

<p class="disclosure">
  An independent concept site — not affiliated with or endorsed by 2See Podcast.
</p>

<!-- Featured: the current lead episode, presented as an editorial spread. -->
{#if lead}
  <section class="section section--tight">
    <div class="section__inner">
      <div data-reveal-x>
        <div class="slot-featured">
          {#if lead.thumbnail}
            <div class="slot-featured__media">
              <img
                src={lead.thumbnail}
                alt=""
                width="1280"
                height="720"
                fetchpriority="high"
                decoding="sync"
              />
            </div>
          {/if}
          <div class="slot-featured__content">
            <p class="slot-featured__eyebrow">
              {#if lead.episodeNumber !== null}
                {lead.series === '2See Brief' ? `Brief CW${lead.episodeNumber}` : `Episode ${lead.episodeNumber}`}
              {:else}
                {lead.format === 'brief' ? 'Weekly brief' : 'Latest'}
              {/if}
            </p>
            <h2 class="slot-featured__title" class:persian={lead.language === 'fa'}>
              <a href={`/episodes/${lead.slug}`}>
                {lead.originalTitle !== '' ? lead.originalTitle : lead.title}
              </a>
            </h2>
            {#if lead.summary}
              <p class="slot-featured__summary">{lead.summary}</p>
            {/if}
            <div class="slot-featured__foot">
              <FormatDate iso={lead.publishedAt} />
              {#if lead.durationSeconds}
                <Duration seconds={lead.durationSeconds} />
              {/if}
              <a class="slot-featured__cta" href={`/episodes/${lead.slug}`}>
                Read the episode notes <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
{/if}

<!-- Discovery: Pinterest-inspired masonry of the rest of the archive. -->
{#if rest.length > 0}
  <section class="section">
    <div class="section__inner">
      <div class="section__head">
        <div>
          <p class="section__eyebrow">Discovery</p>
          <h2 class="section__title">From the archive</h2>
        </div>
        <a class="section__link" href="/episodes">All episodes <span aria-hidden="true">→</span></a>
      </div>

      <div class="mosaic">
        {#if lead?.summary && lead.summary.trim() !== ''}
          <aside class="mosaic__cell mosaic__cell--wide" data-reveal>
            <div class="quote-tile">
              <p class="quote-tile__mark" aria-hidden="true">&ldquo;</p>
              <blockquote class="quote-tile__text">
                {lead.summary.replace(/…$/, '')}
              </blockquote>
              <p class="quote-tile__source">
                From the featured {lead.format === 'brief' ? 'brief' : 'episode'}
              </p>
            </div>
          </aside>
        {/if}

        {#each rest as episode, index (episode.id)}
          <EpisodeCard {episode} {index} textLed={index === 2} />
        {/each}
      </div>
    </div>
  </section>
{/if}

{#if data.stories.items.length > 0}
  <section class="section section--text">
    <div class="section__inner">
      <hr class="section__rule" />
      <div class="section__head">
        <div>
          <p class="section__eyebrow">Stories</p>
          <h2 class="section__title">Reading</h2>
        </div>
        <a class="section__link" href="/stories">All stories <span aria-hidden="true">→</span></a>
      </div>

      <div class="mosaic">
        {#each data.stories.items as story, index (story.id)}
          <StoryCard {story} {index} />
        {/each}
      </div>
    </div>
  </section>
{/if}

<!-- About: short, and clearly labelled as a concept. -->
<section class="section section--text">
  <div class="section__inner">
    <hr class="section__rule" />
    <div class="section__head">
      <div>
        <p class="section__eyebrow">About</p>
        <h2 class="section__title">The programme</h2>
      </div>
    </div>
    <div class="prose" style="max-width: 62ch">
      <p>{data.site.aboutBody.split('\n\n')[0]}</p>
      <p>{data.site.aboutBody.split('\n\n').slice(1).join(' ')}</p>
    </div>
    <p style="margin-top: 1.5rem">
      <a class="section__link" href="/about">More about this project <span aria-hidden="true">→</span></a>
    </p>
  </div>
</section>
