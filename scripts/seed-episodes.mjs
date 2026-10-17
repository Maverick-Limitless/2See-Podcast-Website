import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
/**
 * Seeds episodes from the real, public 2See Podcast channel feed.
 *
 * Every field comes from the channel's own metadata — title, publication date,
 * thumbnail, description — so nothing is invented. Persian titles and
 * descriptions are preserved exactly as published.
 *
 * Run: npm run seed:episodes
 */

import { DatabaseSync } from 'node:sqlite';

const DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/2see.db');
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCIV4JGPrV3bHNBGYPLnfqTA';
const STATE = process.env.SEED_STATE || 'published';

function isoToDb(value) {
  const date = new Date(value);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'episode';
}

function hasPersian(value) {
  return /[\u0600-\u06ff]/.test(value);
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function parseSeriesAndNumber(title) {
  const normalised = title.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
  const fa = /اپیزود\s*(\d+)/.exec(normalised);
  if (fa) return { series: 'Main series', number: Number(fa[1]) };
  const en = /episode\s*(\d+)/i.exec(normalised);
  if (en) return { series: 'Main series', number: Number(en[1]) };
  const cw = /CW\s*(\d+)/i.exec(normalised);
  if (cw) return { series: '2See Brief', number: Number(cw[1]) };
  return { series: '', number: null };
}

function ensureUniqueSlug(db, base) {
  let slug = base;
  let counter = 2;
  while (db.prepare('SELECT id FROM episodes WHERE slug = ?').get(slug)) {
    slug = base + '-' + counter;
    counter += 1;
  }
  return slug;
}

function decode(input) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function excerpt(text, max = 180) {
  const clean = decode(text).replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  if (clean === '') return '';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

async function main() {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CHANNEL_ID)}`,
    { headers: { Accept: 'application/xml' } }
  );
  if (!response.ok) {
    console.error(`Feed request failed with HTTP ${response.status}.`);
    process.exit(1);
  }
  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, body]) => body)
    .filter(Boolean);

  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const db = new DatabaseSync(DATABASE_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  const schemaSql = readFileSync(
    resolve(dirname(new URL(import.meta.url).pathname), '../src/lib/server/db/schema.sql'),
    'utf8'
  );
  db.exec(schemaSql);

  let inserted = 0;
  let existingCount = 0;

  for (const body of entries) {
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(body)?.[1];
    if (!videoId) continue;
    const title = decode((/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? 'Untitled').trim());
    const published = /<published>([^<]+)<\/published>/.exec(body)?.[1];
    const description = decode(
      /<media:description[^>]*>([\s\S]*?)<\/media:description>/.exec(body)?.[1] ?? ''
    );
    const isShort = /\/shorts\//.test(/<link[^>]*href="([^"]+)"/.exec(body)?.[1] ?? '');
    const slugBase = ensureUniqueSlug(db, slugify(title));

    const row = db.prepare('SELECT id FROM episodes WHERE youtube_id = ?').get(videoId);
    if (row) {
      existingCount += 1;
      continue;
    }

    const { series, number } = parseSeriesAndNumber(title);
    const language = hasPersian(`${title} ${description}`) ? 'fa' : 'en';
    const format = isShort ? 'short' : /brief/i.test(title) ? 'brief' : 'episode';
    const category =
      format === 'short' ? 'Shorts' : format === 'brief' ? 'Weekly brief' : 'Conversation';

    db.prepare(
      `INSERT INTO episodes (youtube_id, slug, title, original_title, summary, description,
         guests, host_names, series, episode_number, category, tags, thumbnail_url,
         duration_seconds, published_at, state, language, format, featured, meta_title,
         meta_description, sync_source, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, '', ?, NULL, ?, ?, ?, ?, 0, '', ?, 'seed',
               strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
    ).run(
      videoId,
      slugBase,
      title,
      title,
      excerpt(description) || title,
      description,
      series,
      number,
      category,
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      isoToDb(published ?? new Date().toISOString()),
      STATE,
      language,
      format,
''
    );
    inserted += 1;
  }

  db.prepare(
    `INSERT INTO content_revisions (entity, entity_id, action) VALUES ('episode', NULL, 'seeded')`
  ).run();
  db.close();

  console.log(`Seeded ${inserted} episode${inserted === 1 ? '' : 's'}; ${existingCount} already present.`);
}

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
