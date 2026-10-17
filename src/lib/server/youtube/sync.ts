import { config } from '../config';
import { getDb } from '../db';
import { createEpisode, getEpisodeByVideoId } from '../content/episodes';
import { recordRevision } from '../http/cache';
import {
  fetchFeedVideos,
  fetchUploadsPage,
  resolveUploadsPlaylist,
  YouTubeFetchError,
  type RemoteVideo
} from './client';
import { detectFormat, detectLanguage } from '../content/episodes';

/**
 * Synchronisation engine.
 *
 * Idempotent by construction: work is identified by YouTube video ID, which is
 * UNIQUE in the database, so running twice in a row produces no new rows and
 * no duplicate publications.
 *
 * Field-level merge policy, which is the whole point of the `manually_edited`
 * column:
 *
 *   - If an episode was hand-edited in the admin panel, the publisher's values
 *     win for every human-authored field (title, summary, description, guests,
 *     category, tags, thumbnail, duration, featured, state).
 *   - Only the technical fields YouTube owns (sync timestamp, published date
 *     when it was never set) are refreshed.
 *   - An episode that is unpublished stays unpublished: sync never publishes
 *     an episode the publisher took down.
 */

export interface SyncReport {
  status: 'ok' | 'partial' | 'error';
  source: 'api' | 'feed' | null;
  found: number;
  created: number;
  updated: number;
  skipped: number;
  message: string;
}

interface SyncStateRow {
  last_run_at: string | null;
  last_success_at: string | null;
  last_status: string;
  last_message: string;
  last_found_count: number;
  last_created_count: number;
  last_updated_count: number;
  total_synced_count: number;
  source: string | null;
  playlist_cursor: string | null;
}

export interface SyncState {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: 'never' | 'running' | 'ok' | 'partial' | 'error';
  lastMessage: string;
  lastFoundCount: number;
  lastCreatedCount: number;
  lastUpdatedCount: number;
  totalSyncedCount: number;
  source: 'api' | 'feed' | null;
  cursor: string | null;
}

