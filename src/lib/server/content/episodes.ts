import { getDb } from '../db';
import { recordRevision } from '../http/cache';
import { dedupeSlug, joinList, slugify, splitList } from './text';
import { hasPersian } from './text';
import type { Episode, EpisodeSummary, PublicationState } from '../../shared/types';

/**
 * Episode repository.
 *
 * The YouTube video ID is the identity of an episode. It is UNIQUE in the
 * database, so duplicate publication is impossible regardless of which code
 * path tries it — the admin form, the synchroniser, or a script. Synchronisation
 * writes are UPSERTs keyed on that column, which is what makes a re-run
 * idempotent.
 */

interface EpisodeRow {
  id: number;
  youtube_id: string;
  slug: string;
  title: string;
  original_title: string;
  summary: string;
  description: string;
  guests: string;
  host_names: string;
  series: string;
  episode_number: number | null;
  category: string;
  tags: string;
  thumbnail_url: string;
  duration_seconds: number | null;
  published_at: string;
  created_at: string;
  updated_at: string;
  state: string;
  language: string;
  format: string;
  featured: number;
  meta_title: string;
  meta_description: string;
  sync_source: string | null;
  synced_at: string | null;
  manually_edited: number;
}

const COLUMNS = `id, youtube_id, slug, title, original_title, summary, description, guests,
  host_names, series, episode_number, category, tags, thumbnail_url, duration_seconds,
  published_at, created_at, updated_at, state, language, format, featured, meta_title,
  meta_description, sync_source, synced_at, manually_edited`;

function toEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    slug: row.slug,
    youtubeId: row.youtube_id,
    title: row.title,
    originalTitle: row.original_title,
    summary: row.summary,
    description: row.description,
    guests: splitList(row.guests),
    hostNames: splitList(row.host_names),
    series: row.series,
    episodeNumber: row.episode_number,
    category: row.category,
    tags: splitList(row.tags),
    thumbnail: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    state: row.state === 'published' ? 'published' : 'draft',
    language: row.language === 'en' ? 'en' : 'fa',
    format: row.format === 'brief' || row.format === 'short' ? row.format : 'episode',
    featured: row.featured === 1,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    syncedAt: row.synced_at,
    syncSource: (row.sync_source as Episode['syncSource']) ?? null
  };
}

/**
 * Composition weight for the discovery grid.
 *
 * Episodes are longer media than stories, so a wider share of them are
 * image-led two-column tiles. Every third item is a text-only tile, which is
 * what keeps the masonry from reading as a wall of thumbnails.
 */
/**
 * Composition weight for the discovery grid.
 *
 * Long-form material carries the visual weight and takes two columns. Shorts
 * are deliberately single-column: a vertical clip cropped to two columns would
 * dominate the page, and the archive is mostly long-form anyway. Every third
 * long-form item is text-led, which is what keeps the masonry from reading as a
 * uniform row of thumbnails.
 */
function episodeSpanClass(index: number, featured: boolean, isShort: boolean): string {
  if (featured) return 'mosaic__cell mosaic__cell--feature';
  if (isShort) return 'mosaic__cell';
  return index % 3 === 2 ? 'mosaic__cell' : 'mosaic__cell mosaic__cell--wide';
}

function toSummary(row: EpisodeRow, index: number): EpisodeSummary {
  const episode = toEpisode(row);
  return {
    id: episode.id,
    slug: episode.slug,
    youtubeId: episode.youtubeId,
    title: episode.title,
    originalTitle: episode.originalTitle,
    summary: episode.summary,
    guests: episode.guests,
    series: episode.series,
    episodeNumber: episode.episodeNumber,
    category: episode.category,
    thumbnail: episode.thumbnail,
    durationSeconds: episode.durationSeconds,
    publishedAt: episode.publishedAt,
    state: episode.state,
    language: episode.language,
    format: episode.format,
    featured: episode.featured,
    spanClass: episodeSpanClass(index, episode.featured, episode.format === 'short')
  };
}

export interface EpisodeFilters {
  query?: string;
  category?: string;
  format?: 'episode' | 'brief' | 'short' | 'all';
  state?: PublicationState | 'all';
  page?: number;
  pageSize?: number;
}

export interface EpisodeListResult {
  items: EpisodeSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: string;
  categories: string[];
}

export function listEpisodes(filters: EpisodeFilters): EpisodeListResult {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const query = (filters.query ?? '').trim();
  const state = filters.state ?? 'published';
  const format = filters.format ?? 'all';
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (state !== 'all') {
    where.push('state = ?');
    params.push(state);
  }
  if (format !== 'all') {
    where.push('format = ?');
    params.push(format);
  }
  if (filters.category && filters.category !== '') {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (query !== '') {
    where.push('(title LIKE ? OR original_title LIKE ? OR summary LIKE ? OR guests LIKE ? OR tags LIKE ?)');
    const like = `%${query}%`;
    params.push(like, like, like, like, like);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM episodes ${clause}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM episodes ${clause}
        ORDER BY featured DESC, published_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as unknown as EpisodeRow[];

  const categories = (
    db
      .prepare(
        `SELECT category AS category, COUNT(*) AS n FROM episodes
          WHERE state = 'published' AND category != ''
          GROUP BY category ORDER BY n DESC, category ASC`
      )
      .all() as { category: string }[]
  ).map((row) => row.category);

  return {
    items: rows.map((row, index) => toSummary(row, index)),
    total: countRow.total,
    page,
    pageSize,
    hasMore: offset + rows.length < countRow.total,
    query,
    categories
  };
}

export function getEpisodeBySlug(slug: string): Episode | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM episodes WHERE slug = ?`).get(slug) as
    | EpisodeRow
    | undefined;
  return row ? toEpisode(row) : null;
}

export function getEpisodeByVideoId(videoId: string): Episode | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM episodes WHERE youtube_id = ?`)
    .get(videoId) as unknown as EpisodeRow | undefined;
  return row ? toEpisode(row) : null;
}

