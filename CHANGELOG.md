# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1] — 2026-10-18

### Fixed

- Restored the documented npm script names (`test:e2e`, `init:admin`,
  `db:migrate`, `seed:episodes`, …) after a programmatic rewrite had dropped
  their colons, leaving every document referencing commands that did not run.
- Added the required `ORIGIN` variable to `.env.example`: SvelteKit uses it to
  decide which origin is "same site" for form posts, and a plain-HTTP
  deployment rejects every login without it.
- Three `svelte-check` errors from the redesign phases (a missing `enhance`
  import, an untyped `requestSubmit`, related episodes passed to the card
  without a span class) — all now zero.
- Persian episode cards: the publication date is now isolated left-to-right
  inside the right-to-left caption, so "12 Oct 2026" no longer bidi-reorders
  to "Oct 2026 12". (Found by the vision model, confirmed by DOM measurement.)
- The desktop opening panel keeps the artwork at its native 16:9 instead of
  stretching taller and cropping the artwork's own labels at the sides.

### Added

- Product documentation: a rewritten README with real screenshots, a product
  brief with graded complexity and risks, and a six-part pitch deck — all
  built from verified facts only.
- `docs/assets/screenshots/` — nine real captures of the final build,
  including the admin panel with test data, reviewed by the vision model over
  three cycles (findings triaged against the DOM; two false positives
  rejected with measurements).

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
