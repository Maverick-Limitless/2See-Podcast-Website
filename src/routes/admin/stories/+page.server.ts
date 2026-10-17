import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  createStory,
  deleteStory,
  listStories,
  setStoryState,
  storyCategories,
  updateStory,
  getStoryById
} from '$lib/server/content/stories';
import { renderMarkdown } from '$lib/server/content/markdown';
import {
  optionalText,
  requireState,
  requireText,
  ValidationFailure
} from '$lib/server/content/validate';
import { privateCache } from '$lib/server/http/cache';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
  setHeaders(privateCache());
  getDb();
  const query = url.searchParams.get('q') ?? '';
  const state = (url.searchParams.get('state') ?? 'all') as 'all' | 'draft' | 'published';
  const validState: 'all' | 'draft' | 'published' = ['all', 'draft', 'published'].includes(state)
    ? state
    : 'all';

  return {
    stories: listStories({ query, state: validState, pageSize: 60, page: 1 }),
    filters: { query, state: validState },
    categories: storyCategories(),
    csrfToken: locals.csrfToken
  };
};

function verifyCsrf(presented: string, expected: string): boolean {
  if (presented === '' || expected === '') return false;
  return Buffer.from(presented).equals(Buffer.from(expected));
}

type StoryInput = Parameters<typeof createStory>[0];

function readStoryForm(form: FormData): StoryInput {
  const bodyMarkdown = requireText(form.get('bodyMarkdown'), 'Body', { maxLength: 100000 });
  const title = requireText(form.get('title'), 'Title', { maxLength: 300 });
  return {
    title,
    subtitle: optionalText(form.get('subtitle'), 'Subtitle', { maxLength: 400 }),
    summary: optionalText(form.get('summary'), 'Summary', { maxLength: 400 }),
    bodyMarkdown,
    coverImage: optionalText(form.get('coverImage'), 'Cover image', { maxLength: 500 }),
    coverAlt: optionalText(form.get('coverAlt'), 'Cover alt text', { maxLength: 300 }),
    coverCaption: optionalText(form.get('coverCaption'), 'Cover caption', { maxLength: 300 }),
    category: optionalText(form.get('category'), 'Category', { maxLength: 80 }),
    tags: optionalText(form.get('tags'), 'Tags', { maxLength: 400 }),
    author: optionalText(form.get('author'), 'Author', { maxLength: 120 }),
    featured: form.get('featured') === 'on',
    metaTitle: optionalText(form.get('metaTitle'), 'Meta title', { maxLength: 200 }),
    metaDescription: optionalText(form.get('metaDescription'), 'Meta description', { maxLength: 500 })
  };
}

export const actions: Actions = {
  /** Renders Markdown and returns the sanitised HTML. Server-side only. */
  preview: async ({ request }) => {
    const form = await request.formData();
    const markdown = form.get('bodyMarkdown')?.toString() ?? '';
    return { html: renderMarkdown(markdown).html };
  },

  add: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired. Reload the page and try again.' };
    }
    const state = requireState(form.get('state'), 'Status');
    try {
      const result = createStory(readStoryForm(form), state);
      return { ok: true, message: `Saved as a ${state}.`, slug: result.slug };
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
      updateStory(
        Number(form.get('id')),
        readStoryForm(form),
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
    return setStoryState(Number(form.get('id')), 'published')
      ? { ok: true, message: 'Published.' }
      : { ok: false, error: 'That story could not be found.' };
  },

  unpublish: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired.' };
    }
    return setStoryState(Number(form.get('id')), 'draft')
      ? { ok: true, message: 'Unpublished.' }
      : { ok: false, error: 'That story could not be found.' };
  },

  remove: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired.' };
    }
    if (form.get('confirm') !== 'yes') {
      return { ok: false, error: 'Confirm the deletion before removing a story.' };
    }
    return deleteStory(Number(form.get('id')))
      ? { ok: true, message: 'Deleted.' }
      : { ok: false, error: 'That story could not be found.' };
  }
};
