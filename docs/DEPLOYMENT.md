# Deployment

The product is a single Node process with one SQLite file. Any host that runs
Node 22.5+ works: a VPS, a container, or a platform service with a persistent
filesystem.

## First run

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Then edit .env. Generate the two secrets:
openssl rand -base64 48   # SESSION_SECRET
openssl rand -hex 32      # ADMIN_SETUP_TOKEN, only if you want browser setup

# 3. Build
npm run build

# 4. Create the administrator (prints a one-time password)
npm run init:admin

# 5. Optional: import the channel's recent uploads as drafts
npm run seed:episodes

# 6. Start
npm start
```

The server listens on `HOST:PORT` (defaults `127.0.0.1:3000`).

## Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ORIGIN` | **Yes** | The absolute origin the server runs on, e.g. `https://podcast.example.com`. SvelteKit uses it to reject cross-site form posts; without it the server assumes `https://`, which breaks plain-HTTP deployments. |
| `SESSION_SECRET` | **Yes** in production | Signs session tokens. The server refuses to boot without it. |
| `DATABASE_PATH` | Yes | Path to the SQLite file. Keep it outside the web root. |
| `NODE_ENV=production` | Yes | Enables Secure cookies, HSTS and strict SameSite. |

`PUBLIC_ORIGIN` is optional but recommended: it enables absolute canonical URLs,
a `Sitemap:` line in robots.txt and absolute URLs in the sitemap. Leave it empty
rather than inventing a domain.

## Reverse proxy

Put a TLS-terminating proxy in front (Caddy, nginx, a platform edge). The app
binds to `127.0.0.1` by default. Forward:

- `Host` and `X-Forwarded-For` (used for the login throttle)
- `X-Forwarded-Proto` (used to build request URLs)

With Caddy:

```
podcast.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

## Secrets

- `.env` is git-ignored; verify with `git status` before ever committing.
- Rotate `SESSION_SECRET` by changing the value and restarting. This signs out
  everyone (by design).
- The admin password is rotated from Settings → Password, which revokes all
  sessions, or with `npm run init:admin -- --force` from the server.
- The YouTube API key is optional and lives only in the environment. It is
  never rendered in the browser.

## YouTube configuration

Without any YouTube configuration, manual episode entry works fully. For
automatic synchronisation:

- `YOUTUBE_CHANNEL_ID` — public feed mode, no key. Limited to the channel's
  most recent uploads; no duration data.
- `YOUTUBE_API_KEY` — Data API mode: full archive paging and duration.

Create a key at <https://console.cloud.google.com/apis/library/youtube.googleapis.com>,
enable the YouTube Data API v3, and restrict the key to that API. Quota: a
sync costs a handful of units per page; the default daily quota is ample for an
hourly schedule. To schedule, use cron:

```
0 * * * * cd /srv/2see && npm run sync:episodes >> /var/log/2see-sync.log 2>&1
```

## Backups and restore

```bash
# Backup: a consistent, timestamped copy (SQLite's own backup API)
npm run db:backup

# Restore
npm run db:restore -- ./data/backups/2026-10-16T120000.db
```

Backups use `VACUUM INTO`, which produces a compacted, integrity-checked copy
while the server keeps running. The `data/` directory is git-ignored: a backup
is a file you keep, not a commit you push.

## Upgrades

```bash
git pull
npm install
npm run build        # migrations run automatically on next boot
npm start
```

Migrations are per-migration transactions and are recorded, so an interrupted
upgrade either applied cleanly or did not start.

## Health check

`GET /` returning 200 is the cheapest liveness probe. `GET /robots.txt` also
works and touches the database.
