# Content management

How to run the publication day to day. Everything below happens in the panel at
`/admin`; the only command-line task is creating the first account.

## Signing in

- URL: `/admin` (redirects to `/login`)
- Username: `tosi-podcast`
- Password: whatever `npm run init:admin` printed, or what you set in the
  browser setup.

Sessions expire automatically and sign-out revokes the token on the server.

## Stories (manual articles)

1. Open **Stories** in the panel.
2. Fill the title, an optional subtitle, and the body in **Markdown**.
3. Set a category, tags, an author, and optionally a cover image URL with
   alternative text and a caption.
4. **Preview** renders the body with the exact sanitising the public page uses.
5. **Save draft** stores it privately; **Publish** makes it public immediately.
6. From the list, publish, unpublish or delete any story. Deleting asks for a
   confirmation click on the same row.

Reading time is computed from the actual word count, not a guess. The rendered
HTML is produced once, at save time, by the allowlisted renderer — raw HTML in
the Markdown source is displayed as text, never executed.

Supported Markdown: headings, paragraphs, lists, blockquotes, fenced code,
horizontal rules, bold, italic, inline code, links and hard breaks. Anything
else is escaped.

## Episodes

### Method A — add a video by hand

1. Open **Episodes** and paste a YouTube URL. Watch, `youtu.be` share links
   and `/shorts/` URLs are all accepted; embed URLs and non-YouTube hosts are
   rejected.
2. The video ID is extracted and checked; a video that is already in the
   archive is reported as a duplicate and nothing is stored.
3. Review the metadata: title (and the original Persian title when it differs),
   description, summary, guests, category, tags, thumbnail URL, publication
   date, duration, language and format.
4. **Add as draft**, review, then publish from the list.

### Method B — synchronise from YouTube

Press **Synchronise now** on the Episodes screen, or run `npm run
sync:episodes` on a schedule.

- With `YOUTUBE_API_KEY`: pages the channel's uploads playlist.
- Without a key, with `YOUTUBE_CHANNEL_ID`: reads the public feed (the most
  recent uploads; no durations).
- **Everything arrives as a draft.** Synchronisation never publishes by
  itself; you review and publish.
- It is idempotent: running it twice creates nothing new.
- Your edits win: once you hand-edit an episode, the synchroniser refreshes
  only its own bookkeeping and never overwrites your title, summary,
  description, guests, category, tags, thumbnail, duration or state.
- Unpublished stays unpublished. A video you took down does not come back.

The Overview screen shows the last run: status, message, how many were found,
created and refreshed.

### Publication states

- **Draft**: invisible to visitors; the public page returns 404.
- **Published**: live, in the archives, in the sitemap.
- Unpublishing keeps the original publication date, so republishing restores it
  rather than resetting the date.

## Images

Episode thumbnails come from YouTube's own image CDN (`i.ytimg.com`) — the
channel's published artwork, referenced by URL. Story covers are referenced by
URL you supply.

There is deliberately **no file upload** in this version. That removes an
entire attack surface (malicious uploads) at the cost of not hosting images
yourself. If you need first-party image hosting, add a pipeline that
re-encodes uploads (never stores them verbatim) and widen the CSP `img-src`.

## Settings

- Site title, tagline and description
- The channel URL the "Listen on YouTube" links point to
- The About body, contact note and footer note
- Hosts, one per line: `Name | Latin name | Role | Credentials`
- Listen links, one per line: `Label | URL`
- Password change (requires the current password; signs out every session)

API keys and secrets are never displayed; the screen reports only whether each
one is configured.

## What the panel does not do

- No analytics, no view counts, no engagement metrics. The Overview shows
  published counts, drafts and the last synchronisation, nothing else.
- No user management — there is exactly one account by design.
- No page builder — stories are Markdown, deliberately.
