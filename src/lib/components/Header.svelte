<script lang="ts">
  import type { SiteSettings } from '$lib/shared/types';

  interface Props {
    site: SiteSettings;
    /** Section the visitor is in, for the nav indicator. */
    active?: 'home' | 'episodes' | 'stories' | 'about' | '';
    loggedIn?: boolean;
  }

  const { site, active = '' }: Props = $props();

  const links = [
    { href: '/episodes', label: 'Episodes', key: 'episodes' },
    { href: '/stories', label: 'Stories', key: 'stories' },
    { href: '/about', label: 'About', key: 'about' }
  ] as const;
</script>

<header class="masthead">
  <div class="masthead__inner">
    <a class="wordmark" href="/" aria-label={`${site.siteTitle} — home`}>
      <span class="wordmark__numeral" aria-hidden="true">2</span>
      <!-- The numeral completes the name rather than repeating it: the mark
           reads "2See Podcast" as one lockup, not "2 2See Podcast". -->
      <span class="wordmark__text">{site.siteTitle.replace(/^2/, '')}</span>
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
    </div>
  </div>
</header>
