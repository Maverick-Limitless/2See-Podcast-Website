import { config } from '$lib/server/config';

/** robots.txt. The publisher panel, login and setup are excluded from crawling. */
export const GET = async () => {
  const origin = config.publicOrigin;
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /login',
    'Disallow: /setup',
    'Disallow: /logout',
    '',
    '# Published content only. Draft and archived content is not linked.'
  ];

  if (origin !== '') {
    lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, must-revalidate'
    }
  });
};
