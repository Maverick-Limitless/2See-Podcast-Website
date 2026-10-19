# Testing

Three layers, all run against real code — no mocks of the modules under test
except where a network boundary requires it.

## Commands

```bash
npm test          # Vitest: 106 unit + integration tests
npm run test:e2e  # Playwright: 21 browser tests (Chromium)
npm run check     # svelte-check + TypeScript
```

The browser suite is fully self-contained. `scripts/e2e-setup.mjs`, run
automatically by `playwright.config.ts` before the server boots, recreates the
test database from the committed fixture `tests/fixtures/e2e-episodes.json`
(the channel's real, published episode metadata) and creates the single
administrator through the same `init-admin` script production uses. From a
clean checkout, `npm run build && npm run test:e2e` is all the suite needs.
When a server is already running, set `E2E_SKIP_WEBSERVER=1` and
`E2E_BASE_URL` to test against it instead.

Test credentials: the browser suite signs in as `tosi-podcast` with
`local-e2e-password-placeholder`, unless `E2E_ADMIN_PASSWORD` says otherwise.
It is a deterministic test value — never a real credential, and it appears in
no production path.

## Layer 1 — unit (Vitest)

**YouTube URL parsing (14 tests).** Watch, `youtu.be`, `/shorts/`, bare-domain
and playlist-carrying URLs parse to the correct ID. Rejections: non-YouTube
hosts, embed URLs (so no arbitrary iframe target can be accepted), the
privacy-enhanced embed host, wrong-length IDs, credentials in URLs, channel and
playlist pages without a single video, empty and non-string input. Thumbnail
and watch URL construction.

**Markdown and XSS (29 tests).** Every supported construct renders; and 16
attack payloads — `<script>`, handler attributes, `javascript:`/`vbscript:`/
`data:text/html` URLs, SVG, iframes, objects, forms, base/meta injection, and
an HTML-parser-confusion payload — are all rendered inert, verified against the
actual output rather than a hand-picked list of "bad strings". Link protocols
are allowlisted. Word counting, reading time, heading-id uniqueness including
Persian input, and plain-text extraction are covered.

**YouTube client (11 tests).** ISO-8601 durations, display formatting, and the
public-feed parser: entity decoding, limit honoured, malformed entries skipped,
empty feeds.

**Configuration secret fallback (4 tests).** The clean-checkout path: both
secrets bootstrapped together (a server that boots must also be able to sign
CSRF tokens), single-secret derivation, a dedicated CSRF secret kept, and the
production refusal to run without a real session secret.

**Archive URLs (3 tests).** "Load more" and the format chips build their URLs
through one helper that carries the whole filter state, so pagination can never
silently drop an active search.

## Layer 2 — integration (Vitest, real SQLite)

Every file gets a fresh temporary database, so no test touches `./data`.

**Authentication (20 tests).**
- Single-admin enforcement: creation under the canonical username; refusal of a
  second account; refusal of any other username; and the decisive test — a raw
  SQL insert of a second row fails, proving the constraint lives in the schema.
- One-time setup consumed exactly once.
- Credential verification: correct accept, wrong reject; wrong username and
  wrong password are indistinguishable; rejection when no account exists;
  nothing resembling the plaintext password in the stored row; salt length and
  parameter format; password change gated on the current password.
- Sessions: resolution, forged-token rejection, only a hash stored, single
  revoke, idempotent revoke, rotation killing the old token, revoke-all.
- Throttling: block at the configured limit, per-client isolation, and a
  successful attempt not lifting an existing block.

**Content (25 tests).**
- Episodes: creation and slugs; the same video ID rejected twice, reporting the
  existing entry; Persian titles stored verbatim; malformed IDs rejected before
  storage; guest lists normalised.
- States: drafts invisible publicly; publish makes an episode public;
  unpublish hides it; delete removes it.
- Series detection for Persian episode numbers and English calendar-week briefs.
- Stories: body rendered once at write time, reading time from real content,
  draft/publish/unpublish transitions, deterministic unique slugs, XSS-in-body
  stored inert, featured-first ordering, deletion.
- Search: Persian query across titles, format filters, cumulative pagination
  ("load more" appends the next batch in place, without duplicating rows, and
  a page beyond the last shows everything), empty results.
- Cache invalidation: the revision token changes when content changes.

## Layer 3 — browser (Playwright, real Chromium)

**Public site (12 tests).** The homepage renders the hero with real Persian
content and no fabricated engagement metrics; navigation to the archive;
Persian search filters and clears with a real empty state; "load more"
appends the next batch beneath the first (no duplicates, the reader's
position in the viewport is held, the control disappears when the archive is
exhausted, and browser Back returns to the first batch); an episode page
shows metadata, a thumbnail-first player (no iframe until the visitor clicks,
then the `youtube-nocookie` embed), and the official YouTube link; keyboard
navigation reaches the skip link first with a visible outline; reduced motion
collapses animations; a missing page shows the 404 route; robots and sitemap
exclude admin routes; the PWA manifest is valid and every icon is served; every
page has a unique title, description and canonical; public pages are cacheable
but never private. Console errors and failed first-party requests are collected
and asserted per test.

**Publishing panel (9 tests).** The login page has no registration path; a
wrong password is refused generically and sets no session; all four protected
routes redirect when signed out; the full story flow — draft, publish, live on
the public site, unpublish, confirm-delete; a duplicate YouTube video is
refused by ID; a non-YouTube URL is rejected before storage; sign-out closes
the panel again; secrets never reach the browser; a password change requires
the current one.

## What is not covered

- Firefox and WebKit: Playwright is configured for Chromium only in this
  environment. The project's component CSS is standard and the flows are
  framework-driven, so cross-engine risk is low, but it is not *proven* here.
- A genuine PWA installation: manifest validity, icon serving, service-worker
  registration and the offline fallback are tested; an actual
  add-to-home-screen prompt requires an interactive OS session and was not
  performed.
- YouTube Data API calls: the client is exercised through its parser and the
  synchroniser through its idempotency tests; live API calls need a billable
  key and are not part of the suite. The public-feed path is tested end to end.
- Accessibility beyond automated checks: focus order, focus visibility,
  contrast, labels, heading hierarchy and reduced motion are machine-checked;
  a full human screen-reader pass was not performed and is the one gap worth
  closing before launch.
- Performance: build size and correctness are verified; no Lighthouse run was
  executed in this environment, so no score is claimed.
