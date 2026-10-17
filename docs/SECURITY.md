# Security model

This document describes what the code enforces, what the operator must do, and
what was audited before release.

## The one account

- Exactly one administrator exists. The schema enforces it: `admins` has
  `CHECK (id = 1)`, a `CHECK (singleton = 1)` column, and a `UNIQUE` index on
  that constant, so a second row is impossible at the database layer, not merely
  hidden in the interface. A test writes raw SQL to prove it.
- The username is fixed to `tosi-podcast`.
- There is no registration route, no user-management screen, no social login,
  no roles. The login page states that one account exists.
- A fresh checkout contains **no** credential. `npm run init:admin` generates a
  cryptographically secure random password and prints it once; only a scrypt
  hash is stored. The one-time browser setup at `/setup` requires
  `ADMIN_SETUP_TOKEN`, is consumed on first use, and refuses to run again.

## Credential handling

The initial password never appears in:

- source code, Git history, or any committed file
- client-side JavaScript, browser storage, cookies or URLs
- logs, error messages, or API responses

Rotation: Settings → Password requires the current password, revokes every
session, and forces a fresh sign-in. `npm run init:admin -- --force` replaces
the account from the server (also revoking all sessions) when the password is
lost. Recovery from a lost password requires server access — by design, since
there is only one user and no email flow.

## Session security

- Tokens are 256-bit random values; only a SHA-256 hash is stored.
- Cookies are `HttpOnly`, `SameSite=Strict`, `Secure` in production, with a
  configured TTL.
- Sessions rotate on successful login (the pre-login token is revoked), are
  revoked server-side on logout, and all are revoked on password change.
- Expiry is checked both in SQL and in JavaScript, so a clock change cannot
  resurrect a dead session.
- Expired and revoked sessions are pruned at most once a minute during normal
  traffic.

## CSRF

Three layers:

1. SvelteKit's built-in origin check rejects cross-site form posts.
2. Every admin form carries a signed token; every action verifies it in
   constant time before touching data. A missing or stale token fails the
   action and writes nothing (verified by a browser test).
3. Cookies are SameSite=Strict in production.

## Login throttling

Failed and successful attempts are recorded per client address in the
database (not memory), so the limit survives a restart. Above the configured
limit the response is `429 Too Many Attempts` with a retry window. A test
drives eight failures and confirms the ninth is blocked.

## Content security

- **Markdown**: rendered once at write time by a closed, allowlisted renderer.
  Raw HTML in the source is escaped, never passed through. Sixteen XSS
  payloads — including script tags, handler attributes, `javascript:` URLs,
  SVG, and an HTML-parser-confusion payload — are pinned by unit tests.
- **Episode URLs**: an allowlist parser accepts only youtube.com and youtu.be
  watch/share/shorts URLs with a valid 11-character ID. Embed URLs and
  non-YouTube hosts are rejected before anything is stored, and the repository
  re-asserts the ID format.
- **Uploaded values**: there is no file upload surface in this version. Cover
  images are referenced by validated URL (YouTube image hosts only for
  episodes), which removes the upload attack surface entirely; the trade-off
  is documented in docs/CONTENT-MANAGEMENT.md.
- **SQL**: every query is a prepared statement with bound parameters. No query
  concatenates user input.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, `Origin-Agent-Cluster`, HSTS in
  production, and a Content Security Policy generated per request by SvelteKit
  with a nonce for its own bootstrap — so `script-src` can stay closed without
  `unsafe-inline`.

## Cache isolation

Admin HTML and every admin API response are `no-store, no-cache,
must-revalidate, private` with `Vary: Cookie`. One visitor's session can never
be served to another from any cache. Public pages carry a revision-derived
ETag so a stale copy revalidates the moment content changes. The service worker
never caches `/admin`, `/login`, `/setup` or `/logout`.

## Secrets

All secrets come from the environment (`.env`, git-ignored; see
`.env.example` for placeholders and generation commands). `SESSION_SECRET` is
required in production and the server refuses to boot without it. API keys are
never sent to the browser — a browser test asserts the settings screen reports
only whether a key is configured, never its value.

## Audit checklist (all verified by tests where automatable)

| Area | Result |
| --- | --- |
| Single-admin enforcement | DB-level, tested with a raw-SQL insert attempt |
| Password hashing | scrypt N=32768, r=8, p=1, 64-byte key, per-account salt |
| Plaintext storage | Absent; a test reads the stored row and asserts it |
| Login messages | Identical for wrong username and wrong password |
| Constant-work verification | Missing accounts burn the same scrypt cost |
| Session token storage | Hash only; tested |
| Session rotation / revocation | Tested for single, rotate and revoke-all paths |
| Rate limiting | Tested to the block, and for cross-client isolation |
| CSRF | Tested: stale token rejected, nothing written |
| Markdown XSS | 16 payloads tested |
| YouTube URL injection | Non-YouTube hosts and embed URLs rejected in tests |
| Duplicate episodes | UNIQUE video ID; repository and browser tests |
| Protected routes | Redirect tested signed-out, in four browsers flows |
| Cache isolation | Header asserted in browser tests |
| Secrets in the browser | Asserted absent from the settings screen |
| Migration safety | Transactional, recorded, idempotent; WAL set outside the transaction |
| Backup/restore | Documented in docs/DEPLOYMENT.md |

## Known limitations

- Rate limiting is per server process and per database. A deployment behind a
  pool of app servers sharing one database still throttles correctly; one with
  several independent databases would not. Single-server is the supported
  topology.
- There is no file upload; cover images are URLs. See docs/CONTENT-MANAGEMENT.md.
- The synchroniser trusts YouTube metadata for title and description, as any
  feed reader must. Hand edits always win afterwards.
