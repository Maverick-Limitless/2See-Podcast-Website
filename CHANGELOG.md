# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.2] — 2026-10-19

### Fixed

- The development secret fallback now covers CSRF signing. A server started
  with no secrets at all booted but then failed every request with "CSRF
  secret is not configured" — `npm run dev` on a clean checkout could not
  render a page.
- "Load more" on the episodes and stories archives appends the next batch in
  place instead of replacing the list with a bare page 2, keeps the active
  search and filters in the URL, and holds the reader's exact position across
  the append. Browser Back returns to the first batch.
- The episode card and the episode page no longer render a summary that
  merely repeats the title — ten of the channel's fifteen videos carry no
  description beyond the title — and the episode page no longer doubles the
  format name with a matching category badge.
- The display headline's reveal masks clip with `overflow-clip-margin:
  0.25em`: Archivo's descender ink reaches about 18px past the 0.96 line
  box, and a descender landing on a mask's last wrapped line would have been
  cut. The block's geometry is unchanged.
- Phone navigation reaches the 44px touch-target height through an expanded
  hit area, without changing the visual size of the links.
- The glass caption scrim's gradient floor was raised to alpha 0.68: the
  summary-dedup change made overlay captions shorter, which sat their text
  higher in the old gradient where the worst-case (pure-white thumbnail)
  contrast fell to 4.34:1, below WCAG AA. Measured worst-case contrast is now
  6.23:1 (`scripts/scrim-contrast.mjs`).
- Admin tables label their actions column for screen readers, and the
  episodes table's date column is headed "Published at" so it no longer
  reads as a second status column.

### Changed

- The browser test suite is fully self-contained and reproducible.
  `scripts/e2e-setup.mjs` rebuilds the test database from the committed
  fixture `tests/fixtures/e2e-episodes.json` (the channel's real, published
  metadata) and creates the administrator with a deterministic test password
  through the production `init-admin` script, and `playwright.config.ts`
  boots the server with explicit test-only secrets. Previously every "green"
  run had in fact been testing a manually started server; the committed
  harness could not start its own.
- Test counts: 106 unit + integration, 21 browser (127 automated tests).
- The documentation gallery was re-captured from the final build: 14 routes
  and states including the mobile archive, the sign-in screen, both editors,
  the empty-search state and the appended "load more" state, with a
  screenshot index at `docs/assets/screenshots/README.md`.
- New measurement harnesses: `scripts/visual-audit.mjs` checks touch targets
  at mobile widths and covers the sign-in route; `scripts/design-audit.mjs`
  records the design system's real proportions; `scripts/capture-screenshots.mjs`
  makes the gallery reproducible.

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
