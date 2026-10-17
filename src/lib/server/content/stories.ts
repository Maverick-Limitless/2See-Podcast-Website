import { getDb } from '../db';
import { recordRevision } from '../http/cache';
import { countWords, readingMinutes, renderMarkdown } from './markdown';
import { dedupeSlug, joinList, slugify, splitList } from './text';
import type { PublicationState, Story, StorySummary } from '../../shared/types';

/**
 * Story repository.
 *
 * The rendered HTML is produced once at write time and stored alongside the
 * Markdown, so a read path never renders anything — it only serves what was
 * validated and stored. That is the boundary that keeps unsanitised HTML out
 * of a public page: input is rendered by renderMarkdown, never on read.
 */

interface StoryRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  body_markdown: string;
  body_html: string;
  cover_image_url: string;
  cover_alt: string;
  cover_caption: string;
  category: string;
  tags: string;
  author: string;
  state: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  featured: number;
  word_count: number;
  reading_minutes: number;
  meta_title: string;
  meta_description: string;
}

const COLUMNS = `id, slug, title, subtitle, summary, body_markdown, body_html,
  cover_image_url, cover_alt, cover_caption, category, tags, author, state,
  published_at, created_at, updated_at, featured, word_count, reading_minutes,
  meta_title, meta_description`;

function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    bodyHtml: row.body_html,
    coverImage: row.cover_image_url,
    coverAlt: row.cover_alt,
    coverCaption: row.cover_caption,
    category: row.category,
    tags: splitList(row.tags),
    author: row.author,
    state: row.state === 'published' ? 'published' : 'draft',
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readingMinutes: row.reading_minutes,
    wordCount: row.word_count,
    featured: row.featured === 1,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description
  };
}

/** Deterministic composition weight for the discovery grid. */
function spanClassFor(index: number, featured: boolean): string {
  if (featured) return 'mosaic__cell mosaic__cell--feature';
  // A 5-column rhythm where every fourth item is deliberately wider, which
  // breaks the row-of-identical-cards effect without randomising layout
  // (randomness causes layout shift and makes the archive feel unordered).
  const wide = index % 4 === 0;
  return wide ? 'mosaic__cell mosaic__cell--wide' : 'mosaic__cell';
}

export interface StoryFilters {
  query?: string;
  category?: string;
  state?: PublicationState | 'all';
  page?: number;
  pageSize?: number;
}

export interface StoryListResult {
  items: StorySummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: string;
  categories: string[];
}

export function listStories(filters: StoryFilters): StoryListResult {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const query = (filters.query ?? '').trim();
  const state = filters.state ?? 'published';
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (state !== 'all') {
    where.push('state = ?');
    params.push(state);
  }
  if (filters.category && filters.category !== '') {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (query !== '') {
    where.push('(title LIKE ? OR summary LIKE ? OR tags LIKE ? OR subtitle LIKE ?)');
    const like = `%${query}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM stories ${clause}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM stories ${clause}
        ORDER BY featured DESC, published_at DESC, created_at DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as unknown as StoryRow[];

  const categories = (
    db
      .prepare(
        `SELECT category AS category, COUNT(*) AS n FROM stories
          WHERE state = 'published' AND category != ''
          GROUP BY category ORDER BY n DESC, category ASC`
      )
      .all() as { category: string }[]
  ).map((row) => row.category);

  const items = rows.map((row, index) => {
    const story = toStory(row);
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      subtitle: story.subtitle,
      summary: story.summary,
      coverImage: story.coverImage,
      coverAlt: story.coverAlt,
      category: story.category,
      author: story.author,
      state: story.state,
      publishedAt: story.publishedAt,
      readingMinutes: story.readingMinutes,
      featured: story.featured,
      spanClass: spanClassFor(index, story.featured)
    } satisfies StorySummary;
  });

  return {
    items,
    total: countRow.total,
    page,
    pageSize,
    hasMore: offset + rows.length < countRow.total,
    query,
    categories
  };
}

export function getStoryBySlug(slug: string): Story | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM stories WHERE slug = ?`).get(slug) as
    | StoryRow
    | undefined;
  return row ? toStory(row) : null;
}

export function getStoryById(id: number): Story | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM stories WHERE id = ?`).get(id) as
    | StoryRow
    | undefined;
  return row ? toStory(row) : null;
}

export function featuredStory(): Story | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ${COLUMNS} FROM stories
        WHERE state = 'published'
        ORDER BY featured DESC, published_at DESC LIMIT 1`
    )
    .get() as unknown as StoryRow | undefined;
  return row ? toStory(row) : null;
}

