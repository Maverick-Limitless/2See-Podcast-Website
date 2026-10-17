import { config } from '../config';

/**
 * YouTube Data API v3 client and public-feed fallback.
 *
 * Two retrieval paths exist on purpose:
 *
 *  1. The Data API, when a key is configured. It can page through the entire
 *     upload history and returns duration, which the public feed does not.
 *  2. The channel's public feed. No key needed and always available, but it
 *     carries only the most recent uploads (historically 15) and no duration.
 *
 * Neither path is required for manual episode entry. The whole panel works
 * with no key at all.
 */

export interface RemoteVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  durationSeconds: number | null;
}

export class YouTubeFetchError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'YouTubeFetchError';
    this.retryable = retryable;
  }
}

const API_ROOT = 'https://www.googleapis.com/youtube/v3';

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (response.status === 404) {
      throw new YouTubeFetchError('The requested resource does not exist.', false);
    }
    if (response.status === 403) {
      // Quota exhaustion and key problems both surface as 403.
      throw new YouTubeFetchError(
        'YouTube rejected the request. Check the API key and its quota.',
        false
      );
    }
    if (!response.ok) {
      throw new YouTubeFetchError(`YouTube returned HTTP ${response.status}.`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof YouTubeFetchError) throw error;
    throw new YouTubeFetchError(`Network error: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves a handle or channel ID to the channel's uploads playlist ID. */
export async function resolveUploadsPlaylist(
  handleOrId: string
): Promise<{ playlistId: string; channelId: string }> {
  const key = config.youtubeApiKey;
  if (key === '') throw new YouTubeFetchError('No YouTube API key is configured.', false);

  const raw = handleOrId.trim();
  const isChannelId = /^UC[A-Za-z0-9_-]{22}$/.test(raw);
  const query = isChannelId ? `id=${encodeURIComponent(raw)}` : `forHandle=${encodeURIComponent(raw)}`;

  const payload = (await fetchJson(
    `${API_ROOT}/channels?part=contentDetails,snippet&${query}&key=${encodeURIComponent(key)}`
  )) as { items?: { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] };

  const first = payload.items?.[0];
  const playlistId = first?.contentDetails?.relatedPlaylists?.uploads;
  if (!first || typeof playlistId !== 'string' || playlistId === '') {
    throw new YouTubeFetchError(`No channel matched "${raw}".`, false);
  }
  return { playlistId, channelId: first.id };
}

/** ISO 8601 duration (e.g. PT1H4M33S) to seconds. */
export function parseIsoDuration(input: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(input.trim());
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  if (hours > 0) return `${hours}:${mm}:${String(rest).padStart(2, '0')}`;
  return `${mm}:${String(rest).padStart(2, '0')}`;
}

function pickThumbnail(
  thumbnails: Record<string, { url?: string }> | undefined
): string {
  if (!thumbnails) return '';
  const order = ['maxres', 'standard', 'high', 'medium', 'default'];
  for (const key of order) {
    const candidate = thumbnails[key]?.url;
    if (typeof candidate === 'string' && candidate !== '') return candidate;
  }
  return '';
}

/**
 * Fetches one page of an uploads playlist. `pageToken` continues a previous
 * run, which is how an initial archive import is paged without a single
 * oversized request.
 */
export async function fetchUploadsPage(
  playlistId: string,
  pageToken = '',
  maxResults = 25
): Promise<{ videos: RemoteVideo[]; nextPageToken: string | null }> {
  const key = config.youtubeApiKey;
  if (key === '') throw new YouTubeFetchError('No YouTube API key is configured.', false);
  const limit = Math.min(50, Math.max(1, maxResults));

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(limit),
    key
  });
  if (pageToken !== '') params.set('pageToken', pageToken);

  const payload = (await fetchJson(`${API_ROOT}/playlistItems?${params.toString()}`)) as {
    items?: {
      contentDetails?: { videoId?: string; videoPublishedAt?: string };
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: Record<string, { url?: string }>;
      };
    }[];
    nextPageToken?: string;
  };

  const wantedIds = (payload.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => typeof id === 'string' && id !== '');

  // Duration is not on the playlist item; it needs a second call that lists
  // videos by ID. Batched to respect quota units per request.
  const durations = new Map<string, number | null>();
  for (let start = 0; start < wantedIds.length; start += 50) {
    const batch = wantedIds.slice(start, start + 50);
    const detail = (await fetchJson(
      `${API_ROOT}/videos?part=contentDetails&id=${batch.join(',')}&key=${encodeURIComponent(key)}`
    )) as { items?: { id?: string; contentDetails?: { duration?: string } }[] };
    for (const item of detail.items ?? []) {
      if (typeof item.id !== 'string') continue;
      const iso = item.contentDetails?.duration;
      durations.set(item.id, typeof iso === 'string' ? parseIsoDuration(iso) : null);
    }
  }

  const videos: RemoteVideo[] = [];
  for (const item of payload.items ?? []) {
    const videoId = item.contentDetails?.videoId;
    if (typeof videoId !== 'string' || videoId === '') continue;
    const snippet = item.snippet ?? {};
    videos.push({
      videoId,
      title: (snippet.title ?? 'Untitled').slice(0, 300),
      description: (snippet.description ?? '').slice(0, 8000),
      publishedAt: snippet.publishedAt ?? item.contentDetails?.videoPublishedAt ?? new Date().toISOString(),
      thumbnail: pickThumbnail(snippet.thumbnails),
      durationSeconds: durations.get(videoId) ?? null
    });
  }

  return { videos, nextPageToken: payload.nextPageToken ?? null };
}

/**
 * Public feed fallback. Returns the most recent uploads without any key.
 * Limited by YouTube itself, which is why it is a fallback and not the primary
 * path for archive import.
 */
export async function fetchFeedVideos(channelId: string, limit = 15): Promise<RemoteVideo[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { signal: controller.signal, headers: { Accept: 'application/xml' } }
    );
    if (!response.ok) {
      throw new YouTubeFetchError(`Channel feed returned HTTP ${response.status}.`);
    }
    const xml = await response.text();
    return parseFeed(xml, limit);
  } catch (error) {
    if (error instanceof YouTubeFetchError) throw error;
    throw new YouTubeFetchError(`Network error: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal, dependency-free Atom parser for the channel feed. */
export function parseFeed(xml: string, limit = 15): RemoteVideo[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  const videos: RemoteVideo[] = [];
  for (const [, body] of entries) {
    if (!body || videos.length >= limit) continue;
    const videoId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(body)?.[1];
    if (!videoId) continue;
    const title = (/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? 'Untitled').trim();
    const published = /<published>([^<]+)<\/published>/.exec(body)?.[1];
    const description = /<media:description[^>]*>([\s\S]*?)<\/media:description>/.exec(body)?.[1] ?? '';
    videos.push({
      videoId,
      title: decodeXmlEntities(title).slice(0, 300),
      description: decodeXmlEntities(description).slice(0, 8000),
      publishedAt: published ?? new Date().toISOString(),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      durationSeconds: null
    });
  }
  return videos;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
