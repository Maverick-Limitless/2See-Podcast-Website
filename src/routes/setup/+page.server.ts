import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  adminExists,
  claimSetupRun,
  createAdmin,
  CANONICAL_USERNAME
} from '$lib/server/auth/admin-repository';
import { generateRandomPassword } from '$lib/server/auth/password';
import { privateCache } from '$lib/server/http/cache';

/**
 * One-time first-run setup.
 *
 * Available only while no administrator exists AND a bootstrap token was
 * configured. Using it consumes `setup_runs`, so the route is dead afterwards,
 * token or no token.
 *
 * The generated password is shown in the page body of the setup response. It
 * is never placed in a URL, a cookie, a header, a log line or the database in
 * plaintext, so there is no path for it to leak through a referrer or a shared
 * history entry.
 */

function constantTimeEqual(a: string, b: string): boolean {
  if (a === '' || b === '') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && left.equals(right);
}

function csrfMatches(presented: string, expected: string): boolean {
  if (presented === '' || expected === '') return false;
  return constantTimeEqual(presented, expected);
}

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  setHeaders(privateCache());
  if (adminExists()) throw redirect(303, '/login');
  return {
    tokenConfigured: Boolean(process.env.ADMIN_SETUP_TOKEN ?? ''),
    username: CANONICAL_USERNAME,
    csrfToken: locals.csrfToken
  };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    getDb();

    if (adminExists()) {
      return { error: 'The administrator account already exists.', generated: null as string | null };
    }

    const configured = process.env.ADMIN_SETUP_TOKEN ?? '';
    if (configured === '') {
      return {
        error: 'No bootstrap token is configured. Run `npm run init:admin` from the server instead.',
        generated: null
      };
    }

    const form = await request.formData();

    if (!constantTimeEqual(form.get('token')?.toString() ?? '', configured)) {
      // The same generic message covers a wrong token and an already-consumed
      // run, so neither state is confirmed to the caller.
      return { error: 'That setup token is not valid.', generated: null };
    }

    if (!csrfMatches(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { error: 'The form expired. Reload the page and try again.', generated: null };
    }

    // Claim the one-time run before creating anything, so two concurrent
    // submissions cannot both create an account.
    if (!claimSetupRun()) {
      return { error: 'Setup has already been completed.', generated: null };
    }

    const chosen = form.get('password')?.toString() ?? '';
    const displayName = (process.env.ADMIN_DISPLAY_NAME ?? '').trim() || 'Tosi Podcast';
    let password: string;
    let generated: string | null = null;

    if (chosen !== '') {
      if (chosen.length < 12) {
        return { error: 'The password needs at least 12 characters.', generated: null };
      }
      password = chosen;
    } else {
      password = generateRandomPassword();
      generated = password;
    }

    try {
      createAdmin(CANONICAL_USERNAME, displayName, password);
    } catch (error) {
      return { error: (error as Error).message, generated: null };
    }

    return { error: null, generated };
  }
};
