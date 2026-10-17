<script lang="ts">
  import { page } from '$app/state';

  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? 'The requested page could not be served.');

  const title = $derived(
    status === 404
      ? 'That page does not exist'
      : status === 403
        ? 'You are not allowed to see this'
        : status === 429
          ? 'Too many attempts'
          : 'Something went wrong'
  );

  const detail = $derived(
    status === 404
      ? 'The link may be wrong, or the episode or story it pointed to may have been removed.'
      : status === 403
        ? 'You do not have permission to view this page. If you were trying to reach the publishing panel, sign in first.'
        : status === 429
          ? 'Too many attempts in a short period. Wait a few minutes and try again.'
          : 'The request could not be completed. Try again, or return to the home page. If the problem continues, the archive is also available on YouTube.'
  );
</script>

<svelte:head>
  <title>{title} — 2See Podcast</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="section" style="padding-top: clamp(3rem, 2rem + 6vw, 8rem)">
  <div class="section__inner">
    <p class="section__eyebrow">Error {status}</p>
    <h1 class="section__title" style="font-size: var(--t-h1)">{title}</h1>
    <p class="hero__lede" style="margin-top: 1.25rem">{detail}</p>
    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem">
      <a class="btn btn--primary" href="/">Home</a>
      <a class="btn btn--ghost" href="/episodes">Episodes</a>
      <a class="btn btn--ghost" href="/stories">Stories</a>
    </div>
  </div>
</section>
