import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getStoryBySlug } from '$lib/server/content/stories';
import { getSettings } from '$lib/server/content/settings';
import { publicPageCache } from '$lib/server/http/cache';
import { config } from '$lib/server/config';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  getDb();
  const story = getStoryBySlug(params.slug);

  if (!story || story.state !== 'published') {
    throw error(404, 'That story is not available.');
  }

  setHeaders(publicPageCache(120));

  return {
    story,
    site: getSettings(),
    origin: config.publicOrigin
  };
};
