<script lang="ts">
</script>

<svelte:head>
  <title>Page not found — 2See Podcast</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="section" style="padding-top: clamp(3rem, 2rem + 6vw, 8rem)">
  <div class="section__inner">
    <p class="section__eyebrow">404</p>
    <h1 class="section__title" style="font-size: var(--t-h1)">That page does not exist</h1>
    <p class="hero__lede" style="margin-top: 1.25rem">
      The link may be wrong, or the episode or story it pointed to may have been removed.
    </p>
    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem">
      <a class="btn btn--primary" href="/">Home</a>
      <a class="btn btn--ghost" href="/episodes">Episodes</a>
      <a class="btn btn--ghost" href="/stories">Stories</a>
    </div>
  </div>
</section>
