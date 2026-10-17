<script lang="ts">
  import type { SiteSettings } from '$lib/shared/types';

  interface Props {
    site: SiteSettings;
    /** Section the visitor is in, for the nav indicator. */
    active?: 'home' | 'episodes' | 'stories' | 'about' | '';
    loggedIn?: boolean;
  }

  const { site, active = '', loggedIn = false }: Props = $props();

  const links = [
    { href: '/episodes', label: 'Episodes', key: 'episodes' },
    { href: '/stories', label: 'Stories', key: 'stories' },
    { href: '/about', label: 'About', key: 'about' }
  ] as const;
</script>

<header class="masthead">
  <div class="masthead__inner">
    <a class="wordmark" href="/" aria-label={`${site.siteTitle} — home`}>
      <span class="wordmark__numeral">2</span>
      <span class="wordmark__text">{site.siteTitle}</span>
    </a>

    <nav class="nav" aria-label="Main">
      {#each links as link (link.href)}
        <a class="nav__link" href={link.href} aria-current={active === link.key ? 'page' : undefined}>
          {link.label}
        </a>
      {/each}
    </nav>

    <div class="masthead__actions">
      <a
        class="nav__link nav__link--accent"
        href={site.channelUrl}
        rel="noopener noreferrer"
        target="_blank"
      >YouTube</a>
      <a class="nav__link" href="/admin">{loggedIn ? 'Panel' : 'Publisher'}</a>
    </div>
  </div>
</header>
