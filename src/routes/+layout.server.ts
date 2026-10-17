import { getDb } from '$lib/server/db';
import { getSettings } from '$lib/server/content/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
  getDb();
  const site = getSettings();
  return { site, navigationYear: new Date().getFullYear() };
};
