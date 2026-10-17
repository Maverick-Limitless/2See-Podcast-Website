import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../setup';
import { getDb } from '../../src/lib/server/db';
import {
  createEpisode,
  deleteEpisode,
  getEpisodeBySlug,
  getEpisodeByVideoId,
  listEpisodes,
  parseSeriesAndNumber,
  setEpisodeState
} from '../../src/lib/server/content/episodes';
import {
  createStory,
  deleteStory,
  featuredStory,
  getStoryBySlug,
  listStories,
  setStoryState
} from '../../src/lib/server/content/stories';
import { parseYouTubeUrl } from '../../src/lib/server/youtube/url';
import { contentRevisionToken, recordRevision } from '../../src/lib/server/http/cache';

const VIDEO = {
  youtubeId: 'pJZ9r_h1P4U',
  title: 'اپیزود ۴۳: نظر استاد هاروارد چیست؟ | قسمت ۱',
  originalTitle: '',
  summary: '',
  description: 'A real episode description.',
  guests: 'میلاد منشی‌پور',
  hostNames: 'صالح دادخواهی‌پور، مهرزاد سجادی',
  category: 'Conversation',
  tags: 'growth, iran',
  thumbnail: 'https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg',
  durationSeconds: 3873,
  publishedAt: '2026-10-11 15:00:36',
  episodeNumber: 43,
  featured: false,
  metaTitle: '',
  metaDescription: '',
  language: 'fa' as const,
  format: 'episode' as const
};

beforeEach(async () => {
  await useTestDatabase();
});

describe('episodes — creation and duplicates', () => {
  it('creates an episode and derives a slug', () => {
    const result = createEpisode(VIDEO, 'draft');
    expect(result.created).toBe(true);
    expect(result.slug).not.toBe('');
    expect(getEpisodeByVideoId('pJZ9r_h1P4U')?.title).toBe(VIDEO.title);
  });

  it('rejects the same YouTube video ID twice, reporting the existing entry', () => {
    const first = createEpisode(VIDEO, 'draft');
    const second = createEpisode({ ...VIDEO, title: 'A different title' }, 'draft');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.duplicateOf?.id).toBe(first.id);
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM episodes').get()).toEqual({ n: 1 });
  });

  it('stores the Persian title exactly as supplied', () => {
    createEpisode(VIDEO, 'draft');
    expect(getEpisodeByVideoId('pJZ9r_h1P4U')?.title).toBe(VIDEO.title);
  });

  it('rejects a malformed YouTube video ID before storage', () => {
    expect(() => createEpisode({ ...VIDEO, youtubeId: 'too-short' }, 'draft')).toThrow();
  });

  it('stores guests as a list and keeps them ordered', () => {
    createEpisode({ ...VIDEO, guests: 'one, two , three' }, 'draft');
    expect(getEpisodeByVideoId('pJZ9r_h1P4U')?.guests).toEqual(['one', 'two', 'three']);
  });
});

describe('episodes — publication state', () => {
  it('draft episodes never appear in the public list', () => {
    createEpisode(VIDEO, 'draft');
    expect(listEpisodes({ state: 'published' }).items).toHaveLength(0);
    expect(listEpisodes({ state: 'draft' }).items).toHaveLength(1);
  });

  it('publishing makes an episode public', () => {
    const created = createEpisode(VIDEO, 'draft');
    setEpisodeState(created.id, 'published');
    expect(listEpisodes({ state: 'published' }).items).toHaveLength(1);
    expect(getEpisodeBySlug(created.slug)?.state).toBe('published');
  });

  it('unpublishing removes it from the public list again', () => {
    const created = createEpisode(VIDEO, 'published');
    setEpisodeState(created.id, 'draft');
    expect(listEpisodes({ state: 'published' }).items).toHaveLength(0);
  });

  it('deleting removes the row entirely', () => {
    const created = createEpisode(VIDEO, 'published');
    expect(deleteEpisode(created.id)).toBe(true);
    expect(getEpisodeByVideoId('pJZ9r_h1P4U')).toBeNull();
    expect(deleteEpisode(created.id)).toBe(false);
  });
});

describe('episodes — series detection', () => {
  it('reads a Persian episode number', () => {
    expect(parseSeriesAndNumber('اپیزود ۴۳: نظر استاد هاروارد')).toEqual({
      series: 'Main series',
      number: 43
    });
  });

  it('reads a calendar-week brief number', () => {
    expect(parseSeriesAndNumber('2026 Nobel Prizes Explained | 2See Brief CW41')).toEqual({
      series: '2See Brief',
      number: 41
    });
  });

  it('returns no series when the title has no number', () => {
    expect(parseSeriesAndNumber('NASA, NVIDIA, Character AI, ASML').number).toBeNull();
  });
});

