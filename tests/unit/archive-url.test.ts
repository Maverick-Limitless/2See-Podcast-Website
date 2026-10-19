import { describe, expect, it } from 'vitest';
import { buildArchiveUrl } from '../../src/lib/utils/archive-url';

describe('buildArchiveUrl', () => {
  it('returns the clean base for page 1 with no filters', () => {
    expect(buildArchiveUrl('/episodes', {})).toBe('/episodes');
    expect(buildArchiveUrl('/episodes', { page: 1 })).toBe('/episodes');
    expect(buildArchiveUrl('/episodes', { format: 'all' })).toBe('/episodes');
  });

  it('carries the whole filter state into the next page', () => {
    const url = buildArchiveUrl('/episodes', {
      page: 3,
      query: 'هاروارد',
      category: 'AI',
      format: 'episode'
    });
    expect(url).toContain(`q=${encodeURIComponent('هاروارد')}`);
    expect(url).toContain('category=AI');
    expect(url).toContain('format=episode');
    expect(url).toContain('page=3');
  });

  it('preserves the search and category when switching format', () => {
    const url = buildArchiveUrl('/episodes', { format: 'short', query: 'chip', category: 'AI' });
    expect(url).toContain('q=chip');
    expect(url).toContain('category=AI');
    expect(url).toContain('format=short');
    expect(url).not.toContain('page=');
  });
});
