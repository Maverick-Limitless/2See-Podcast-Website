import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import {
  adminExists,
  createAdmin,
  getAdminUsername,
  touchLogin,
  verifyAdminCredential
} from '$lib/server/auth/admin-repository';
import {
  checkLoginRateLimit,
  recordLoginAttempt
} from '$lib/server/auth/rate-limit';
import { createSession, SESSION_COOKIE } from '$lib/server/auth/session';
import { privateCache } from '$lib/server/http/cache';

/**
 * Login.
 *
 * The response to a failed attempt is identical whether the username is wrong
 * or the password is wrong, and it is identical whether or not the account
 * exists. Rate limiting is by client address. A valid session cookie is
 * rotated on success so a token captured before login is invalid afterwards.
 */

const GENERIC_ERROR = 'Incorrect username or password.';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  setHeaders(privateCache());
  // If the account has never been created, the login page is not the answer.
  if (!adminExists()) {
    const hasToken = Boolean(process.env.ADMIN_SETUP_TOKEN);
    throw redirect(303, hasToken ? '/setup' : '/admin/uninitialised');
  }
  return {
    username: getAdminUsername() ?? '',
    next: safeNext(url.searchParams.get('next')),
    csrfToken: locals.csrfToken
  };
};

function safeNext(value: string | null): string {
  if (value === null) return '/admin';
  // Only same-site relative paths. Never an absolute URL or a protocol-relative
  // //host, which would turn this into an open-redirect helper.
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('://')) {
    return value.slice(0, 200);
  }
  return '/admin';
}

export const actions: Actions = {
  login: async ({ request, cookies, locals, getClientAddress }) => {
    getDb();
    const form = await request.formData();
    const submitted = form.get('csrf')?.toString() ?? '';
    const expected = locals.csrfToken;

    const csrfOk =
      submitted !== '' &&
      expected !== '' &&
      submitted.length === expected.length &&
      (() => {
        // Constant-time compare of the signed token.
        const a = Buffer.from(submitted);
        const b = Buffer.from(expected);
        return a.equals(b);
      })();

    if (!csrfOk) {
      return fail(400, { error: 'The form expired. Please try again.' });
    }

    const username = (form.get('username')?.toString() ?? '').slice(0, 64);
    const password = form.get('password')?.toString() ?? '';
    const address = getClientAddress();

    const verdict = checkLoginRateLimit(address);
    if (!verdict.allowed) {
      return fail(429, {
        error: `Too many attempts. Try again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minutes.`
      });
    }

    const result = verifyAdminCredential(username, password);
    recordLoginAttempt(address, username, result.ok);

    if (!result.ok) {
      // Identical message for a wrong username and a wrong password.
      return fail(401, { error: GENERIC_ERROR });
    }

    // Session rotation: issue a fresh token, invalidating any earlier one.
    const { token } = await createSession(result.id, {
      ipAddress: address,
      userAgent: request.headers.get('user-agent') ?? ''
    });
    cookies.set(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 43200)
    });
    touchLogin();

    throw redirect(303, safeNext(form.get('next')?.toString() ?? null));
  }
};
