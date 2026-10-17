/**
 * Cache policy for public content and private administration.
 *
 * The rule is simple and testable:
 *
 *  - public, content-bearing pages are stale-while-revalidate cached, with a
 *    revision token that changes the moment any content is published;
 *  - authenticated HTML and API responses are never cached, at any layer;
 *  - static assets are content-hashed by the build and cached immutably.
 *
 * `content_revisions` is the source of truth for invalidation. Public loaders
 * include the newest revision id in the rendered page, so a cached response
 * that predates a publish is detected and re-rendered.
 */

import { getDb } from '../db';

/** Newest revision id and timestamp, used as an ETag component. */
export function contentRevisionToken(): string {
  const db = getDb();
  const row = db
    .prepare('SELECT MAX(occurred_at) AS at, COUNT(*) AS n FROM content_revisions')
    .get() as { at: string | null; n: number } | undefined;
  if (!row || row.at === null) return 'r0-0';
  const epoch = new Date(row.at.replace(' ', 'T') + 'Z').getTime();
  return `r${epoch}-${row.n}`;
}

/** Records a content change so public caches can invalidate. */
export function recordRevision(entity: 'story' | 'episode' | 'settings', entityId: number | null, action: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO content_revisions (entity, entity_id, action) VALUES (?, ?, ?)`
  ).run(entity, entityId, action);
}

export function publicPageCache(ttlSeconds = 300): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=86400`,
    ETag: `W/"${contentRevisionToken()}"`
  };
}

export function privateCache(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
    Pragma: 'no-cache'
  };
}

export function immutableAssetCache(): string {
  return 'public, max-age=31536000, immutable';
}

export function dynamicAssetCache(): string {
  return 'public, max-age=3600, must-revalidate';
}
