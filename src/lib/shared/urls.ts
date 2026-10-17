/**
 * Canonical URLs.
 *
 * The production origin comes from the environment (`PUBLIC_ORIGIN`). When it
 * is not configured, no absolute canonical URL is emitted at all — an invented
 * domain is worse than a missing one, and a protocol-relative URL invites a
 * crawler to guess. The server loaders pass the origin down, so a page never
 * has to reach into configuration itself.
 */

export interface CanonicalOptions {
  /** Absolute origin without a trailing slash, or '' when unconfigured. */
  origin: string;
  /** Path beginning with '/', e.g. '/episodes'. */
  path: string;
}

export function canonicalUrl({ origin, path }: CanonicalOptions): string {
  if (origin === '') return '';
  return `${origin.replace(/\/+$/, '')}${path}`;
}

/** True when the value is safe to publish as a canonical URL. */
export function isPublishableOrigin(origin: string): boolean {
  return /^https?:\/\/[^\s/]+$/.test(origin);
}