describe('stories — creation, slugs and states', () => {
  const STORY = {
    title: 'A story about growth',
    subtitle: 'A subtitle',
    summary: 'A summary',
    bodyMarkdown: '## Heading\n\nBody text that is long enough to read.\n\n- one\n- two',
    coverImage: '',
    coverAlt: '',
    coverCaption: '',
    category: 'Economic notes',
    tags: 'growth, policy',
    author: 'The desk',
    featured: false,
    metaTitle: '',
    metaDescription: ''
  };

  it('creates a story, renders the body once, and computes reading time', () => {
    const result = createStory(STORY, 'published');
    const story = getStoryBySlug(result.slug)!;
    expect(story.bodyHtml).toContain('<h2 id="heading">');
    expect(story.bodyHtml).toContain('<ul>');
    expect(story.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(story.wordCount).toBeGreaterThan(0);
  });

  it('drafts are not on the public list', () => {
    createStory(STORY, 'draft');
    expect(listStories({ state: 'published' }).items).toHaveLength(0);
    expect(listStories({ state: 'draft' }).items).toHaveLength(1);
  });

  it('publishing a story makes it public, unpublishing hides it', () => {
    const created = createStory(STORY, 'draft');
    setStoryState(created.id, 'published');
    expect(listStories({ state: 'published' }).items).toHaveLength(1);

    setStoryState(created.id, 'draft');
    expect(listStories({ state: 'published' }).items).toHaveLength(0);
  });

  it('unique slugs for identical titles, deterministically', () => {
    const first = createStory(STORY, 'published');
    const second = createStory(STORY, 'published');
    expect(first.slug).not.toBe(second.slug);
    expect(second.slug.startsWith(first.slug)).toBe(true);
  });

  it('sanitises the body so no script tag is stored', () => {
    createStory({ ...STORY, bodyMarkdown: 'text <script>alert(1)</script>' }, 'draft');
    const story = getStoryBySlug('a-story-about-growth')!;
    expect(story.bodyHtml).not.toContain('<script');
    expect(story.bodyHtml).toContain('&lt;script&gt;');
  });

  it('featuredStories are surfaced first', () => {
    createStory(STORY, 'published');
    createStory({ ...STORY, title: 'Featured one', featured: true }, 'published');
    const featured = featuredStory()!;
    expect(featured.title).toBe('Featured one');
  });

  it('deletes a story', () => {
    const created = createStory(STORY, 'published');
    expect(deleteStory(created.id)).toBe(true);
    expect(getStoryBySlug(created.slug)).toBeNull();
  });
});

describe('search and filters', () => {
  beforeEach(() => {
    createEpisode(VIDEO, 'published');
    createEpisode(
      {
        ...VIDEO,
        youtubeId: 'bWhDYrR9VSQ',
        title: '2026 Nobel Prizes Explained | 2See Brief CW41',
        language: 'en',
        format: 'brief'
      },
      'published'
    );
  });

  it('searches across the Persian title', () => {
    expect(listEpisodes({ query: 'هاروارد' }).total).toBe(1);
  });

  it('filters by format', () => {
    expect(listEpisodes({ format: 'brief' }).total).toBe(1);
    expect(listEpisodes({ format: 'short' }).total).toBe(0);
  });

  it('paginates without duplicating rows', () => {
    const page1 = listEpisodes({ pageSize: 1, page: 1 });
    const page2 = listEpisodes({ pageSize: 1, page: 2 });
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
    expect(page1.hasMore).toBe(true);
  });

  it('returns nothing for an unmatched query', () => {
    expect(listEpisodes({ query: 'zzzz-no-match' }).total).toBe(0);
  });
});

describe('cache invalidation', () => {
  it('the revision token changes when content is published', () => {
    const before = contentRevisionToken();
    const created = createEpisode(VIDEO, 'draft');
    setEpisodeState(created.id, 'published');
    expect(contentRevisionToken()).not.toBe(before);
  });

  it('recording a revision is idempotent for the token component', () => {
    const before = contentRevisionToken();
    recordRevision('settings', null, 'updated');
    recordRevision('settings', null, 'updated');
    expect(contentRevisionToken()).not.toBe(before);
  });
});
