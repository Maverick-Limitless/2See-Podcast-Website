/**
 * Product screenshot capture.
 *
 * Captures the real application from the final build for the documentation
 * gallery: every meaningful route, desktop and mobile, including the states a
 * visitor can actually meet — a search that matches nothing, an archive after
 * "load more", the sign-in screen and the publishing forms.
 *
 * Conventions:
 *   - Desktop shots: 800 CSS wide at deviceScaleFactor 2 (crisp Persian
 *     typography at a readable file size). Mobile: 390 wide at 2x.
 *   - Reduced motion is emulated so every reveal has settled; captures show
 *     the final resting state, never a half-run animation.
 *   - No capture cuts a meaningful element in half. Grid frames are exact
 *     clip regions whose height is measured at a stable viewport (the page
 *     shell has `min-height: 100vh`, so resizing the viewport would re-layout
 *     the page and invalidate the measurement — the viewport never changes
 *     after a page loads).
 *   - The administrator session and the demo story are created through the
 *     real publishing flow, so panel screenshots show the actual product.
 *
 * The server is not started here. Point it at the screenshot database:
 *
 *   E2E_DATABASE_PATH=./data/screenshots.db node scripts/e2e-setup.mjs
 *   PORT=4198 DATABASE_PATH=./data/screenshots.db … node build/index.js
 *   node scripts/capture-screenshots.mjs http://127.0.0.1:4198
 *
 * Usage: node scripts/capture-screenshots.mjs [base-url]
 * Environment: E2E_ADMIN_PASSWORD (must match the setup step).
 */

import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:4198';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'local-e2e-password-placeholder';
const OUT_DIR = resolve('docs/assets/screenshots');

const WIDTH = 800;
const MOBILE_WIDTH = 390;

/**
 * Demonstration editorial content. This is product demo copy written for the
 * showcase — not published 2See material — and the screenshot index labels
 * it as such. No statistic, quote or claim about the programme appears here.
 */
const DEMO_STORY = {
  slug: 'reading-the-debt-ceiling',
  title: 'Reading the debt ceiling',
  subtitle: 'A note on what the numbers do and do not say',
  body: [
    'Every few years the same headline returns: a legal borrowing limit, a negotiation, a deadline. The debt ceiling is a cap set by lawmakers on how much the federal government may borrow in order to pay for spending that those same lawmakers have already approved. It is not a licence for new spending; it is a bookkeeping constraint on paying bills that already exist.',
    'The number itself is less informative than coverage suggests. It is a stock, not a flow: a snapshot of accumulated obligations, not a measure of any single year’s budget. When a standoff ends, the ceiling is suspended or reset and the countdown begins again — which is why the figure can feel enormous and oddly meaningless at the same time.',
    'Reading the coverage critically means separating three questions that are often merged into one. Can the government borrow to pay existing obligations? Will a specific payment be missed on a specific date? And what would a missed payment mean for credit markets? The first is a legal question, the second is a cash-management question, and the third is a speculative one. Collapsing the three into a single countdown clock is what makes the coverage feel more certain than the underlying situation is.',
    'None of this predicts what happens next. It explains why the same story keeps returning — and why the loudest numbers are usually the least interesting ones.'
  ].join('\n\n')
};

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const manifest = [];

function newPage(width, height) {
  return browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce'
  });
}

/** Mid-gap height under `cap`: the frame ends between two card rows. */
function gridFrameHeight(page, cap) {
  return page.evaluate((capH) => {
    const cards = [...document.querySelectorAll('.mosaic .card')];
    let last = 0;
    let nextTop = Number.POSITIVE_INFINITY;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = rect.bottom + window.scrollY;
      if (bottom <= capH) last = Math.max(last, bottom);
      else nextTop = Math.min(nextTop, top);
    }
    if (last === 0) return capH;
    // End just above the next card: the gap after the last complete card stays
    // visible in the frame, and nothing is sliced.
    return nextTop < Number.POSITIVE_INFINITY
      ? Math.round(nextTop - 8)
      : Math.round(last + 24);
  }, cap);
}

async function record(name, route, label, kb) {
  manifest.push({ name, route, viewport: label, kb });
  console.log(`  ${name}  ←  ${route}  (${label}, ${kb} KB)`);
}

async function shoot(page, route, name, { fullPage = false, fitRowsUnder = 0 } = {}) {
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const path = resolve(OUT_DIR, name);
  const size = page.viewportSize();
  const width = size?.width ?? WIDTH;
  if (fitRowsUnder > 0) {
    const height = await gridFrameHeight(page, fitRowsUnder);
    await page.screenshot({ path, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width, height } });
    const kb = Math.round(statSync(path).size / 1024);
    await record(name, route, `${width}×${height} clip`, kb);
  } else {
    await page.screenshot({ path, type: 'jpeg', quality: 88, fullPage });
    const kb = Math.round(statSync(path).size / 1024);
    await record(
      name,
      route,
      fullPage ? `${width} full-page` : `${width}×${size?.height}`,
      kb
    );
  }
}

