# Customization

Where every visual decision lives, so a licensee can change the identity
without archaeology.

## Design tokens

All colour, type, spacing and motion decisions are CSS custom properties in
`src/lib/styles/design-system.css`. Change a value there and the whole site
follows.

**Colour**

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f7f3ec` | Page background — warm ivory, per the brief |
| `--paper-soft`, `--paper-warm` | `#f1ece2`, `#ece5d8` | Subtle surfaces, skeletons |
| `--ink` | `#0e1116` | Body text — near-black |
| `--ink-deep` | `#0b0e17` | The show's dark ground, for the featured panel |
| `--graphite` | `#6e6a63` | Metadata, muted labels |
| `--amber-deep` | `#8f5409` | The single accent — sampled from the channel's thumbnails, then deepened to a measured 5.52:1 on ivory |
| `--amber-bright` | `#f3a545` | Accent on dark surfaces |
| `--teal` / `--crimson` | `#06685d` / `#b21c2c` | Status colours only (success, destructive) — never decoration |

The amber was sampled from the channel's published thumbnail artwork, which is
why it is not a generic brand orange. If the programme changes its artwork,
re-sample: the accent is the one place the site should follow the source.

**Geometry**

The radius scale has five steps, each with one job: `--radius-xs` (8px,
controls), `--radius-pill` (999px, reserved for filter chips and tags only),
`--radius-card` (14px, tiles and panels), `--radius-media` (16px, artwork and
players), `--radius-hero` (24px, the opening band). The pill is deliberately
scarce: it signals "discrete filter", so nothing else may wear it.

**Type**

- Display: **Archivo** (variable, width axis up to 125%) — headlines, labels,
  navigation. The show's own logotype is a heavy grotesque, and the display
  face echoes that.
- Body: **Newsreader** — article text and long descriptions.
- Persian: **Vazirmatn** — automatically applied to any `[lang='fa']` element
  and `.persian`, with `direction: rtl` and a more generous line height.
- Utility: Archivo at small sizes with tabular numerals for dates and
  durations.

All fonts are self-hosted in `static/fonts/` with `unicode-range` subsetting:
Latin, Latin-Extended and Arabic-script files load only when the page actually
uses those characters.

**Type scale** is fluid via `clamp()` from `--t-micro` (0.69rem) to
`--t-display` (6.5rem at wide viewports).

**Motion**

| Token | Value |
| --- | --- |
| `--d-instant` … `--d-reveal` | 90ms … 640ms |
| `--e-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--e-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` |
| `--stagger-step` | 55ms |
| `--reveal-distance` | 18px |

Everything animates `transform` and `opacity` only. `prefers-reduced-motion`
collapses all of it to effectively zero in one block at the end of
`motion.css`, and a browser test asserts the computed duration.

## Measured proportions

The golden ratio (φ ≈ 1.618) was evaluated as a composition reference with
`scripts/design-audit.mjs`; it is not the governing ratio of this system and
nothing in the design claims it is. What the system actually renders at a
1280px viewport:

| Relationship | Measured | Note |
| --- | --- | --- |
| Opening band, text : media | 1.149 : 1 | A near-even editorial split, chosen over φ for a denser opening statement. |
| Spacing scale (`--u2`…`--u8`) | 1 → 1.5 → 2 → 3 → 4 rem | A practical progression with a half-step, not a geometric series. |
| Type scale, consecutive steps | 1.10 – 1.57 | Tight steps at reading sizes, expanding at display size; the `--t-h1` → `--t-display` step is 1.57. |
| Card media ratios | 16/9, 16/10, 4/5, 1/1 | Content-driven: video stills, briefs, shorts. 16/10 ≈ 1.6 lands near φ by coincidence, not intent. |
| Reading measure | 62ch | `--max-text`, applied to `.prose`. |

One deliberate tight setting: the display headline sets `line-height: 0.96`,
and Archivo's descender ink reaches about 18px past that line box, so the
reveal masks clip with `overflow-clip-margin: 0.25em` — descender room
without moving a single line.

## Layout

- The page frame (masthead, sections, footer) is in `layout.css`.
- The discovery masonry and cards are in `grid.css`. Column spans are decided
  in the server loaders (`spanClass`), not in the browser, so the composition is
  stable across reloads: long-form episodes take two columns, shorts one, and
  every third long-form tile is text-led. Change the rhythm in
  `episodeSpanClass` / `spanClassFor` in the content modules.
- Editorial reading (hero, article, prose) is in `editorial.css`. The measure is
  capped at `--max-text: 62ch`.
- Controls, forms and states are in `ui.css`.
- The panel is in `admin.css`.

## The signature device

Two rules that split into a pair, echoing the programme's own premise — two
hosts, two registers of output. The homepage hero presents the publication as a
pair (a long conversation and a weekly brief), the disclosure strip carries the
honest independent-concept line, and the featured panel is the show's dark
ground. If you rebrand, that three-part story is what to preserve or replace
deliberately — it is the part that is not a template.

## Content identity

Site name, tagline, description, channel URL, the About body, hosts and listen
links are all editable from **Settings** in the panel and stored in the
database; the code defaults in `src/lib/server/content/settings.ts` are only a
first-run convenience.

The footer credit reads "Design by Maverick Limitless" and the independent-
concept disclosure appears once, in the footer note and on the About page.

## Adding a page

1. `src/routes/<name>/+page.server.ts` — loader, with
   `setHeaders(publicPageCache(...))` for cacheable public pages.
2. `src/routes/<name>/+page.svelte` — server-rendered markup. Use the section
   and card classes rather than new CSS; add tokens, not one-off values.
3. Link it from `Header.svelte` and `Footer.svelte`.
4. Add the route to the sitemap in `src/routes/sitemap.xml/+server.ts` if it is
   public.
