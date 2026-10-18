# Product brief — 2See Podcast website

**What it is.** A bespoke editorial website and single-user publishing panel, built as one self-contained codebase, proposed to the hosts of 2See Podcast as an independent digital home for their programme.

**Who it is for.** Primarily the two hosts — Saleh Dadkhahipour and Mehrzad Sajjadi — as the product's operators and publishers. Secondarily their audience: Persian and English listeners who want one place to browse episodes, follow topics, and read around the programme.

**Status.** An independent concept. Not an official 2See website; no endorsement is claimed.

## The problem

The programme's content is published across YouTube long-form episodes, short clips and — potentially — written ideas. Each format lives where it was uploaded. A listener who wants to understand what the programme is about, find the episode that matches a question, or read editorial material around a topic has no single destination that presents the archive, the writing and the identity together.

This is the observable reality of a channel-first publishing model. It is not a claim that the channel is hard to find or that its audience is dissatisfied.

## The solution

One independent website that:

- presents the programme's identity and hosts, with verified information only;
- archives episodes as a visual, browsable collection — search, format filters, full titles in their original language;
- gives each episode a shareable page with the official, privacy-preserving YouTube player;
- hosts editorial writing as a first-class reading experience;
- remains controllable by the hosts through a minimal, secure panel — content is added, edited and published by them, on their own infrastructure.

YouTube stays the video platform. The site links and embeds; it never replaces or rehosts playback.

## Core value

- **To the hosts:** an independent archive and editorial surface they control, with a brand presentation derived from their own artwork — without giving up YouTube as the publishing backbone.
- **To the audience:** a coherent destination where browsing, discovery and reading happen in one place, in both of the programme's languages.

These are potential values of the design, not proven outcomes. No audience, growth or revenue claims are made.

## Main user journeys

| Journey | Path |
| --- | --- |
| Discover the programme | Home → opening composition → featured episode → archive |
| Find an episode | Episodes → search or format filter → episode page → watch on YouTube |
| Read editorially | Stories → article → related material |
| Learn about the hosts | About |
| Publish (operator) | `/admin` → draft → preview → publish |

## Implemented capability vs future

**Implemented and verified in this build:** public site, bilingual typography and RTL, single-admin panel, manual episode entry with duplicate prevention, feed/API synchronisation into drafts, Markdown stories with sanitised rendering, reading-time from real content, sitemap/robots, installable PWA, 119 automated tests.

**Future / out of scope for v1:** independent media hosting, comments or accounts for readers, analytics, multi-language interface localisation, a mobile app.

## Product scope and deliberate exclusions

- No reader accounts — the site is a publication, not a platform.
- No file uploads in v1 — cover images are referenced by validated URL, removing an entire attack surface.
- No comments, no tracking, no third-party scripts.
- The panel manages content, not users: exactly one administrator exists, enforced in the database schema.

## Publishing model

| Layer | Home |
| --- | --- |
| Video | YouTube (embeds via `youtube-nocookie` + canonical links back) |
| Editorial writing | This site — written and published by the operator |
| Identity and programme info | This site — editable in Settings, sourced from verified research |

## Complexity assessment

| Area | Level | Why |
| --- | --- | --- |
| Hosting/operations | **Low** | One Node process, one SQLite file, no external services. Any host with a persistent filesystem works. |
| Frontend/UI | **Medium** | A bespoke design system: bilingual RTL/LTR, fluid type, a five-step radius scale, a documented motion language, glass-over-image cards with height-adaptive captions. Deliberate craft, not template assembly. |
| Backend | **Medium** | Small by line count but dense with correctness requirements: schema-enforced single admin, hashed sessions with rotation, CSRF on every action, allowlisted Markdown and YouTube URL parsing, idempotent synchronisation. |
| Security | **Medium** | No third-party auth or database dependencies to track; the trade-off is that the codebase itself owns session, CSRF and throttling logic, which it does with 29 dedicated tests. |
| Maintenance | **Low–Medium** | Dependencies are few and mainstream (SvelteKit, Vite, Vitest, Playwright). The main operational discipline is database backups and keeping the Node version current. |

Real product complexity is higher than "just host it": the value is in the design system and the correctness of the publishing workflows. Anyone can run the process; making changes safely requires reading the architecture and testing conventions.

Any time/cost estimates for customisation are excluded here because they depend on requirements not yet agreed with the hosts; treating the numbers above as an effort quote would be misleading.

## Dependencies, risks, and mitigations

| Risk | Note | Mitigation in place |
| --- | --- | --- |
| YouTube feed availability | The public feed carries only recent uploads and can be unavailable; observed during development | Data API path for full archives; manual entry always works; failures surface in the panel, never silently |
| Artwork rights | Thumbnails are the channel's own published artwork, referenced not rehosted | Documented in THIRD-PARTY-NOTICES; the site claims no rights over them |
| Authorisation | Independent concept without host agreement | Prominent disclosure on the About page and in the footer; nothing implies endorsement |
| Single-server limits | Throttling and sessions are per-database | Stated in SECURITY as the supported topology |
| Data durability | SQLite on local disk | Documented backup/restore commands; serverless/ephemeral-filesystem deployments are explicitly out of scope |

## Where to look next

- [PITCH.md](PITCH.md) — the presentation version of this brief
- [ARCHITECTURE.md](ARCHITECTURE.md) — how it is actually built
- [RESEARCH.md](RESEARCH.md) — every verified fact the demo content rests on
