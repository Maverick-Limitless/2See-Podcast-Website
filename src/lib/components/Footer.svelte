<script lang="ts">
  import type { SiteSettings } from '$lib/shared/types';

  interface Props {
    site: SiteSettings;
    year: number;
  }

  const { site, year }: Props = $props();
</script>

<footer class="footer">
  <div class="footer__inner">
    <div>
      <p class="footer__credit">
        <strong>{site.siteTitle}</strong> — {site.tagline}
      </p>
      <p class="footer__note">
        This is an independent website concept and is not affiliated with or endorsed by
        {site.siteTitle} unless expressly authorised. {site.footerNote}
      </p>
      <p class="footer__note">Design by Maverick Limitless.</p>
    </div>

    <div class="footer__cols">
      <div>
        <h2 class="footer__label">Browse</h2>
        <ul class="footer__list">
          <li><a href="/episodes">Episodes</a></li>
          <li><a href="/stories">Stories</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </div>

      {#if site.socialLinks.length > 0}
        <div>
          <h2 class="footer__label">Listen</h2>
          <ul class="footer__list">
            {#each site.socialLinks as link (link.url)}
              <li>
                <a href={link.url} rel="noopener noreferrer" target="_blank">{link.label}</a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>

  <div class="footer__bottom">
    <span>© {year} {site.siteTitle} concept site. All episode content remains the property of its owners.</span>
    <span>Design by Maverick Limitless</span>
  </div>
</footer>