export function getEpisodeById(id: number): Episode | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${COLUMNS} FROM episodes WHERE id = ?`).get(id) as
    | EpisodeRow
    | undefined;
  return row ? toEpisode(row) : null;
}

export function featuredEpisode(): Episode | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT ${COLUMNS} FROM episodes
        WHERE state = 'published' AND format != 'short'
        ORDER BY featured DESC, published_at DESC LIMIT 1`
    )
    .get() as unknown as EpisodeRow | undefined;
  return row ? toEpisode(row) : null;
}

export function recentEpisodes(limit = 6): Episode[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT ${COLUMNS} FROM episodes
          WHERE state = 'published' AND format != 'short'
          ORDER BY published_at DESC LIMIT ?`
      )
      .all(limit) as unknown as EpisodeRow[]
  ).map(toEpisode);
}

/** Related episodes share a category, else fall back to the newest others. */
export function relatedEpisodes(episode: Episode, limit = 3): Episode[] {
  const db = getDb();
  if (episode.category !== '') {
    const same = (
      db
        .prepare(
          `SELECT ${COLUMNS} FROM episodes
            WHERE state = 'published' AND id != ? AND category = ?
            ORDER BY published_at DESC LIMIT ?`
        )
        .all(episode.id, episode.category, limit) as unknown as EpisodeRow[]
    ).map(toEpisode);
    if (same.length >= limit) return same;
  }
  return (
    db
      .prepare(
        `SELECT ${COLUMNS} FROM episodes
          WHERE state = 'published' AND id != ?
          ORDER BY featured DESC, published_at DESC LIMIT ?`
      )
      .all(episode.id, limit) as unknown as EpisodeRow[]
  ).map(toEpisode);
}

export function episodeCategories(): string[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT category AS category, COUNT(*) AS n FROM episodes
          WHERE category != '' GROUP BY category ORDER BY n DESC, category ASC`
      )
      .all() as { category: string }[]
  ).map((row) => row.category);
}

export function detectLanguage(title: string, description: string): 'fa' | 'en' {
  return hasPersian(`${title} ${description}`) ? 'fa' : 'en';
}

export function detectFormat(title: string, isShort: boolean): 'episode' | 'brief' | 'short' {
  if (isShort) return 'short';
  if (/brief/i.test(title)) return 'brief';
  return 'episode';
}

export function parseSeriesAndNumber(title: string): { series: string; number: number | null } {
  // Persian titles use Eastern Arabic numerals: "اپیزود ۴۳" = Episode 43.
  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  const toLatin = (value: string): string =>
    value.replace(/[۰-۹]/g, (digit) => String(faDigits.indexOf(digit)));
  const normalised = toLatin(title);

  const faMatch = /اپیزود\s*(\d+)/.exec(normalised);
  if (faMatch) return { series: 'Main series', number: Number(faMatch[1]) };

  const enMatch = /episode\s*(\d+)/i.exec(normalised);
  if (enMatch) return { series: 'Main series', number: Number(enMatch[1]) };

  const cwMatch = /CW\s*(\d+)/i.exec(normalised);
  if (cwMatch) return { series: '2See Brief', number: Number(cwMatch[1]) };

  return { series: '', number: null };
}

const VIDEO_ID_FORMAT = /^[A-Za-z0-9_-]{11}$/;

/**
 * Rejects a value that is not a canonical YouTube video ID. This is the
 * repository-level guard: the admin form also validates, but the constraint
 * must not depend on one caller.
 */
function assertVideoId(videoId: string): void {
  if (!VIDEO_ID_FORMAT.test(videoId)) {
    throw new Error('A valid 11-character YouTube video ID is required.');
  }
}

function buildSlug(db: ReturnType<typeof getDb>, title: string, excludeId?: number): string {
  const base = slugify(title, 'episode');
  const taken = new Set<string>(
    (
      db
        .prepare(
          excludeId === undefined
            ? 'SELECT slug FROM episodes'
            : 'SELECT slug FROM episodes WHERE id != ?'
        )
        .all(...(excludeId === undefined ? [] : [excludeId])) as { slug: string }[]
    ).map((row) => row.slug)
  );
  return dedupeSlug(base, taken);
}

