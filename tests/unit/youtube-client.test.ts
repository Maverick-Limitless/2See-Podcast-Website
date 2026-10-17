import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  parseFeed,
  parseIsoDuration
} from '../../src/lib/server/youtube/client';

describe('parseIsoDuration', () => {
  it('reads hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT1H4M33S')).toBe(3873);
    expect(parseIsoDuration('PT42M')).toBe(2520);
    expect(parseIsoDuration('PT45S')).toBe(45);
  });

  it('reads day components', () => {
    expect(parseIsoDuration('P1DT2H')).toBe(93600);
  });

  it('returns null for anything unparseable or empty', () => {
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration('nonsense')).toBeNull();
    expect(parseIsoDuration('1:04:33')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats short durations as m:ss', () => {
    expect(formatDuration(3873)).toBe('1:04:33');
    expect(formatDuration(2520)).toBe('42:00');
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats long durations as h:mm:ss', () => {
    expect(formatDuration(93600)).toBe('26:00:00');
  });

  it('returns an empty string when the duration is unknown', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(0)).toBe('');
  });
});

describe('parseFeed', () => {
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <entry>
  <id>yt:video:pJZ9r_h1P4U</id>
  <yt:videoId>pJZ9r_h1P4U</yt:videoId>
  <title>NASA&#39;s Roman Telescope</title>
  <published>2026-10-16T14:01:32+00:00</published>
  <link rel="alternate" href="https://www.youtube.com/watch?v=pJZ9r_h1P4U"/>
  <media:group>
   <media:description>An episode description.</media:description>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:UYiEcJUlpy0</id>
  <yt:videoId>UYiEcJUlpy0</yt:videoId>
  <title>A short</title>
  <published>2026-10-16T14:09:46+00:00</published>
  <link rel="alternate" href="https://www.youtube.com/shorts/UYiEcJUlpy0"/>
 </entry>
</feed>`;

  it('reads video id, title, date, description and thumbnail', () => {
    const videos = parseFeed(feed);
    expect(videos).toHaveLength(2);
    expect(videos[0]?.videoId).toBe('pJZ9r_h1P4U');
    expect(videos[0]?.title).toBe("NASA's Roman Telescope");
    expect(videos[0]?.description).toBe('An episode description.');
    expect(videos[0]?.thumbnail).toBe(
      'https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg'
    );
    expect(videos[0]?.durationSeconds).toBeNull();
  });

  it('decodes XML entities in titles', () => {
    const videos = parseFeed(feed);
    expect(videos[0]?.title).not.toContain('&amp;');
  });

  it('honours the requested limit', () => {
    expect(parseFeed(feed, 1)).toHaveLength(1);
  });

  it('returns an empty list for a feed with no entries', () => {
    expect(parseFeed('<feed></feed>')).toEqual([]);
  });

  it('ignores malformed entries without a video ID', () => {
    const broken = feed.replace('<yt:videoId>pJZ9r_h1P4U</yt:videoId>', '');
    expect(parseFeed(broken, 10).every((v) => v.videoId !== '')).toBe(true);
  });
});
