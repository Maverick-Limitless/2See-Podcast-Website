import { getDb } from '../db';
import { recordRevision } from '../http/cache';
import type { HostProfile, SiteSettings } from '../../shared/types';

/**
 * Site settings repository.
 *
 * Defaults describe the real podcast using only information verified from the
 * channel's own public page (see docs/RESEARCH.md). Nothing here is a claim of
 * endorsement or authorisation.
 */

export const DEFAULT_SETTINGS: SiteSettings = {
  siteTitle: '2See Podcast',
  tagline: 'Two academic paths, one shared love of learning',
  description:
    'An independent editorial website concept for 2See Podcast: technology, business and policy, made understandable.',
  channelUrl: 'https://www.youtube.com/@2See.Podcast',
  channelHandle: '@2See.Podcast',
  hosts: [
    {
      name: 'صالح دادخواهی‌پور',
      latinName: 'Saleh Dadkhahipour',
      role: 'Host',
      credentials: 'MBA, Stanford GSB; MPA, Harvard Kennedy School'
    },
    {
      name: 'مهرزاد سجادی',
      latinName: 'Mehrzad Sajjadi',
      role: 'Host',
      credentials: 'MBA & MS CS, Stanford; Biotechnology master’s, Harvard.'
    }
  ],
  aboutBody:
    '2See Podcast is hosted by two classmates at the meeting point of technology, business, and policy. Its stated aim is to make complex ideas understandable and to connect classroom thinking to real life.\n\nThe programme publishes long Persian-language conversations with guests and entrepreneurs, and a weekly English briefing called 2See Brief that carries a summary of the week’s developments in the same territory.',
  contactNote:
    'This is an independent website concept and is not affiliated with or endorsed by 2See Podcast unless expressly authorised. All audience contact with the programme itself happens through the official YouTube channel.',
  defaultOgImage: '/og-default.svg',
  socialLinks: [{ label: 'YouTube', url: 'https://www.youtube.com/@2See.Podcast' }],
  footerNote:
    'Website design and implementation by Maverick Limitless. Podcast content, episode titles, artwork and trademarks belong to their respective owners.'
};

interface SettingsRow {
  site_title: string;
  tagline: string;
  description: string;
  channel_url: string;
  about_body: string;
  contact_note: string;
  social_links: string;
  hosts: string;
  footer_note: string;
}

function parseHosts(raw: string): HostProfile[] {
  if (raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SETTINGS.hosts;
    const hosts: HostProfile[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.name !== 'string') continue;
      hosts.push({
        name: record.name,
        latinName: typeof record.latinName === 'string' ? record.latinName : '',
        role: typeof record.role === 'string' ? record.role : 'Host',
        credentials: typeof record.credentials === 'string' ? record.credentials : ''
      });
    }
    return hosts.length > 0 ? hosts : DEFAULT_SETTINGS.hosts;
  } catch {
    return DEFAULT_SETTINGS.hosts;
  }
}

function parseSocial(raw: string): { label: string; url: string }[] {
  if (raw.trim() === '') return DEFAULT_SETTINGS.socialLinks;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SETTINGS.socialLinks;
    const links: { label: string; url: string }[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      if (typeof record.url !== 'string' || typeof record.label !== 'string') continue;
      if (!/^https?:\/\//.test(record.url)) continue;
      links.push({ label: record.label.slice(0, 40), url: record.url.slice(0, 500) });
    }
    return links.length > 0 ? links : DEFAULT_SETTINGS.socialLinks;
  } catch {
    return DEFAULT_SETTINGS.socialLinks;
  }
}

export function getSettings(): SiteSettings {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT site_title, tagline, description, channel_url, about_body,
              contact_note, social_links, hosts, footer_note
         FROM site_settings WHERE id = 1`
    )
    .get() as SettingsRow | undefined;

  if (!row) return { ...DEFAULT_SETTINGS };

  return {
    siteTitle: row.site_title || DEFAULT_SETTINGS.siteTitle,
    tagline: row.tagline,
    description: row.description || DEFAULT_SETTINGS.description,
    channelUrl: row.channel_url || DEFAULT_SETTINGS.channelUrl,
    channelHandle: DEFAULT_SETTINGS.channelHandle,
    hosts: parseHosts(row.hosts),
    aboutBody: row.about_body,
    contactNote: row.contact_note,
    defaultOgImage: DEFAULT_SETTINGS.defaultOgImage,
    socialLinks: parseSocial(row.social_links),
    footerNote: row.footer_note || DEFAULT_SETTINGS.footerNote
  };
}

export interface SettingsInput {
  siteTitle: string;
  tagline: string;
  description: string;
  channelUrl: string;
  aboutBody: string;
  contactNote: string;
  hosts: HostProfile[];
  socialLinks: { label: string; url: string }[];
  footerNote: string;
}

export function saveSettings(input: SettingsInput): void {
  const db = getDb();
  const hosts = input.hosts
    .filter((host) => host.name.trim() !== '')
    .map((host) => ({
      name: host.name.slice(0, 120),
      latinName: host.latinName.slice(0, 120),
      role: host.role.slice(0, 60),
      credentials: host.credentials.slice(0, 300)
    }))
    .slice(0, 8);
  const links = input.socialLinks
    .filter((link) => link.url.trim() !== '')
    .map((link) => ({
      label: link.label.slice(0, 40),
      url: link.url
        .trim()
        .slice(0, 500)
    }))
    .slice(0, 10);

  db.prepare(
    `INSERT INTO site_settings (id, site_title, tagline, description, channel_url, about_body,
        contact_note, social_links, hosts, footer_note, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT (id) DO UPDATE SET
       site_title = excluded.site_title,
       tagline = excluded.tagline,
       description = excluded.description,
       channel_url = excluded.channel_url,
       about_body = excluded.about_body,
       contact_note = excluded.contact_note,
       social_links = excluded.social_links,
       hosts = excluded.hosts,
       footer_note = excluded.footer_note,
       updated_at = excluded.updated_at`
  ).run(
    input.siteTitle.slice(0, 120),
    input.tagline.slice(0, 200),
    input.description.slice(0, 500),
    input.channelUrl,
    input.aboutBody.slice(0, 8000),
    input.contactNote.slice(0, 1000),
    JSON.stringify(links),
    JSON.stringify(hosts),
    input.footerNote.slice(0, 1000)
  );
  recordRevision('settings', null, 'updated');
}
