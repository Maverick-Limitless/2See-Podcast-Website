import { getDb } from '$lib/server/db';
import { getSettings } from '$lib/server/content/settings';
import { config } from '$lib/server/config';

/**
 * XML sitemap.
 *
 * Only published, publicly reachable pages are listed. Admin and login routes
 * are never included, and no canonical URL is invented when the deployment
 * origin is unknown.
 */
export const GET = async () => {
  getDb();
  const site = getSettings();
  const db = getDb();

  type Row = { slug: string; updated_at: string };
  const episodes = db
    .prepare(`SELECT slug, updated_at FROM episodes WHERE state = 'published' ORDER BY published_at DESC`)
    .all() as unknown as Row[];
  const stories = db
    .prepare(`SELECT slug, updated_at FROM stories WHERE state = 'published' ORDER BY published_at DESC`)
    .all() as unknown as Row[];

  const origin = config.publicOrigin;
  if (origin === '') {
    return new Response(
      '<!-- Set PUBLIC_ORIGIN to emit absolute URLs in the sitemap. -->\n',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${origin}/` },
    { loc: `${origin}/episodes` },
    { loc: `${origin}/stories` },
    { loc: `${origin}/about` }
  ];
  for (const episode of episodes) {
    urls.push({ loc: `${origin}/episodes/${episode.slug}`, lastmod: episode.updated_at });
  }
  for (const story of stories) {
    urls.push({ loc: `${origin}/stories/${story.slug}`, lastmod: story.updated_at });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${entry.loc}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate'
    }
  });
};
