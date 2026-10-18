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

<!-- The brief band: hero and lead episode as one full-bleed composition on the
     programme's own deep-navy ground. The headline states the premise; the
     current lead episode answers it behind a glass caption. -->
<section class="brief-band">
  <div class="brief-band__inner">
    <div class="brief-band__text" data-reveal>
      <p class="brief-band__eyebrow">{introEyebrow}</p>
      <h1 class="brief-band__title">
        <span class="hero-mask">Technology, business</span>
        <span class="hero-mask hero-mask--2">and policy, <span class="brief-band__numeral">seen twice</span></span>
      </h1>
      <p class="brief-band__lede">
        {data.site.tagline}. Long conversations with guests and entrepreneurs, and a weekly
        briefing on the same territory — both aimed at making complex ideas understandable.
      </p>
    </div>

    {#if lead}
      <a
        class="brief-band__media"
        href={`/episodes/${lead.slug}`}
        data-reveal-x
        style="--reveal-delay: 160ms"
      >
        {#if lead.thumbnail}
          <img
            src={lead.thumbnail}
            alt=""
            width="1280"
            height="720"
            fetchpriority="high"
            decoding="sync"
          />
        {/if}
        <span class="brief-band__caption">
          <span class="brief-band__caption-eyebrow">
            {#if lead.episodeNumber !== null}
              {lead.series === '2See Brief' ? `Brief CW${lead.episodeNumber}` : `Episode ${lead.episodeNumber}`}
            {:else}
              {lead.format === 'brief' ? 'Weekly brief' : 'Latest'}
            {/if}
          </span>
          <span class="brief-band__caption-title" dir="auto">
            {lead.originalTitle !== '' ? lead.originalTitle : lead.title}
          </span>
          <span class="brief-band__caption-meta">
            <FormatDate iso={lead.publishedAt} />
            {#if lead.durationSeconds}
              · <Duration seconds={lead.durationSeconds} />
            {/if}
          </span>
        </span>
      </a>
    {/if}

    <div class="brief-band__meta" data-reveal>
      <div class="brief-band__stats">
        <div class="brief-band__stat">
          <span class="brief-band__stat-value">{data.counts.episodesLong.n}</span>
          <span class="brief-band__stat-label">Long-form episodes</span>
        </div>
        <div class="brief-band__stat">
          <span class="brief-band__stat-value">{data.episodes.total}</span>
          <span class="brief-band__stat-label">Published entries</span>
        </div>
      </div>

      <p class="brief-band__persian">
        به توسی خوش آمدید؛ جایی که دو دانشجوی ایرانی از استنفورد و هاروارد به فناوری، تجارت و
        سیاست‌گذاری می‌پردازند.
      </p>
    </div>
  </div>
</section>

<p class="disclosure">
  An independent concept site — not affiliated with or endorsed by 2See Podcast.
</p>

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
          <aside class="mosaic__cell" data-reveal>
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
