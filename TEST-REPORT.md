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


---

## Addendum — productization pass, 2026-10-18

Environment: same as above. All commands run against the rebuilt product.

| Command | Result |
| --- | --- |
| `npm run check` (svelte-check + TS) | **Pass.** 0 errors. (Three errors found and fixed during this pass: missing `enhance` import, untyped `requestSubmit`, related episodes without span class.) |
| `npm test` | **99 passed, 0 failed.** |
| `npm run test:e2e` | **20 passed, 0 failed** (Chromium). |
| `npx vite build` | **Pass.** |
| Visual audit (7 viewports × 5 routes) | **0 overflow, 0 contrast, 0 RTL defects.** |
| Glass scrim worst-case contrast | Card **5.18:1**, hero **7.88:1** — both pass over pure white. |
| Vision review of product screenshots | 3 cycles on the exact `docs/assets/screenshots/` images through the image-capable workflow path; every review proved image arrival by quoting visible text. Two "important" findings were confirmed product bugs and fixed (RTL date isolation, hero artwork crop); two were rejected with DOM measurements (Persian block direction — first word measured flush right; story-body cut — frame edge, not layout). Not covered: motion, hover states, Firefox/WebKit. |
| README/doc command audit | Every `npm run` reference across README and docs resolves against `package.json` (an earlier scan reported `test:e` as unresolved — that was the scanner's own regex dropping digits, not a documentation error). |

Known limitation added this pass: screenshots are JPEG captures at quality
88; at small sizes Persian glyphs remain harder to read than Latin, which
also caused one vision-model misread — the underlying rendering is verified
correct in the DOM.

---

## Addendum — release pass, 2026-10-19

Environment: macOS, Node 26, Chromium via Playwright. All commands run
against the final source state that this release ships.

| Command | Result |
| --- | --- |
| `npm run check` (svelte-check + TS) | **Pass. 0 errors, 0 warnings.** |
| `npm run lint` | **Pass** (svelte-check based). |
| `npm test` | **106 passed, 0 failed** (4 new configuration-fallback tests, 3 new archive-URL tests). |
| `npm run test:e2e` | **21 passed, 0 failed** — twice, from a clean port (47.5s and 1.1m). The suite now rebuilds its own test database from `tests/fixtures/e2e-episodes.json` and boots its own server; no manually started server is involved. |
| `npm run build` | **Pass.** |
| Bare-boot smoke (no env vars at all) | `GET /` and `/episodes` **200** — the clean-checkout dev path works; previously every request 500'd with "CSRF secret is not configured". |
| Visual audit (7 viewports × 6 routes) | **0 overflow, 0 contrast, 0 RTL, 0 touch-target defects.** Touch targets are now measured at mobile widths, counting pseudo-element hit areas; `/login` is covered. |
| Glass scrim worst-case contrast (`scripts/scrim-contrast.mjs`) | Card **6.23:1**, hero **7.88:1** — both pass over a pure-white worst case. The caption scrim's gradient floor was raised to alpha 0.68 after the summary-dedup change had dropped the worst case to 4.34:1; the regression and the fix were both found by this deterministic harness. |
| Route smoke | 10 routes **200**; a missing episode **404**. |
| Documentation links | 14 markdown files, **0 broken** links or images; every `npm run` reference resolves (five `test:e` flags were the scanner's own known digit-truncation, not documentation errors). |
| Secret scan | **No credential patterns** in any tracked file. |

### Vision review — 6 cycles, NVIDIA Nemotron 3.5 Super VL

Every cycle ran through the image-capable dynamic-workflow path; every
review proved image arrival by quoting text visible in its screenshot. 14
captures were reviewed: the nine established routes plus the mobile archive,
the sign-in screen, both editors, the empty-search state and the appended
"load more" state.

**Confirmed and fixed:** summary text duplicating the episode title on ten
of fifteen episodes (cards and detail page); the detail page's doubled
`SHORT · SHORTS` badge; a related card, the about-page footer and both admin
forms cut by capture frames; a dark band sliced behind the sticky header in
the load-more capture; the admin sync line rendering `0 created, 0 refreshed`
noise in its never-run state; and the capture framing itself (grid frames
now end at measured row gaps, clipped from a stable viewport because the
page shell's `min-height: 100vh` re-layouts on every viewport resize).

**Rejected with evidence:** a "dangling colon" on the disclosure line (the
source sentence ends with a period); `o` bullet marks in the admin sync line
(the characters are zeros); "ragged" archive rows (measured card bottoms are
equal within a row); a "full-width" reading measure (capped at 62ch by
`--max-text`); and the final cycle's "cut" mobile archive card — pixel
sampling of the actual JPEG shows the bottom 40 CSS pixels are uniform page
background with the last card fully inside the frame.

### Not covered

Static frames cannot show animation or hover states; Firefox and WebKit
remain untested; YouTube Data API calls need a billable key; a human
screen-reader pass remains the one accessibility gap worth closing before
launch.
