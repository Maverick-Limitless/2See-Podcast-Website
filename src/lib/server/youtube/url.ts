/**
 * YouTube URL parsing and video-ID extraction.
 *
 * This is a security boundary, not a convenience helper. The admin panel is the
 * only place a URL is accepted from a human, and an accepted value ends up in
 * an iframe src and a public link. The parser therefore works by allowlist:
 * a known YouTube host, and only hosts that can carry exactly one video ID.
 * Anything else is rejected.
 */

export interface ParsedYouTubeUrl {
  videoId: string;
  /** Normalised watch URL, always the canonical form. */
  canonicalUrl: string;
  /** True when the URL is a Short, used for content-format labelling. */
  isShort: boolean;
  /** Playlist ID when present. Never used for embedding. */
  playlistId: string | null;
}

export class YouTubeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeUrlError';
  }
}

/** Canonical YouTube video IDs are 11 characters from a known alphabet. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Hosts whose only role is embedding. An `embed` URL is rejected rather than
 * unwrapped, because accepting arbitrary embed URLs would let a publisher paste
 * any iframe target and have it rendered on a public page.
 */
const EMBED_HOSTS = new Set([
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'www.youtube.com',
  'youtube.com'
]);

/** Only these hosts may supply a URL at all. */
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/**
 * Parses a user-supplied YouTube URL.
 *
 * @throws YouTubeUrlError for anything that is not an unambiguous YouTube video
 *         URL. Callers must treat a throw as "reject the input".
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl {
  if (typeof input !== 'string') throw new YouTubeUrlError('A URL is required.');
  const trimmed = input.trim();
  if (trimmed === '') throw new YouTubeUrlError('A URL is required.');
  if (trimmed.length > 2048) throw new YouTubeUrlError('The URL is too long.');

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new YouTubeUrlError('That URL could not be read.');
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new YouTubeUrlError('Only youtube.com and youtu.be URLs are accepted.');
  }
  if (EMBED_HOSTS.has(host) && url.pathname.startsWith('/embed/')) {
    throw new YouTubeUrlError('Embed URLs cannot be added directly. Use the watch or share URL.');
  }
  if (url.username !== '' || url.password !== '') {
    throw new YouTubeUrlError('Credentials in a URL are not accepted.');
  }

  const playlistId = url.searchParams.get('list');
  if (playlistId !== null && playlistId.length > 64) {
    throw new YouTubeUrlError('The playlist reference is not valid.');
  }

  let videoId: string | null = null;
  let isShort = false;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 1 && segments[0]) videoId = segments[0];
  } else {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0] === 'watch') {
      const candidate = url.searchParams.get('v');
      if (candidate) videoId = candidate;
    } else if (segments[0] === 'shorts' && segments[1]) {
      videoId = segments[1];
      isShort = true;
    } else if (segments[0] === 'live' && segments[1]) {
      videoId = segments[1];
    } else if (segments[0] === 'v' && segments[1]) {
      videoId = segments[1];
    }
  }

  if (videoId === null) {
    throw new YouTubeUrlError('That URL does not point to a single video.');
  }
  if (!isVideoId(videoId)) {
    throw new YouTubeUrlError('That URL does not contain a valid YouTube video ID.');
  }

  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    isShort,
    playlistId: playlistId && playlistId !== '' ? playlistId : null
  };
}

/** Safe extraction that returns null instead of throwing. */
export function tryParseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  try {
    return parseYouTubeUrl(input);
  } catch {
    return null;
  }
}

/** Extracts a video ID from a value that is already known to be an ID. */
export function normalizeVideoId(value: string): string | null {
  const trimmed = value.trim();
  return isVideoId(trimmed) ? trimmed : null;
}

/** Standard thumbnail URLs. Used for lazy, responsive image loading. */
export function thumbnailUrl(videoId: string, quality: 'hq' | 'max' = 'max'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
