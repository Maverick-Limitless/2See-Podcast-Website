# Architecture

The smallest robust architecture that supports the product: one SvelteKit app,
one process, one SQLite file. No queue, no cache server, no separate database.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | SvelteKit 2, Svelte 5, TypeScript | Server-rendered public pages, form actions for the panel, one language for the whole app |
| Adapter | `@sveltejs/adapter-node` | A single standalone Node server; runs anywhere Node runs |
| Database | `node:sqlite` | Built into Node 22.5+. No native compilation, no driver, no ORM |
| Auth | Node `crypto` (scrypt) + server-side sessions | No third-party auth dependency to audit; the single-user model needs nothing more |
| Markdown | Hand-written allowlist renderer | The rendering target is raw HTML, so the renderer must be closed by construction (see below) |
| Tests | Vitest + Playwright | Unit/integration plus real-browser coverage |
| Fonts | Self-hosted WOFF2 | No external font request; licences documented |

## Request lifecycle

```
request
  → hooks.server.ts
      ├─ opens the database (migrations run on boot)
      ├─ resolves the session from the 2see_session cookie
      ├─ issues a CSRF token cookie when absent
      ├─ redirects /admin/* to /login when unauthenticated
      └─ resolve(event)
          → SvelteKit router (CSP with per-request nonce from kit.csp)
          → +page.server.ts loaders (read model)
          → +page.server.ts actions (write model, when POSTed)
  → security headers applied to the response
```

Every administrative check happens in `hooks.server.ts` on the server. Client
route guards do not exist as a security control; the server redirects before
any admin page is ever rendered for an unauthenticated visitor.

## Data model

Six tables, one row each for the singleton entities:

- `admins` — **one row, enforced by the schema**: a `UNIQUE` index on a constant
  `singleton` column plus `CHECK (id = 1)` means no code path can insert a
  second administrator. The username is fixed to `tosi-podcast`.
- `sessions` — opaque 256-bit tokens. Only a SHA-256 hash is stored, so a
  database disclosure does not yield usable sessions. Revocation and expiry are
  per row.
- `login_attempts` — the throttle journal, keyed by client address.
- `stories` — Markdown source, rendered HTML stored at write time, reading time
  computed from the actual word count.
- `episodes` — `youtube_id` is `UNIQUE`, which is the authoritative duplicate
  guard. `manually_edited` drives the synchroniser's merge policy.
- `sync_state`, `site_settings`, `setup_runs`, `content_revisions`,
  `schema_migrations` — singleton state, content identity, one-time setup
  consumption, and the cache-invalidation journal.

Migrations run on every boot inside a transaction per migration and are
recorded in `schema_migrations`; re-running is a no-op. The schema lives in
`src/lib/server/db/schema.ts` (inlined for the production bundle) and
`schema.sql` (source of truth for scripts).

## Rendering and security boundaries

- **Public pages** are server-rendered. The initial HTML carries the full
  composition; JavaScript only progressively enhances (reveal animations,
  thumbnail-first player, clipboard copy).
- **Stories** are written in Markdown and rendered once, at save time, by
  `renderMarkdown`. The HTML stored in the database is exactly what the page
  serves, so no read path ever renders user input. The renderer accepts a closed
  set of constructs and escapes everything else; 16 payload tests pin that
  behaviour (see docs/TESTING.md).
- **Episode URLs** pass through `parseYouTubeUrl`, an allowlist parser: known
  YouTube hosts only, embed URLs rejected outright, 11-character ID format
  enforced, credentials in URLs rejected. The same constraint is re-asserted at
  the repository layer.
- **Sessions** are httpOnly, SameSite=Strict, Secure in production, rotated on
  login, revoked server-side on logout, and all revoked on password change.

## Caching

- Public pages: `public, max-age=0, s-maxage=120, stale-while-revalidate=86400`
  with a weak ETag derived from the newest row of `content_revisions`. Every
  publish, unpublish, edit or delete appends to that table, so the ETag changes
  and stale copies revalidate.
- Admin pages: `no-store, no-cache, must-revalidate, private` plus `Vary:
  Cookie`. The panel is never cached by any shared proxy.
- Build assets are content-hashed by Vite and served immutable.

## Synchronisation

`syncEpisodes` pulls from the YouTube Data API when a key is configured, or
from the channel's public feed otherwise. Work is identified by video ID, so a
re-run cannot create duplicates. New videos always land as drafts: a mistake
upstream never publishes itself. Hand-edited episodes keep every human-authored
field; only the sync timestamp moves.

## Why no ORM

The whole data layer is six tables with a handful of queries each. A typed
repository module per entity keeps SQL visible and reviewable, and
`node:sqlite`'s statement objects are reused directly. An ORM would add a
dependency and a mapping layer to save a dozen one-line statements.
