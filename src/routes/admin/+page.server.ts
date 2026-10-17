import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { countEpisodesByState } from '$lib/server/content/episodes';
import { privateCache } from '$lib/server/http/cache';

/**
 * Overview. Operational counts and the last synchronisation status only — no
 * analytics, no decorative metrics.
 */
export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders(privateCache());
  const db = getDb();

  const publishedStories = db
    .prepare(`SELECT COUNT(*) AS n FROM stories WHERE state = 'published'`)
    .get() as unknown as { n: number };
  const draftStories = db
    .prepare(`SELECT COUNT(*) AS n FROM stories WHERE state = 'draft'`)
    .get() as unknown as { n: number };

  return {
    publishedStories: publishedStories.n,
    draftStories: draftStories.n,
    publishedEpisodes: countEpisodesByState('published'),
    draftEpisodes: countEpisodesByState('draft')
  };
};
