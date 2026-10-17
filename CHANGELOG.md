# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-10-16

First release. Source-available under the proprietary licence in `LICENSE`.

### Added

- Public site: homepage with editorial hero and real Persian content, episodes
  archive with Persian search, episode detail with a thumbnail-first official
  YouTube embed, stories archive, article detail, about page, 404 and error
  routes, sitemap and robots.txt.
- Publishing panel: single administrator (`tosi-podcast`), Markdown stories
  with server-rendered preview, manual YouTube episode entry with duplicate
  prevention, synchronisation from the YouTube Data API or the public feed,
  publish/unpublish/delete with confirmation, site settings and password
  rotation.
- Security: schema-enforced single admin, scrypt password hashing, hashed
  server-side session tokens with rotation, CSRF on every action, database-
  backed login throttling, allowlisted Markdown renderer, allowlisted YouTube
  URL parser, per-request nonce CSP, no-store caching on all private routes.
- PWA: manifest, icons, service worker with an honest offline fallback that
  never caches admin or authenticated content.
- Test suite: 99 Vitest unit/integration tests and 20 Playwright browser tests.
- Documentation: research, architecture, deployment, content management,
  customization, testing, security, licensing and third-party notices.
- Verified content seeded from the channel's public feed, with original
  Persian titles and descriptions preserved.

### Design

- Art direction derived from the programme's own artwork: warm ivory reading
  ground, the show's near-black navy for featured surfaces, one amber accent
  sampled from the published thumbnails.
- Archivo / Newsreader / Vazirmatn type system, self-hosted with unicode-range
  subsetting; full Persian shaping with RTL isolation.
- Pinterest-inspired discovery grid with server-decided column spans.
- Documented motion system; `prefers-reduced-motion` fully respected.
- Responsive from 320px with zero horizontal overflow on every page.
