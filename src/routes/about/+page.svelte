<script lang="ts">
  let { data } = $props();
  const site = $derived(data.site);
  const paragraphs = $derived(site.aboutBody.split('\n\n').filter((p) => p.trim() !== ''));
</script>

<svelte:head>
  <title>About — {site.siteTitle}</title>
  <meta name="description" content="About {site.siteTitle} and this independent website concept." />
  <meta property="og:title" content="About — {site.siteTitle}" />
  <meta property="og:type" content="website" />
  {#if data.origin}<link rel="canonical" href="{data.origin}/about" />{/if}
</svelte:head>

<section class="hero" style="border-bottom: 0">
  <div class="hero__inner">
    <div data-reveal>
      <p class="hero__eyebrow">About</p>
      <h1 class="hero__title" style="font-size: var(--t-h1)">The programme</h1>
      <p class="hero__lede">{site.description}</p>
    </div>
  </div>
</section>

<section class="section section--text" style="padding-top: 0">
  <div class="section__inner">
    <div class="prose">
      {#each paragraphs as paragraph}<p>{paragraph}</p>{/each}
    </div>

    <div class="quote" data-reveal>
      <blockquote class="quote__text">
        The podcast brings together two academic paths and one shared love of learning.
      </blockquote>
      <p class="quote__source">From the programme's published description</p>
    </div>

    <hr class="section__rule" />

    <div class="section__head">
      <div>
        <p class="section__eyebrow">Hosts</p>
        <h2 class="section__title" style="font-size: var(--t-h3)">Two academic paths</h2>
      </div>
    </div>

    <div class="mosaic mosaic--single" style="max-width: 42rem">
      {#each site.hosts as host, index (host.latinName || host.name)}
        <div class="card host-card" data-reveal style="--reveal-delay: {index * 80}ms">
          <div class="card__body">
            <h3 class="card__title">{host.latinName || host.name}</h3>
            <p class="persian host-card__native" dir="rtl">{host.name}</p>
            <p class="card__summary" style="margin-top: 0.75rem">
              {host.role} · {host.credentials}
            </p>
          </div>
        </div>
      {/each}
    </div>

    <hr class="section__rule" />

    <div class="notice notice--warn">
      <p style="margin: 0 0 0.5rem"><strong>Independent concept</strong></p>
      <p style="margin: 0">{site.contactNote}</p>
    </div>

    <p style="margin-top: 1.5rem">
      <a class="section__link" href={site.channelUrl} rel="noopener noreferrer" target="_blank">
        Listen on YouTube <span aria-hidden="true">→</span>
      </a>
    </p>
  </div>
</section>
