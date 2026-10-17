import { config } from '$lib/server/config';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { listEpisodes } from '$lib/server/content/episodes';
import { listStories } from '$lib/server/content/stories';
import { getSettings } from '$lib/server/content/settings';
import { getSyncState } from '$lib/server/youtube/sync';
import { publicPageCache } from '$lib/server/http/cache';

/**
 * Homepage data.
 *
 * The composition is decided here, not in the browser: which episode is the
 * hero, how many items each section carries, and how the discovery grid is
 * ordered. Everything is server-rendered so the reading surface works with
 * JavaScript disabled.
 */
export const load: PageServerLoad = async ({ setHeaders }) => {
  // Public, content-bearing page: shared caches may hold it, but the revision
  // token in the ETag changes the moment any content changes.
  setHeaders(publicPageCache(120));

  const db = getDb();

  const episodes = listEpisodes({ pageSize: 6, format: 'all' });
  const stories = listStories({ pageSize: 4 });
  const site = getSettings();

  // The hero is the newest long-form episode, which is the publication's
  // primary format. The weekly brief leads only when nothing longer exists.
  const [lead, ...rest] = episodes.items;

  // A short, verified framing for the introduction — two hosts, two registers.
  const counts = {
    episodesTotal: db.prepare(`SELECT COUNT(*) AS n FROM episodes WHERE state = 'published'`).get() as { n: number },
    episodesLong: db
      .prepare(`SELECT COUNT(*) AS n FROM episodes WHERE state = 'published' AND format != 'short'`)
      .get() as { n: number },
    publishedSince: db
      .prepare(
        `SELECT MIN(published_at) AS first_at FROM episodes WHERE state = 'published'`
      )
      .get() as { first_at: string | null }
  };

  return {
    origin: config.publicOrigin,
    lead,
    rest,
    episodes,
    stories,
    site,
    sync: getSyncState(),
    counts
  };
};
