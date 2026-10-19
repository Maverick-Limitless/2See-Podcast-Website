export interface ArchiveUrlParts {
  page?: number;
  query?: string;
  category?: string;
  format?: string;
}

/**
 * Builds an archive URL that carries the whole filter state. "Load more" and
 * the format chips use this, so pagination can never silently drop an active
 * search — the next batch of a search result is still that search's batch.
 * Page 1 is omitted: the canonical first page is the clean filter URL.
 */
export function buildArchiveUrl(base: string, parts: ArchiveUrlParts): string {
  const params = new URLSearchParams();
  if (parts.query) params.set('q', parts.query);
  if (parts.category) params.set('category', parts.category);
  if (parts.format && parts.format !== 'all') params.set('format', parts.format);
  if (parts.page && parts.page > 1) params.set('page', String(parts.page));
  const search = params.toString();
  return search === '' ? base : `${base}?${search}`;
}