export interface StoryInput {
  title: string;
  subtitle: string;
  summary: string;
  bodyMarkdown: string;
  coverImage: string;
  coverAlt: string;
  coverCaption: string;
  category: string;
  tags: string;
  author: string;
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
}

function buildSlug(db: ReturnType<typeof getDb>, title: string, excludeId?: number): string {
  const base = slugify(title, 'story');
  const taken = new Set<string>(
    (
      db
        .prepare(
          excludeId === undefined
            ? 'SELECT slug FROM stories'
            : 'SELECT slug FROM stories WHERE id != ?'
        )
        .all(...(excludeId === undefined ? [] : [excludeId])) as { slug: string }[]
    ).map((row) => row.slug)
  );
  return dedupeSlug(base, taken);
}

function nextPublishedAt(state: PublicationState, current: string | null): string | null {
  if (state === 'published') return current ?? new Date().toISOString().replace('T', ' ').replace('Z', '');
  return null;
}

export interface PersistResult {
  id: number;
  slug: string;
  created: boolean;
}

export function createStory(input: StoryInput, state: PublicationState): PersistResult {
  const db = getDb();
  const rendered = renderMarkdown(input.bodyMarkdown);
  const slug = buildSlug(db, input.title);
  const words = countWords(input.bodyMarkdown);

  db.prepare(
    `INSERT INTO stories (slug, title, subtitle, summary, body_markdown, body_html,
       cover_image_url, cover_alt, cover_caption, category, tags, author, state,
       published_at, featured, word_count, reading_minutes, meta_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    slug,
    input.title,
    input.subtitle,
    input.summary,
    input.bodyMarkdown,
    rendered.html,
    input.coverImage,
    input.coverAlt,
    input.coverCaption,
    input.category,
    joinList(splitList(input.tags)),
    input.author,
    state,
    nextPublishedAt(state, null),
    input.featured ? 1 : 0,
    words,
    readingMinutes(input.bodyMarkdown),
    input.metaTitle,
    input.metaDescription
  );

  const row = db.prepare('SELECT id FROM stories WHERE slug = ?').get(slug) as { id: number };
  recordRevision('story', row.id, state === 'published' ? 'published' : 'drafted');
  return { id: row.id, slug, created: true };
}

export function updateStory(id: number, input: StoryInput, state: PublicationState): PersistResult {
  const db = getDb();
  const existing = getStoryById(id);
  if (!existing) throw new Error('Story not found.');
  const rendered = renderMarkdown(input.bodyMarkdown);
  const words = countWords(input.bodyMarkdown);

  db.prepare(
    `UPDATE stories SET title = ?, subtitle = ?, summary = ?, body_markdown = ?, body_html = ?,
       cover_image_url = ?, cover_alt = ?, cover_caption = ?, category = ?, tags = ?, author = ?,
       state = ?, published_at = ?, featured = ?, word_count = ?, reading_minutes = ?,
       meta_title = ?, meta_description = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(
    input.title,
    input.subtitle,
    input.summary,
    input.bodyMarkdown,
    rendered.html,
    input.coverImage,
    input.coverAlt,
    input.coverCaption,
    input.category,
    joinList(splitList(input.tags)),
    input.author,
    state,
    nextPublishedAt(state, existing.publishedAt),
    input.featured ? 1 : 0,
    words,
    readingMinutes(input.bodyMarkdown),
    input.metaTitle,
    input.metaDescription,
    id
  );
  recordRevision('story', id, 'updated');
  return { id, slug: existing.slug, created: false };
}

export function setStoryState(id: number, state: PublicationState): boolean {
  const db = getDb();
  const existing = getStoryById(id);
  if (!existing) return false;
  db.prepare(
    `UPDATE stories SET state = ?, published_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`
  ).run(state, nextPublishedAt(state, existing.publishedAt), id);
  recordRevision('story', id, state === 'published' ? 'published' : 'unpublished');
  return true;
}

export function deleteStory(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM stories WHERE id = ?').run(id);
  const affected = Number(result.changes) > 0;
  if (affected) recordRevision('story', id, 'deleted');
  return affected;
}

export function storyCategories(): string[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT category AS category, COUNT(*) AS n FROM stories
          WHERE category != '' GROUP BY category ORDER BY n DESC, category ASC`
      )
      .all() as { category: string }[]
  ).map((row) => row.category);
}
