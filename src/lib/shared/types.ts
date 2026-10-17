/**
 * Types shared between server and browser.
 *
 * These are deliberately plain data shapes with no server-only imports so they
 * can be used inside `+page.server.ts` loaders, form actions and components.
 */

export type PublicationState = 'draft' | 'published';

export interface SiteSettings {
  siteTitle: string;
  tagline: string;
  description: string;
  channelUrl: string;
  channelHandle: string;
  hosts: HostProfile[];
  aboutBody: string;
  contactNote: string;
  defaultOgImage: string;
  socialLinks: { label: string; url: string }[];
  footerNote: string;
}

export interface HostProfile {
  name: string;
  latinName: string;
  role: string;
  credentials: string;
}

export interface Story {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  bodyMarkdown: string;
  bodyHtml: string;
  coverImage: string;
  coverAlt: string;
  coverCaption: string;
  category: string;
  tags: string[];
  author: string;
  state: PublicationState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingMinutes: number;
  wordCount: number;
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
}

export interface StorySummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  coverImage: string;
  coverAlt: string;
  category: string;
  author: string;
  state: PublicationState;
  publishedAt: string | null;
  readingMinutes: number;
  featured: boolean;
  spanClass: string;
}

export interface Episode {
  id: number;
  slug: string;
  youtubeId: string;
  title: string;
  originalTitle: string;
  summary: string;
  description: string;
  guests: string[];
  hostNames: string[];
  series: string;
  episodeNumber: number | null;
  category: string;
  tags: string[];
  thumbnail: string;
  durationSeconds: number | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  state: PublicationState;
  language: 'fa' | 'en';
  format: 'episode' | 'brief' | 'short';
  featured: boolean;
  metaTitle: string;
  metaDescription: string;
  syncedAt: string | null;
  syncSource: 'manual' | 'api' | 'feed' | 'seed' | null;
}

export interface EpisodeSummary {
  id: number;
  slug: string;
  youtubeId: string;
  title: string;
  originalTitle: string;
  summary: string;
  guests: string[];
  series: string;
  episodeNumber: number | null;
  category: string;
  thumbnail: string;
  durationSeconds: number | null;
  publishedAt: string;
  state: PublicationState;
  language: 'fa' | 'en';
  format: 'episode' | 'brief' | 'short';
  featured: boolean;
  spanClass: string;
}

export interface SyncState {
  id: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: 'never' | 'running' | 'ok' | 'partial' | 'error';
  lastMessage: string;
  lastFoundCount: number;
  lastCreatedCount: number;
  lastUpdatedCount: number;
  totalSyncedCount: number;
  source: 'api' | 'feed' | null;
  cursor: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  categories: string[];
  query: string;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}
