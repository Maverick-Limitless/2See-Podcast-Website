import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  createEpisode,
  deleteEpisode,
  listEpisodes,
  episodeCategories,
  setEpisodeState,
  updateEpisode
} from '$lib/server/content/episodes';
import { parseYouTubeUrl, YouTubeUrlError } from '$lib/server/youtube/url';
import {
  optionalText,
  requireDate,
  requireOptionalInt,
  requireState,
  requireText,
  requireUrl,
  ValidationFailure
} from '$lib/server/content/validate';
import { privateCache } from '$lib/server/http/cache';
import { config } from '$lib/server/config';
import { getSyncState } from '$lib/server/youtube/sync';

/** Episode management: manual entry, synchronisation, publish/unpublish, delete. */
export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
  setHeaders(privateCache());
  getDb();
  const query = url.searchParams.get('q') ?? '';
  const state = (url.searchParams.get('state') ?? 'all') as 'all' | 'draft' | 'published';
  const validState: 'all' | 'draft' | 'published' = ['all', 'draft', 'published'].includes(state)
    ? state
    : 'all';

  return {
    episodes: listEpisodes({ query, state: validState, pageSize: 60, page: 1 }),
    filters: { query, state: validState },
    categories: episodeCategories(),
    sync: getSyncState(),
    youtubeConfigured:
      config.youtubeApiKey !== '' || config.youtubeChannelId !== '',
    csrfToken: locals.csrfToken
  };
};

function verifyCsrf(presented: string, expected: string): boolean {
  if (presented === '' || expected === '') return false;
  return Buffer.from(presented).equals(Buffer.from(expected));
}

type EpisodeInput = Parameters<typeof createEpisode>[0];

function readEpisodeForm(form: FormData, youtubeId: string): EpisodeInput {
  const title = requireText(form.get('title'), 'Title', { maxLength: 300 });
  return {
    youtubeId,
    title,
    originalTitle: optionalText(form.get('originalTitle'), 'Original title', { maxLength: 300 }),
    summary: optionalText(form.get('summary'), 'Summary', { maxLength: 400 }),
    description: optionalText(form.get('description'), 'Description', { maxLength: 8000 }),
    guests: optionalText(form.get('guests'), 'Guests', { maxLength: 400 }),
    hostNames: optionalText(form.get('hostNames'), 'Hosts', { maxLength: 400 }),
    category: optionalText(form.get('category'), 'Category', { maxLength: 80 }),
    tags: optionalText(form.get('tags'), 'Tags', { maxLength: 400 }),
    thumbnail: requireUrl(form.get('thumbnail') ?? '', 'Thumbnail'),
    durationSeconds: requireOptionalInt(form.get('durationSeconds'), 'Duration'),
    publishedAt: requireDate(form.get('publishedAt'), 'Publication date', false)!,
    episodeNumber: requireOptionalInt(form.get('episodeNumber'), 'Episode number', 9999),
    featured: form.get('featured') === 'on',
    metaTitle: optionalText(form.get('metaTitle'), 'Meta title', { maxLength: 200 }),
    metaDescription: optionalText(form.get('metaDescription'), 'Meta description', { maxLength: 500 }),
    language: (form.get('language') === 'en' ? 'en' : 'fa') as 'fa' | 'en',
    format: (['episode', 'brief', 'short'].includes(String(form.get('format')))
      ? String(form.get('format'))
      : 'episode') as 'episode' | 'brief' | 'short'
  };
}

export const actions: Actions = {
  /** Method A — add one YouTube video by hand. */
  add: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired. Reload the page and try again.' };
    }

    let youtubeId: string;
    try {
      youtubeId = parseYouTubeUrl(form.get('youtubeUrl')?.toString() ?? '').videoId;
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof YouTubeUrlError ? error.message : 'That YouTube URL could not be read.'
      };
    }

    try {
      const result = createEpisode(readEpisodeForm(form, youtubeId), 'draft');
      if (!result.created) {
        return {
          ok: false,
          error: `That video is already in the archive as "${result.duplicateOf?.title}".`
        };
      }
      return { ok: true, message: 'Added as a draft. Review the metadata, then publish.' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ValidationFailure ? error.message : (error as Error).message
      };
    }
  },

  edit: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired. Reload the page and try again.' };
    }
    try {
      updateEpisode(
        Number(form.get('id')),
        readEpisodeForm(form, form.get('youtubeId')?.toString() ?? ''),
        requireState(form.get('state'), 'Status')
      );
      return { ok: true, message: 'Saved.' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ValidationFailure ? error.message : (error as Error).message
      };
    }
  },

  publish: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired.' };
    }
    return setEpisodeState(Number(form.get('id')), 'published')
      ? { ok: true, message: 'Published.' }
      : { ok: false, error: 'That episode could not be found.' };
  },

  unpublish: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired.' };
    }
    return setEpisodeState(Number(form.get('id')), 'draft')
      ? { ok: true, message: 'Unpublished. The public page no longer serves it.' }
      : { ok: false, error: 'That episode could not be found.' };
  },

  remove: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired.' };
    }
    if (form.get('confirm') !== 'yes') {
      return { ok: false, error: 'Confirm the deletion before removing an episode.' };
    }
    return deleteEpisode(Number(form.get('id')))
      ? { ok: true, message: 'Deleted.' }
      : { ok: false, error: 'That episode could not be found.' };
  },

  /** Method B — pull from YouTube. */
  sync: async ({ locals }) => {
    const { syncEpisodes } = await import('$lib/server/youtube/sync');
    if (locals.csrfToken === '') return { ok: false, error: 'Not signed in securely.' };
    const report = await syncEpisodes({ mode: 'incremental' });
    return { ok: report.status !== 'error', message: report.message };
  }
};
