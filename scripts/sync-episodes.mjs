#!/usr/bin/env node
/**
 * Scheduled synchronisation entry point.
 *
 * Safe for cron: work is identified by YouTube video ID, which is UNIQUE in
 * the database, so a re-run creates nothing new; hand-edited episodes keep
 * every value they set. New videos land as drafts, never auto-published.
 *
 * Without YOUTUBE_API_KEY this reads the channel's public feed (the most
 * recent uploads). The application's admin panel performs the same work with
 * the Data API when a key is configured; this script is the no-key path for
 * scheduled runs.
 *
 * Usage: npm run sync:episodes
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/2see.db');
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCIV4JGPrV3bHNBGYPLnfqTA';

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

function decode(input) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&/g, '&');
}

function excerpt(text, max = 180) {
  const clean = decode(text).replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  if (clean === '') return '';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function ensureUniqueSlug(db, base) {
  let slug = base;
  let counter = 2;
  while (db.prepare('SELECT id FROM episodes WHERE slug = ?').get(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  return slug;
}

function slugify(input) {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'episode'
  );
}

mkdirSync(dirname(DATABASE_PATH), { recursive: true });
const db = new DatabaseSync(DATABASE_PATH);

const response = await fetch(
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(CHANNEL_ID)}`,
  { headers: { Accept: 'application/xml' } }
);
if (!response.ok) {
  console.error(`[${new Date().toISOString()}] error: feed returned HTTP ${response.status}`);
  db.close();
  process.exit(1);
}
const xml = await response.text();

let created = 0;
let skipped = 0;
for (const [, body] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
  if (!body) continue;
  const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(body)?.[1];
  if (!videoId) continue;
  if (db.prepare('SELECT id FROM episodes WHERE youtube_id = ?').get(videoId)) {
    skipped += 1;
    continue;
  }
  const title = decode((/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? 'Untitled').trim());
  const description = decode(
    /<media:description[^>]*>([\s\S]*?)<\/media:description>/.exec(body)?.[1] ?? ''
  );
  const published = /<published>([^<]+)<\/published>/.exec(body)?.[1] ?? new Date().toISOString();
  const isShort = /\/shorts\//.test(/<link[^>]*href="([^"]+)"/.exec(body)?.[1] ?? '');
  const language = /[\u0600-\u06ff]/.test(`${title} ${description}`) ? 'fa' : 'en';
  const format = isShort ? 'short' : /brief/i.test(title) ? 'brief' : 'episode';
  const category =
    format === 'short' ? 'Shorts' : format === 'brief' ? 'Weekly brief' : 'Conversation';
  const { series, number } = parseSeriesAndNumber(title);
  const publishedAt = new Date(published).toISOString().replace('T', ' ').replace('Z', '');

  db.prepare(
    `INSERT INTO episodes (youtube_id, slug, title, original_title, summary, description,
       series, episode_number, category, thumbnail_url, published_at, state, language,
       format, featured, meta_title, meta_description, sync_source, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 0, '', '', 'feed',
             strftime('%Y-%m-%d %H:%M:%f','now'))`
  ).run(
    videoId,
    ensureUniqueSlug(db, slugify(title)),
    title,
    title,
    excerpt(description) || title,
    description,
    series,
    number,
    category,
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    publishedAt,
    language,
    format
  );
  created += 1;
}

db.prepare(
  `UPDATE sync_state SET
     last_run_at = strftime('%Y-%m-%d %H:%M:%f','now'),
     last_success_at = strftime('%Y-%m-%d %H:%M:%f','now'),
     last_status = 'ok',
     last_message = ?, last_found_count = ?, last_created_count = ?,
     last_updated_count = 0, total_synced_count = total_synced_count + ?,
     source = 'feed', updated_at = strftime('%Y-%m-%d %H:%M:%f','now')
   WHERE id = 1`
).run(
  created === 0
    ? 'No new uploads. Every recent video already has an entry.'
    : `Imported ${created} new draft${created === 1 ? '' : 's'} from the public feed.`,
  created + skipped,
  created,
  created
);
db.close();

console.log(
  `[${new Date().toISOString()}] ok: ${created} created, ${skipped} already present. ` +
    'New entries are drafts until you publish them.'
);