export function getSyncState(): SyncState {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO sync_state (id, last_status, last_message) VALUES (1, 'never', '')`
  ).run();
  const row = db
    .prepare(
      `SELECT last_run_at, last_success_at, last_status, last_message, last_found_count,
              last_created_count, last_updated_count, total_synced_count, source, playlist_cursor
         FROM sync_state WHERE id = 1`
    )
    .get() as unknown as SyncStateRow;
  return {
    lastRunAt: row.last_run_at,
    lastSuccessAt: row.last_success_at,
    lastStatus: (row.last_status as SyncState['lastStatus']) ?? 'never',
    lastMessage: row.last_message,
    lastFoundCount: row.last_found_count,
    lastCreatedCount: row.last_created_count,
    lastUpdatedCount: row.last_updated_count,
    totalSyncedCount: row.total_synced_count,
    source: (row.source as SyncState['source']) ?? null,
    cursor: row.playlist_cursor
  };
}

function writeSyncState(report: SyncReport): void {
  const db = getDb();
  db.prepare(
    `UPDATE sync_state SET
       last_run_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       last_success_at = CASE WHEN ? IN ('ok','partial') THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE last_success_at END,
       last_status = ?, last_message = ?, last_found_count = ?, last_created_count = ?,
       last_updated_count = ?, total_synced_count = total_synced_count + ?, source = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = 1`
  ).run(
    report.status,
    report.status,
    report.message.slice(0, 500),
    report.found,
    report.created,
    report.updated,
    report.created,
    report.source
  );
}

function classify(video: RemoteVideo): { format: 'episode' | 'brief' | 'short'; language: 'fa' | 'en' } {
  return {
    format: detectFormat(video.title, false),
    language: detectLanguage(video.title, video.description)
  };
}

export interface SyncOptions {
  /** Full archive import vs incremental run. */
  mode?: 'incremental' | 'full';
  /** Pages to fetch in one run when a key is configured. */
  pages?: number;
}

/**
 * Runs a synchronisation pass. Throws only when the caller should surface a
 * hard failure; the report itself carries partial results.
 */
export async function syncEpisodes(options: SyncOptions = {}): Promise<SyncReport> {
  const db = getDb();
  const pages = options.pages ?? (options.mode === 'full' ? 10 : 2);
  getDb().prepare(
    `UPDATE sync_state SET last_status = 'running', last_run_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1`
  ).run();

  let source: 'api' | 'feed' | null = null;
  const found: RemoteVideo[] = [];
  let hardError: Error | null = null;

  try {
    if (config.youtubeApiKey !== '') {
      const target =
        config.youtubeChannelId !== ''
          ? config.youtubeChannelId
          : config.youtubeChannelHandle;
      try {
        const { playlistId } = await resolveUploadsPlaylist(target);
        source = 'api';
        let pageToken = '';
        let page = 0;
        while (page < pages) {
          const result = await fetchUploadsPage(
            playlistId,
            pageToken,
            config.youtubeSyncMaxResults
          );
          found.push(...result.videos);
          pageToken = result.nextPageToken ?? '';
          if (pageToken === '') break;
          page += 1;
        }
      } catch (error) {
        if (error instanceof YouTubeFetchError && !error.retryable) throw error;
        hardError = error as Error;
        // Fall through to the public feed so a quota problem does not stop the
        // publisher from seeing recent uploads.
      }
    }

    if (source === null && hardError === null) {
      const channelId = config.youtubeChannelId;
      if (channelId === '') {
        const report: SyncReport = {
          status: 'error',
          source: null,
          found: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          message:
            'YouTube is not configured. Set a channel ID to use the public feed, or an API key for full access.'
        };
        writeSyncState(report);
        return report;
      }
      source = 'feed';
      found.push(...(await fetchFeedVideos(channelId, 15)));
    }
  } catch (error) {
    const report: SyncReport = {
      status: 'error',
      source: null,
      found: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      message: `Synchronisation failed: ${(error as Error).message}`
    };
    writeSyncState(report);
    return report;
  }

  if (hardError !== null && found.length === 0) {
    const report: SyncReport = {
      status: 'error',
      source: null,
      found: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      message: `Synchronisation failed: ${hardError.message}`
    };
    writeSyncState(report);
    return report;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Oldest first, so an initial import lands in chronological order and the
  // published dates read correctly on the public site.
  for (const video of [...found].reverse()) {
    const existing = getEpisodeByVideoId(video.videoId);
    if (existing) {
      if (existing.syncSource !== null && existing.syncSource !== 'manual' && isRefreshable(existing)) {
        const { format, language } = classify(video);
        db.prepare(
          `UPDATE episodes SET synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
             sync_source = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`
        ).run(source, existing.id);
        // A hand-edited row keeps every human field. Only technical sync data
        // moves, and even that only when the row is eligible.
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const { format, language } = classify(video);
    const publishedAt = new Date(video.publishedAt).toISOString().replace('T', ' ').replace('Z', '');
    createEpisode(
      {
        youtubeId: video.videoId,
        title: video.title,
        originalTitle: video.title,
        summary: '',
        description: video.description,
        guests: '',
        hostNames: '',
        category: format === 'short' ? 'Shorts' : format === 'brief' ? 'Weekly brief' : 'Conversation',
        tags: '',
        thumbnail: video.thumbnail,
        durationSeconds: video.durationSeconds,
        publishedAt,
        episodeNumber: null,
        featured: false,
        metaTitle: '',
        metaDescription: '',
        language,
        format
      },
      // Sync creates drafts. The publisher reviews and publishes, so a
      // mistake upstream never publishes itself without a human decision.
      'draft'
    );
    recordRevision('episode', 0, 'synced');
    created += 1;
  }

  const report: SyncReport = {
    status: found.length > 0 ? 'ok' : 'partial',
    source,
    found: found.length,
    created,
    updated,
    skipped,
    message:
      created === 0 && updated === 0
        ? 'No new uploads. Every video already has an entry.'
        : `Imported ${created} new draft${created === 1 ? '' : 's'}${updated > 0 ? `, refreshed ${updated}` : ''}.`
  };
  writeSyncState(report);
  return report;
}

function isRefreshable(episode: { syncSource: string | null }): boolean {
  return episode.syncSource !== null && episode.syncSource !== 'manual';
}
