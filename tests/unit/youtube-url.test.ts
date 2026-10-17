import { describe, expect, it } from 'vitest';
import {
  parseYouTubeUrl,
  thumbnailUrl,
  tryParseYouTubeUrl,
  watchUrl,
  YouTubeUrlError
} from '../../src/lib/server/youtube/url';

describe('parseYouTubeUrl', () => {
  it('reads a standard watch URL', () => {
    const result = parseYouTubeUrl('https://www.youtube.com/watch?v=pJZ9r_h1P4U');
    expect(result.videoId).toBe('pJZ9r_h1P4U');
    expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=pJZ9r_h1P4U');
    expect(result.isShort).toBe(false);
  });

  it('reads a youtu.be share URL', () => {
    const result = parseYouTubeUrl('https://youtu.be/A_DoGDgQ1G0?si=abcdef');
    expect(result.videoId).toBe('A_DoGDgQ1G0');
    expect(result.canonicalUrl).toBe('https://www.youtube.com/watch?v=A_DoGDgQ1G0');
  });

  it('reads a /shorts/ URL and marks it as a short', () => {
    const result = parseYouTubeUrl('https://www.youtube.com/shorts/UYiEcJUlpy0');
    expect(result.videoId).toBe('UYiEcJUlpy0');
    expect(result.isShort).toBe(true);
  });

  it('keeps a playlist reference separate from the video ID', () => {
    const result = parseYouTubeUrl('https://www.youtube.com/watch?v=pJZ9r_h1P4U&list=PLabc123');
    expect(result.videoId).toBe('pJZ9r_h1P4U');
    expect(result.playlistId).toBe('PLabc123');
  });

  it('accepts a bare watch path without a scheme', () => {
    expect(parseYouTubeUrl('www.youtube.com/watch?v=pJZ9r_h1P4U').videoId).toBe('pJZ9r_h1P4U');
  });

  describe('rejections', () => {
    it('rejects a non-YouTube host', () => {
      expect(() => parseYouTubeUrl('https://evil.example.com/watch?v=pJZ9r_h1P4U')).toThrow(
        YouTubeUrlError
      );
    });

    it('rejects an embed URL, so no arbitrary iframe target is accepted', () => {
      expect(() =>
        parseYouTubeUrl('https://www.youtube.com/embed/pJZ9r_h1P4U')
      ).toThrow(YouTubeUrlError);
    });

    it('rejects the privacy-enhanced embed host', () => {
      expect(() =>
        parseYouTubeUrl('https://www.youtube-nocookie.com/embed/pJZ9r_h1P4U')
      ).toThrow(YouTubeUrlError);
    });

    it('rejects a video ID of the wrong length', () => {
      expect(() => parseYouTubeUrl('https://www.youtube.com/watch?v=tooshort')).toThrow(
        YouTubeUrlError
      );
    });

    it('rejects a URL with credentials in it', () => {
      expect(() =>
        parseYouTubeUrl('https://user:pass@youtube.com/watch?v=pJZ9r_h1P4U')
      ).toThrow(YouTubeUrlError);
    });

    it('rejects a channel or playlist URL with no single video', () => {
      expect(() => parseYouTubeUrl('https://www.youtube.com/@2See.Podcast')).toThrow(
        YouTubeUrlError
      );
      expect(() => parseYouTubeUrl('https://www.youtube.com/playlist?list=PLabc')).toThrow(
        YouTubeUrlError
      );
    });

    it('rejects an empty or non-string value', () => {
      expect(() => parseYouTubeUrl('')).toThrow(YouTubeUrlError);
      // @ts-expect-error deliberately testing the runtime guard
      expect(() => parseYouTubeUrl(undefined)).toThrow(YouTubeUrlError);
    });
  });

  it('tryParseYouTubeUrl returns null instead of throwing', () => {
    expect(tryParseYouTubeUrl('https://www.youtube.com/watch?v=pJZ9r_h1P4U')).not.toBeNull();
    expect(tryParseYouTubeUrl('not a url')).toBeNull();
  });

  it('builds thumbnail and watch URLs from a video ID', () => {
    expect(thumbnailUrl('pJZ9r_h1P4U')).toBe('https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg');
    expect(thumbnailUrl('pJZ9r_h1P4U', 'hq')).toBe(
      'https://i.ytimg.com/vi/pJZ9r_h1P4U/hqdefault.jpg'
    );
    expect(watchUrl('pJZ9r_h1P4U')).toBe('https://www.youtube.com/watch?v=pJZ9r_h1P4U');
  });
});
