import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listEpisodes, episodeCategories } from '$lib/server/content/episodes';
import { getSettings } from '$lib/server/content/settings';
import { config } from '$lib/server/config';
import { publicPageCache } from '$lib/server/http/cache';

/**
 * Episodes archive.
 *
 * Pagination is server-side: the initial HTML carries one page, and "load more"
 * requests the next page from the server, so the full archive is never in the
 * first bundle.
 */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  getDb();
  const query = url.searchParams.get('q') ?? '';
  const category = url.searchParams.get('category') ?? '';
  const format = (url.searchParams.get('format') ?? 'all') as 'episode' | 'brief' | 'short' | 'all';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const validFormat = ['episode', 'brief', 'short', 'all'].includes(format) ? format : 'all';

  setHeaders(publicPageCache(120));

  return {
    origin: config.publicOrigin,
    episodes: listEpisodes({
      query,
      category,
      format: validFormat,
      page,
      pageSize: 12
    }),
    filters: { query, category, format: validFormat },
    categories: episodeCategories(),
    site: getSettings()
  };
};
