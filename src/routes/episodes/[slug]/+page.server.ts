import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getEpisodeBySlug, relatedEpisodes } from '$lib/server/content/episodes';
import { getSettings } from '$lib/server/content/settings';
import { publicPageCache } from '$lib/server/http/cache';
import { config } from '$lib/server/config';

/** Loads one episode by slug. A draft returns 404 for visitors. */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
  getDb();
  const episode = getEpisodeBySlug(params.slug);

  if (!episode || episode.state !== 'published') {
    throw error(404, 'That episode is not available.');
  }

  setHeaders(publicPageCache(120));
  const origin = config.publicOrigin;

  return {
    episode,
    related: relatedEpisodes(episode, 3),
    site: getSettings(),
    origin,
    watchUrl: `https://www.youtube.com/watch?v=${episode.youtubeId}`
  };
};
