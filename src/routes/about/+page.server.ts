import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getSettings } from '$lib/server/content/settings';
import { config } from '$lib/server/config';
import { publicPageCache } from '$lib/server/http/cache';

export const load: PageServerLoad = async ({ setHeaders }) => {
  getDb();
  setHeaders(publicPageCache(600));
  return { site: getSettings(), origin: config.publicOrigin };
};
