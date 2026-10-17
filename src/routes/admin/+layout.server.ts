import type { LayoutServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getSettings } from '$lib/server/content/settings';
import { getSyncState } from '$lib/server/youtube/sync';
import { adminExists } from '$lib/server/auth/admin-repository';

/** Shared data for every admin screen. Never cached, never public. */
export const load: LayoutServerLoad = async ({ locals }) => {
  getDb();
  return {
    site: getSettings(),
    sync: getSyncState(),
    initialised: adminExists(),
    // Every admin form posts this token. It lives in the layout loader so no
    // screen has to remember to expose it, and a missing token fails the
    // action rather than silently skipping the check.
    csrfToken: locals.csrfToken
  };
};
