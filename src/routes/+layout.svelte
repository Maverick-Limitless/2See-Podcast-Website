<script lang="ts">
  import '../lib/styles/app.css';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { page } from '$app/state';
  import { observeReveals } from '$lib/shared/reveal';

  let { data, children } = $props();

  const active = $derived.by(() => {
    const path = page.url.pathname;
    if (path.startsWith('/episodes')) return 'episodes' as const;
    if (path.startsWith('/stories')) return 'stories' as const;
    if (path.startsWith('/about')) return 'about' as const;
    return '' as const;
  });

  // Reading page.url.pathname here makes the effect re-run after every
  // client-side navigation, so newly rendered content is revealed rather than
  // left sitting at opacity 0.
  $effect(() => {
    if (page.url.pathname) observeReveals();
  });
</script>

<svelte:head>
  <link rel="preload" href="/fonts/archivo-latin-1.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
  <link rel="preload" href="/fonts/newsreader-latin-3.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

<div class="shell">
  <Header site={data.site} {active} />

  <main id="main">
    {@render children()}
  </main>

  <Footer site={data.site} year={data.navigationYear} />
</div>