// --- Publishing panel first: sign in, seed the demo story through the real
//     flow, then capture the panel states. -----------------------------------
{
  const page = await newPage(WIDTH, 1400);
  console.log('Publishing panel (desktop @2x, local test data only):');

  await shoot(page, '/login', 'admin-login.jpg');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Username').fill('tosi-podcast');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin/);

  // The demo story is published through the real flow, once.
  const existing = await page
    .goto(BASE + `/stories/${DEMO_STORY.slug}`)
    .then((response) => response?.status() === 200)
    .catch(() => false);
  if (!existing) {
    await page.goto(BASE + '/admin/stories');
    await page.getByLabel('Title', { exact: true }).fill(DEMO_STORY.title);
    await page.getByLabel('Subtitle', { exact: true }).fill(DEMO_STORY.subtitle);
    await page.getByLabel('Body (Markdown)').fill(DEMO_STORY.body);
    await page.getByRole('button', { name: 'Save draft' }).click();
    const row = page.locator('tr', { hasText: DEMO_STORY.title });
    await row.getByRole('button', { name: 'Publish' }).click();
    await page.waitForTimeout(600);
    console.log('  (demo story created and published through the panel)');
  }

  await shoot(page, '/admin', 'admin-overview.jpg');
  await shoot(page, '/admin/stories', 'admin-stories.jpg', { fullPage: true });
  await shoot(page, '/admin/episodes', 'admin-episodes.jpg', { fullPage: true });
  await page.close();
}

// --- Opening and archive tops: exact clip frames that end between rows. ----
{
  const page = await newPage(WIDTH, 2200);
  console.log('Public grid frames (desktop @2x, clipped at row gaps):');
  // The opening band alone is ~1500 CSS px tall, so the home frame needs the
  // larger cap to include one complete discovery row.
  await shoot(page, '/', 'home-hero.jpg', { fitRowsUnder: 2200 });
  await shoot(page, '/episodes', 'episodes-archive.jpg', { fitRowsUnder: 2000 });
  await page.close();
}

// --- "Load more" state: frame starts on a visual row boundary, so the
//     appended rows, the end of the grid and the footer fit without slicing. -
{
  const page = await newPage(WIDTH, 2000);
  console.log('Archive after "load more" (desktop @2x):');
  await page.goto(BASE + '/episodes', { waitUntil: 'networkidle' });
  const more = page.getByRole('link', { name: /Load \d+ more/ });
  if (await more.count()) {
    await more.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await more.click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      // Cluster the cards into visual rows and begin the frame in the gap
      // above the second-to-last row.
      const cards = [...document.querySelectorAll('.card')];
      const rows = [];
      for (const card of cards) {
        const top = card.getBoundingClientRect().top + window.scrollY;
        const bottom = card.getBoundingClientRect().bottom + window.scrollY;
        const row = rows.find((r) => Math.abs(r.top - top) < 12);
        if (row) row.bottom = Math.max(row.bottom, bottom);
        else rows.push({ top, bottom });
      }
      rows.sort((a, b) => a.top - b.top);
      if (rows.length >= 2) {
        const upper = rows[rows.length - 2];
        const lower = rows[rows.length - 1];
        window.scrollTo(0, (upper.bottom + lower.top) / 2);
      }
    });
    await page.waitForTimeout(400);
    const path = resolve(OUT_DIR, 'episodes-load-more.jpg');
    await page.screenshot({ path, type: 'jpeg', quality: 88 });
    const kb = Math.round(statSync(path).size / 1024);
    await record('episodes-load-more.jpg', '/episodes?page=2 (appended rows)', `${WIDTH}×2000`, kb);
  }
  await page.close();
}

// --- Whole pages: full-page captures where the complete page is the point. -
{
  const page = await newPage(WIDTH, 1400);
  console.log('Public pages (desktop @2x, full-page):');
  await shoot(page, '/episodes?q=zzzz-no-such-episode', 'episodes-search-empty.jpg', { fullPage: true });
  const detailHref = await page
    .goto(BASE + '/episodes', { waitUntil: 'networkidle' })
    .then(() => page.locator('.card__link').first().getAttribute('href'));
  await shoot(page, detailHref ?? '/episodes', 'episode-detail.jpg', { fullPage: true });
  await shoot(page, '/stories', 'stories-archive.jpg', { fullPage: true });
  await shoot(page, `/stories/${DEMO_STORY.slug}`, 'story-detail.jpg', { fullPage: true });
  await shoot(page, '/about', 'about.jpg', { fullPage: true });
  await page.close();
}

// --- Mobile ------------------------------------------------------------------
{
  const page = await newPage(MOBILE_WIDTH, 2400);
  console.log('Public routes (mobile @2x):');
  await shoot(page, '/', 'home-mobile.jpg', { fullPage: true });
  // Phone cards are tall: the cap lets the clip hold several complete cards
  // and end inside the following gap.
  await shoot(page, '/episodes', 'episodes-archive-mobile.jpg', { fitRowsUnder: 2400 });
  await page.close();
}

await browser.close();

console.log(`\n${manifest.length} captures written to ${OUT_DIR}`);
