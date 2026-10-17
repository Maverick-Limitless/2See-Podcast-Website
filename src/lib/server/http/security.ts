/**
 * Response headers for a single-server editorial site.
 *
 * The set is small and each directive has a reason. Nothing here is a tracking
 * or analytics concern: the site sets no cookies for public visitors and makes
 * no third-party requests on public pages.
 */

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1'
};


export function buildHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = { ...BASE_HEADERS };


  // NOTE: the Content Security Policy itself is emitted by SvelteKit (see
  // kit.csp in svelte.config.js). SvelteKit injects an inline bootstrap script
  // that every page needs, so the policy has to be generated per response with
  // a hash for that snippet. Declaring a static script-src here would block
  // hydration.

  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
