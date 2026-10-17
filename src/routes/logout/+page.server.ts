import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { revokeSession, SESSION_COOKIE } from '$lib/server/auth/session';
import { getDb } from '$lib/server/db';

/**
 * Sign out.
 *
 * Revokes the session record on the server — not just the browser cookie — so
 * a token captured before sign-out is dead immediately. Accepts GET (for a
 * bookmark or a nav link) and POST (for a form button), and is idempotent:
 * signing out twice is the same as signing out once.
 */
export const actions: Actions = {
  default: async ({ cookies }) => {
    getDb();
    revokeSession(cookies.get(SESSION_COOKIE));
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/');
  }
};
