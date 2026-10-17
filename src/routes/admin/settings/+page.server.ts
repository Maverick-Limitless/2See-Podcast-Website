import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getSettings, saveSettings, type SettingsInput } from '$lib/server/content/settings';
import { getSyncState } from '$lib/server/youtube/sync';
import { updateAdminPassword } from '$lib/server/auth/admin-repository';
import {
  optionalText,
  requireText,
  requireUrl,
  ValidationFailure
} from '$lib/server/content/validate';
import { privateCache } from '$lib/server/http/cache';
import { config } from '$lib/server/config';
import { revokeAllSessions, SESSION_COOKIE } from '$lib/server/auth/session';

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders(privateCache());
  getDb();
  return {
    site: getSettings(),
    sync: getSyncState(),
    // Secrets are never sent to the browser. These flags only say whether each
    // setting has a value, so the panel can show "configured" without exposing
    // the value itself.
    configured: {
      youtubeApiKey: config.youtubeApiKey !== '',
      sessionSecret: config.sessionSecret !== ''
    }
  };
};

function verifyCsrf(presented: string, expected: string): boolean {
  if (presented === '' || expected === '') return false;
  return Buffer.from(presented).equals(Buffer.from(expected));
}

function readHosts(form: FormData): { name: string; latinName: string; role: string; credentials: string }[] {
  const raw = form.get('hosts')?.toString() ?? '';
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [name, latinName = '', role = 'Host', credentials = ''] = line.split('|').map((part) => part.trim());
      return { name: name!, latinName, role, credentials };
    });
}

function readSocial(form: FormData): { label: string; url: string }[] {
  const raw = form.get('socialLinks')?.toString() ?? '';
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .flatMap((line) => {
      const [label, url] = line.split('|').map((part) => part.trim());
      if (!label || !url) return [];
      return [{ label, url }];
    });
}

export const actions: Actions = {
  save: async ({ request, locals }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired. Reload the page and try again.' };
    }

    try {
      const input: SettingsInput = {
        siteTitle: requireText(form.get('siteTitle'), 'Site title', { maxLength: 120 }),
        tagline: optionalText(form.get('tagline'), 'Tagline', { maxLength: 200 }),
        description: optionalText(form.get('description'), 'Description', { maxLength: 500 }),
        channelUrl: requireUrl(form.get('channelUrl') ?? '', 'Channel URL'),
        aboutBody: optionalText(form.get('aboutBody'), 'About', { maxLength: 8000 }),
        contactNote: optionalText(form.get('contactNote'), 'Contact note', { maxLength: 1000 }),
        hosts: readHosts(form),
        socialLinks: readSocial(form),
        footerNote: optionalText(form.get('footerNote'), 'Footer note', { maxLength: 1000 })
      };
      saveSettings(input);
      return { ok: true, message: 'Settings saved.' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof ValidationFailure ? error.message : (error as Error).message
      };
    }
  },

  password: async ({ request, locals, cookies }) => {
    getDb();
    const form = await request.formData();
    if (!verifyCsrf(form.get('csrf')?.toString() ?? '', locals.csrfToken)) {
      return { ok: false, error: 'The form expired. Reload the page and try again.' };
    }

    const current = form.get('currentPassword')?.toString() ?? '';
    const next = form.get('nextPassword')?.toString() ?? '';
    const confirm = form.get('confirmPassword')?.toString() ?? '';

    if (next !== confirm) return { ok: false, error: 'The new passwords do not match.' };
    if (next.length < 12) return { ok: false, error: 'The new password needs at least 12 characters.' };

    if (!updateAdminPassword(current, next)) {
      return { ok: false, error: 'The current password is not correct.' };
    }

    // Rotating the password invalidates every existing session, including this
    // one, so the owner must sign in again with the new credential.
    revokeAllSessions(locals.admin?.id ?? 1);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login?rotated=1');
  }
};