export interface EpisodeInput {
  youtubeId: string;
  title: string;
  originalTitle: string;
  summary: string;
  description: string;
  guests: string;
  hostNames: string;
  category: string;
  tags: string;
  thumbnail: string;
  durationSeconds: number | null;
  publishedAt: string;
  episodeNumber: number | null;
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
  language: 'fa' | 'en';
  format: 'episode' | 'brief' | 'short';
}

export interface EpisodePersistResult {
  id: number;
  slug: string;
  created: boolean;
  duplicateOf?: Episode;
}

/**
 * The date an episode went public. Set once, on first publish, and preserved
 * across later state changes so republishing restores the original date rather
 * than resetting it to "now".
 */
function publishedAtFor(state: PublicationState, current: string | null): string {
  if (current !== null && current !== '') return current;
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function summariseFromDescription(description: string, fallbackTitle: string): string {
  const cleaned = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') return fallbackTitle;
  const cut = cleaned.slice(0, 180);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 100 ? `${cut.slice(0, lastSpace).trimEnd()}…` : `${cut.trimEnd()}…`;
}

/**
 * Inserts an episode. The UNIQUE index on youtube_id is the authoritative
 * duplicate guard; this function reports a collision instead of failing hard,
 * so the admin form can tell the publisher which existing episode matches.
 */
export function createEpisode(input: EpisodeInput, state: PublicationState): EpisodePersistResult {
  assertVideoId(input.youtubeId);
  const db = getDb();
  const existing = getEpisodeByVideoId(input.youtubeId);

  if (existing) {
    return { id: existing.id, slug: existing.slug, created: false, duplicateOf: existing };
  }

  const slug = buildSlug(db, input.title);
  const summary = input.summary !== '' ? input.summary : summariseFromDescription(input.description, input.title);
  const { series: detectedSeries } = parseSeriesAndNumber(input.title);

  db.prepare(
    `INSERT INTO episodes (youtube_id, slug, title, original_title, summary, description, guests,
       host_names, series, episode_number, category, tags, thumbnail_url, duration_seconds,
       published_at, state, language, format, featured, meta_title, meta_description,
       sync_source, manually_edited)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 1)`
  ).run(
    input.youtubeId,
    slug,
    input.title,
    input.originalTitle !== '' ? input.originalTitle : input.title,
    summary,
    input.description,
    joinList(splitList(input.guests)),
    joinList(splitList(input.hostNames)),
    detectedSeries,
    input.episodeNumber,
    input.category,
    joinList(splitList(input.tags)),
    input.thumbnail,
    input.durationSeconds,
    publishedAtFor(state, null),
    state,
    input.language,
    input.format,
    input.featured ? 1 : 0,
    input.metaTitle,
    input.metaDescription
  );

  const row = db.prepare('SELECT id FROM episodes WHERE youtube_id = ?').get(input.youtubeId) as { id: number };
  recordRevision('episode', row.id, state === 'published' ? 'published' : 'drafted');
  return { id: row.id, slug, created: true };
}

export function updateEpisode(id: number, input: EpisodeInput, state: PublicationState): EpisodePersistResult {
  assertVideoId(input.youtubeId);
  const db = getDb();
  const existing = getEpisodeById(id);
  if (!existing) throw new Error('Episode not found.');
  const summary = input.summary !== '' ? input.summary : summariseFromDescription(input.description, input.title);
  const { series: detectedSeries } = parseSeriesAndNumber(input.title);

  db.prepare(
    `UPDATE episodes SET title = ?, original_title = ?, summary = ?, description = ?, guests = ?,
       host_names = ?, series = ?, episode_number = ?, category = ?, tags = ?, thumbnail_url = ?,
       duration_seconds = ?, published_at = ?, state = ?, language = ?, format = ?, featured = ?,
       meta_title = ?, meta_description = ?, manually_edited = 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(
    input.title,
    input.originalTitle !== '' ? input.originalTitle : input.title,
    summary,
    input.description,
    joinList(splitList(input.guests)),
    joinList(splitList(input.hostNames)),
    detectedSeries !== '' ? detectedSeries : '',
    input.episodeNumber,
    input.category,
    joinList(splitList(input.tags)),
    input.thumbnail,
    input.durationSeconds,
    publishedAtFor(state, existing.publishedAt),
    state,
    input.language,
    input.format,
    input.featured ? 1 : 0,
    input.metaTitle,
    input.metaDescription,
    id
  );
  recordRevision('episode', id, 'updated');
  return { id, slug: existing.slug, created: false };
}

export function setEpisodeState(id: number, state: PublicationState): boolean {
  const db = getDb();
  const existing = getEpisodeById(id);
  if (!existing) return false;
  db.prepare(
    `UPDATE episodes SET state = ?, published_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`
  ).run(state, publishedAtFor(state, existing.publishedAt), id);
  recordRevision('episode', id, state === 'published' ? 'published' : 'unpublished');
  return true;
}

export function deleteEpisode(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM episodes WHERE id = ?').run(id);
  const affected = Number(result.changes) > 0;
  if (affected) recordRevision('episode', id, 'deleted');
  return affected;
}

export function countEpisodesByState(state: PublicationState): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS n FROM episodes WHERE state = ?').get(state) as { n: number };
  return row.n;
}
