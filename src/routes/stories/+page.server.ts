import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listStories, storyCategories } from '$lib/server/content/stories';
import { getSettings } from '$lib/server/content/settings';
import { config } from '$lib/server/config';
import { publicPageCache } from '$lib/server/http/cache';

/** Stories archive: editorial articles, long-form and searchable. */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  getDb();
  const query = url.searchParams.get('q') ?? '';
  const category = url.searchParams.get('category') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  setHeaders(publicPageCache(120));

  return {
    origin: config.publicOrigin,
    stories: listStories({ query, category, page, pageSize: 12 }),
    filters: { query, category },
    categories: storyCategories(),
    site: getSettings()
  };
};
