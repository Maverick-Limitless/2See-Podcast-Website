# Third-party notices

Everything this project ships, and the terms under which it ships.

## Fonts (self-hosted, `static/fonts/`)

| Font | Designer | Licence | Files |
| --- | --- | --- | --- |
| Archivo | Omnibus-Type | SIL Open Font License 1.1 | `archivo-latin-*.woff2` |
| Newsreader | Production Type | SIL Open Font License 1.1 | `newsreader-latin-*.woff2` |
| Vazirmatn | Saber Rastikerdar | SIL Open Font License 1.1 | `vazirmatn-*.woff2` |

All three are variable fonts, subset by Google Fonts tooling to Latin,
Latin-Extended and (for Vazirmatn) Arabic-script ranges, and served from this
project's own origin — no external font request is made.

The SIL Open Font License 1.1 permits embedding, redistribution and
modification, provided the fonts are not sold by themselves and reserved names
are respected. The full licence text is at
<https://openfontlicense.org/open-font-license-official-text/>.

## Runtime dependencies

| Package | Licence |
| --- | --- |
| svelte, @sveltejs/kit, @sveltejs/adapter-node, @sveltejs/vite-plugin-svelte | MIT |
| vite | MIT |
| typescript | Apache-2.0 |
| vitest | MIT |
| @playwright/test | Apache-2.0 |
| svelte-check | MIT |

There are no other runtime dependencies. The database is Node's built-in
`node:sqlite`; password hashing is Node's built-in `crypto.scrypt`; there is no
ORM, no auth framework, no Markdown library, no analytics and no tracking
script.

## Third-party content displayed

- **YouTube thumbnails** (`i.ytimg.com`): the channel's own published artwork,
  referenced by URL, never copied into this repository.
- **The YouTube embed** (`youtube-nocookie.com`): the official privacy-enhanced
  player, loaded only after a visitor clicks. No video is downloaded, proxied
  or rehosted.
- **Episode metadata**: titles, descriptions and publication dates come from
  the channel's public feed and are reproduced verbatim, in the original
  Persian or English. No translation is invented.
- **Test fixture** (`tests/fixtures/e2e-episodes.json`): the channel's public
  episode metadata, reproduced so the browser test suite runs deterministically
  and offline. It contains the same published titles, descriptions and dates
  the synchroniser imports, and nothing unreleased or private.

## Trademarks

"2See Podcast", «توسی», the channel's name, logo and artwork are property of
their respective owners. Use here is referential, with attribution and links
to the official channel. No endorsement is claimed or implied.
