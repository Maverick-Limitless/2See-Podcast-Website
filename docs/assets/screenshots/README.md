# Screenshot gallery

Real captures of the running application, taken by
[`scripts/capture-screenshots.mjs`](../../../scripts/capture-screenshots.mjs)
from the production build in this repository. Every image is a browser-rendered
page at device scale 2 (crisp Persian typography), JPEG quality 88, reduced
motion emulated so every reveal is shown in its final resting state.

The episode content in every shot is the channel's real, published metadata.
Panel screenshots and the editorial story pages additionally contain local
**test data only**, as noted below — nothing there is published 2See content.

| Image | Route · viewport | What it shows |
| --- | --- | --- |
| `home-hero.jpg` | `/` · desktop 800px, frame ends at a complete card row | The opening composition: programme statement on the deep-navy ground, real counts, right-aligned Persian note, disclosure line, and the discovery grid. |
| `home-mobile.jpg` | `/` · mobile 390px, full page | The complete mobile homepage: masthead, two-row navigation, hero and episode cards at phone width. |
| `episodes-archive.jpg` | `/episodes` · desktop 800px | Archive top: search, category select, format filter chips, and the first complete grid rows with Persian titles preserved. |
| `episodes-archive-mobile.jpg` | `/episodes` · mobile 390px | The same archive on a phone: single-column cards, filters reachable, nothing clipped. |
| `episode-detail.jpg` | `/episodes/…` · desktop 800px, full page | A complete episode page: thumbnail-first player, metadata, notes, related episodes and footer. |
| `episodes-load-more.jpg` | `/episodes?page=2` · desktop 800px | The archive after "Load more": the frame starts at the first appended card, showing the batch that was added beneath the existing ones and that the control is gone once everything is loaded. |
| `episodes-search-empty.jpg` | `/episodes?q=…` · desktop 800px | The empty search state: a real "Nothing matched" message with a clear-filters action. |
| `stories-archive.jpg` | `/stories` · desktop 800px | The editorial archive. The single story shown is demonstration content (see below). |
| `story-detail.jpg` | `/stories/…` · desktop 800px | The reading experience: signature opening panel, reading progress, prose. The story shown is demonstration content (see below). |
| `about.jpg` | `/about` · desktop 800px, full page | The programme page: hosts in both languages, the purpose statement, and the independence note. |
| `admin-login.jpg` | `/login` · desktop 800px | The sign-in screen: exactly one account, no registration path. |
| `admin-overview.jpg` | `/admin` · desktop 800px | The panel overview: counts and synchronisation state. Local test data only. |
| `admin-stories.jpg` | `/admin/stories` · desktop 800px, full page | The story editor: Markdown body, preview, drafts and publishing. Local test data only. |
| `admin-episodes.jpg` | `/admin/episodes` · desktop 800px, full page | Manual episode entry with YouTube-URL validation, and the publish workflow. Local test data only. |

## Demonstration content, clearly separated

- **Episodes** — every episode title, thumbnail, date and format in every
  screenshot is the channel's own published metadata, imported through the
  product's real synchronisation path.
- **The editorial story** ("Reading the debt ceiling") is product demo copy
  written to showcase the reading experience. It is not published 2See
  material and makes no claim about the programme.
- **Panel data** — the administrator session and the story above exist only
  in a disposable local capture database; no credential or private data
  appears in any image.

## How to re-capture

```bash
E2E_DATABASE_PATH=./data/screenshots.db node scripts/e2e-setup.mjs
PORT=4198 DATABASE_PATH=./data/screenshots.db … node build/index.js
node scripts/capture-screenshots.mjs http://127.0.0.1:4198
```
