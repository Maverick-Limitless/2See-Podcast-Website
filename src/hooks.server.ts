import { redirect } from '@sveltejs/kit';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { building } from '$app/environment';
import { config } from '$lib/server/config';
import { getDb } from '$lib/server/db';
import { getSettings } from '$lib/server/content/settings';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  newCsrfToken,
  resolveSession,
  revokeSession,
  signCsrf
} from '$lib/server/auth/session';
import { pruneLoginAttempts } from '$lib/server/auth/rate-limit';
import { pruneExpiredSessions } from '$lib/server/auth/session';
import { buildHeaders } from '$lib/server/http/security';
import { getSyncState } from '$lib/server/youtube/sync';

/**
 * Server middleware.
 *
 * Responsibilities, in order: session resolution, CSRF token issuance, admin
 * route protection, security headers, private cache policy. Every one of these
 * is a server-side control; the client never decides whether a route is
 * reachable.
 */

const PROTECTED_PREFIXES = ['/admin'];

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (header === null) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name !== '') out[name] = decodeURIComponent(value);
  }
  return out;
}

function clientAddress(event: RequestEvent): string {
  const forwarded = event.request.headers.get('x-forwarded-for');
  if (forwarded !== null) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return event.getClientAddress();
}

let pruned = 0;

export const handle: Handle = async ({ event, resolve }) => {
  if (!building) {
    // Open the database and run any outstanding migrations on boot.
    getDb();
    // Housekeeping at most once a minute; the work is small and bounded.
    if (Date.now() - pruned > 60_000) {
      pruned = Date.now();
      try {
        pruneExpiredSessions();
        pruneLoginAttempts();
      } catch {
        // Housekeeping must never break a request.
      }
    }
  }

  const cookies = parseCookies(event.request.headers.get('cookie'));

  // --- session -----------------------------------------------------------
  const sessionToken = cookies[SESSION_COOKIE];
  const admin = resolveSession(sessionToken);

  event.locals.admin = admin;
  event.locals.clientAddress = clientAddress(event);

  // --- CSRF token --------------------------------------------------------
  // The token is random and signed. It is not a session secret: it exists so a
  // cross-site form post cannot carry a valid value.
  let csrfRaw = cookies[CSRF_COOKIE] ?? '';
  if (csrfRaw === '') {
    csrfRaw = newCsrfToken();
    event.cookies.set(CSRF_COOKIE, csrfRaw, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 60 * 60 * 24
    });
  }
  event.locals.csrfToken = signCsrf(csrfRaw);

  // --- protection --------------------------------------------------------
  const path = event.url.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !event.locals.admin) {
    // Redirect to login, preserving the destination, but never a full URL.
    const next = event.url.pathname + event.url.search;
    throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
  }

  const response = await resolve(event);

  // Security headers. Admin and public policies differ because the admin
  // boundary must never be cached or framed.
  for (const [name, value] of Object.entries(
    buildHeaders(config.isProduction)
  )) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }

  // The admin boundary must never be cached by a shared proxy.
  if (isProtected) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Vary', 'Cookie');
  }

  return response;
};
