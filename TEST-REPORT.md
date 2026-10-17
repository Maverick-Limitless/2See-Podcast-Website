# Test report

Environment: macOS (darwin 27, arm64), Node v26.8.1, npm 11.19.0.
All commands were run against the production build (`vite build`) unless a line
says otherwise.

## Commands and results

| Command | Result |
| --- | --- |
| `npx svelte-kit sync && npx tsc --noEmit` | **Pass.** No type errors. |
| `npx vite build` | **Pass.** Server bundle ~132 kB + ~90 kB root chunk; client assets content-hashed. |
| `npm test` (Vitest) | **99 passed, 0 failed** across 5 files. |
| `npm run test:e2e` (Playwright, Chromium) | **20 passed, 0 failed** across 2 spec files. |
| Manual smoke (`scripts/verify-login.mjs`, `scripts/verify-admin.mjs`) | **All checks passed** against a running server. |

## Vitest breakdown (99)

| File | Tests | Coverage |
| --- | --- | --- |
| `tests/unit/youtube-url.test.ts` | 14 | URL parsing and rejection |
| `tests/unit/markdown.test.ts` | 29 | Rendering and 16 XSS payloads |
| `tests/unit/youtube-client.test.ts` | 11 | Durations and feed parsing |
| `tests/integration/auth.test.ts` | 20 | Single admin, sessions, throttling |
| `tests/integration/content.test.ts` | 25 | Episodes, stories, search, cache tokens |

## Playwright breakdown (20)

Public site (11): homepage content and absence of fake metrics; archive
navigation; Persian search and empty state; episode detail with thumbnail-first
embed and official link; keyboard navigation from the skip link; reduced
motion; 404; robots/sitemap excluding admin; manifest validity with every icon
served; unique titles/descriptions/canonicals; cacheable-but-never-private
headers. Console errors and failed first-party requests asserted per test.

Publishing panel (9): no registration path; wrong password refused generically
with no session cookie; protected routes redirect; draft → publish → live →
unpublish → delete for a story; duplicate video refused by ID; non-YouTube URL
rejected; sign-out closes the panel; secrets absent from the browser; password
change gated on the current password.

## Defects found by testing and fixed

Testing caught nine real defects, all fixed and re-verified:

1. **Invisible homepage.** `data-reveal` elements never received the
   `is-revealed` class — the hero rendered blank. Only a screenshot exposed it.
2. **294px horizontal overflow at 320px.** The masthead nav overflowed on small
   phones. Fixed with a two-row header below 720px; now 0px on every page.
3. **CSP blocked hydration.** A hand-written `script-src 'self'` header rejected
   SvelteKit's own inline bootstrap. Moved to SvelteKit's per-request nonce CSP.
4. **Stale archive after filtering.** `const { episodes } = data` captured the
   initial prop value, so client-side navigation showed old results. Made
   reactive with `$derived`.
5. **Login errors never displayed.** The page read `data.error` where form
   failures arrive as `form.error`; failures were silent.
6. **Reserved action name.** `default` is reserved in SvelteKit 2.70; the login
   action 500'd. Renamed.
7. **Settings forms always failed CSRF.** The settings loader never exposed the
   token, so every settings save was rejected. Fixed at the layout level.
8. **Timestamp format mismatch.** SQL defaults emitted `T`-separated timestamps
   while JS emitted space-separated ones, so rate-limit windows silently matched
   nothing. Unified; this was a production-latent bug.
9. **Unpublish crashed.** `published_at` was set to NULL against a NOT NULL
   column, and republishing would have reset the original date. The date is now
   preserved across state changes.

## Not tested (stated plainly)

- **Firefox and WebKit**: Playwright ran Chromium only. Cross-engine behaviour
  is expected to hold but is not proven here.
- **Lighthouse / Core Web Vitals**: not run in this environment; no score is
  claimed. Bundle sizes and the server-rendered reading surface are reported
  above instead.
- **Genuine PWA installation**: manifest validity, icon serving and the
  service-worker scope are machine-verified; an interactive
  add-to-home-screen prompt was not performed.
- **Live YouTube Data API calls**: require a billable key. The API client is
  covered through its parser and the synchroniser through idempotency tests
  with the real public feed.
- **Screen-reader pass**: focus order, visibility, labels, contrast, heading
  hierarchy and reduced motion are machine-checked; a full human assistive-
  technology audit remains open and is recommended before launch.
- **Real-user field data**: none exists; no field CWV is claimed.
