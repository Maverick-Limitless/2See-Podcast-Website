# 2See Podcast — independent website concept

A premium editorial website and a minimal, secure single-user publishing panel for
**2See Podcast**, built as an independent concept project.

Design by Maverick Limitless.

> This is an independent website concept and is not affiliated with or endorsed by
> 2See Podcast unless expressly authorised. Episode titles, descriptions, artwork and
> trademarks belong to their respective owners.

---

## What this is

A Pinterest-inspired digital publication for a podcast that publishes long Persian-language
conversations and a weekly English briefing, at the meeting point of technology, business
and policy.

The visual direction is derived from the programme's own artwork: a near-black navy ground,
warm paper tones, and one restrained amber accent sampled from the channel's thumbnails.
Type pairs a grotesque display face (Archivo) with a reading serif (Newsreader), and
Vazirmatn carries Persian text with correct shaping.

## What is included

- Public site: home, episodes archive, episode detail, stories archive, article detail,
  about, 404, sitemap, robots.txt
- Publishing panel: stories (manual articles, Markdown) and episodes (manual YouTube entry
  and automatic synchronisation)
- Single administrative account, username `tosi-podcast`
- Installable PWA with an honest offline fallback
- Automated tests: 99 unit and integration tests, plus browser tests

## Requirements

- Node.js 22.5 or newer (the database is Node's built-in `node:sqlite`, so there is no
  native module to compile)
- npm 10 or newer

## Running it

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template and fill in every placeholder
cp .env.example .env

# 3. Generate a session secret and set ORIGIN (see .env.example)
openssl rand -base64 48

# 4. Create the one administrator account
npm run init:admin

# 5. Seed real episode metadata from the channel's public feed (optional)
npm run seed:episodes

# 6. Run the production build
npm run build

# 7. Start the server
npm start
```

The development server is `npm run dev`.

## How the first admin account works

There is exactly one administrator, and a fresh checkout has **no** working password.
The account is initialised by the deployment owner, in one of two ways:

**Option A — command line (recommended).** `npm run init:admin` generates a
cryptographically secure random password, hashes it with scrypt, stores only the hash, and
prints the password once. Nothing is written to disk and nothing is committed to Git.

**Option B — one-time browser setup.** Set `ADMIN_SETUP_TOKEN` to a random value (a separate
token from the password), then visit `/setup` once. The route refuses to work once an
administrator exists and never accepts a second account.

The generated credential can be rotated at any time from Settings inside the panel, which
also signs out every session.

## Configuring YouTube synchronisation

Episode entry works with no configuration at all: paste a watch, share or `/shorts/` URL into
the panel and the metadata is yours to edit.

For automatic synchronisation, set one or both of:

- `YOUTUBE_CHANNEL_ID` — enables the public feed, which carries the channel's most recent
  uploads with no API key. It is limited by YouTube and has no duration data.
- `YOUTUBE_API_KEY` — enables the YouTube Data API, which can page through the full archive
  and returns duration.

The API key is never sent to the browser, never logged, and never returned by any endpoint.

## Testing

```bash
npm test          # unit and integration tests (99 tests)
npm run test:e2e  # browser tests in Chromium
npm run check     # types and Svelte checks
```

See [docs/TESTING.md](docs/TESTING.md) for what is covered and what is not.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data model, request lifecycle |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | First-run setup, secrets, backups, restart |
| [docs/CONTENT-MANAGEMENT.md](docs/CONTENT-MANAGEMENT.md) | Writing stories and adding episodes |
| [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) | Design tokens, colours, type, content |
| [docs/TESTING.md](docs/TESTING.md) | Test approach and coverage |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and audit notes |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Verified facts and sources |
| [docs/LICENSING.md](docs/LICENSING.md) | Source-available licence model |
| [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md) | Fonts and asset licences |

## Licensing

Source-available under a proprietary licence. Public visibility is not a commercial
licence; commercial deployment requires explicit written permission. Third-party assets
(fonts, episode content) remain under their own licences. See
[docs/LICENSING.md](docs/LICENSING.md).

## Design credit

Design by Maverick Limitless.
