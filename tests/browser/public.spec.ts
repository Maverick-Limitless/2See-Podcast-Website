import { expect, test } from '@playwright/test';

/**
 * Browser tests: the public reading experience.
 *
 * These check what a visitor actually sees and does, not just that a route
 * returns 200. Console errors and failed first-party requests are collected
 * per test and asserted, so a regression that breaks a page silently still
 * fails the run.
 */

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

/** Watches a page for console errors and failed same-origin requests. */
function watchPage(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    // YouTube thumbnails are third-party; only first-party failures are ours.
    if (new URL(request.url()).origin === new URL(BASE).origin) {
      failedRequests.push(`${request.url()} — ${request.failure()?.errorText}`);
    }
  });

  return {
    errors: consoleErrors,
    failed: failedRequests,
    assertClean(context: string) {
      expect(consoleErrors, `console errors on ${context}`).toEqual([]);
      expect(failedRequests, `failed first-party requests on ${context}`).toEqual([]);
    }
  };
}

test.describe('public site', () => {
  test('homepage renders the editorial hero and real episode content', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');

    await expect(page).toHaveTitle(/2See Podcast/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Technology, business');

    // The hero states the programme's real positioning.
    await expect(page.getByText('Two hosts, two registers')).toBeVisible();

    // Real, verified Persian content is present on the page.
    await expect(page.getByText(/به توسی خوش آمدید/)).toBeVisible();

    // At least one episode card is rendered from the archive.
    await expect(page.locator('.card__title').first()).toBeVisible();

    // No fake engagement metrics anywhere on the page.
    await expect(page.getByText(/views|subscribers|likes/i)).toHaveCount(0);

    watch.assertClean('homepage');
  });

  test('navigating from home to the episode archive works', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');

    await page.getByRole('link', { name: 'Episodes' }).first().click();
    await expect(page).toHaveURL(/\/episodes$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Episodes');

    // The archive reports a real count.
    await expect(page.getByText(/published items?/)).toBeVisible();
    watch.assertClean('episodes archive');
  });

  test('search filters the archive and can be cleared', async ({ page }) => {
    await page.goto('/episodes');

    const search = page.getByLabel('Search episodes');
    await search.fill('هاروارد');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/q=/);
    // The matched episode is a Persian title about a Harvard professor.
    await expect(page.locator('.card__title').first()).toContainText('هاروارد');

    // A term with no matches produces a helpful empty state.
    await page.goto('/episodes');
    await search.fill('zzzz-no-such-episode');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing matched' })).toBeVisible();
  });

  test('load more appends the next batch, then Back returns to the first', async ({ page }) => {
    // Third-party thumbnails are not under test here; blocking them keeps the
    // layout deterministic while the archive grows.
    await page.route(/ytimg\.com/, (route) => route.abort());
    await page.goto('/episodes');
    const titles = page.locator('.card__title');
    await expect(titles).toHaveCount(12);
    const firstTitle = (await titles.first().textContent()) ?? '';

    // A real user clicks a control they can already see. Scrolling it into
    // view first also keeps Playwright's own click auto-scroll from changing
    // the position this test is guarding.
    const moreLink = page.getByRole('link', { name: /Load \d+ more/ });
    await moreLink.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(900); // the document scrolls smoothly by design

    // The stable invariant: the card the reader is looking at keeps its
    // exact position in the viewport across the batch append.
    const reference = page.locator('.card').nth(5);
    const referenceTop = await reference.evaluate((el) => el.getBoundingClientRect().top);

    await moreLink.click();
    await expect(page).toHaveURL(/\/episodes\?page=2$/);
    await expect(titles).toHaveCount(15);
    // The first batch is still there, in the same order, and nothing repeats.
    await expect(titles.first()).toHaveText(firstTitle);
    const texts = await titles.allTextContents();
    expect(new Set(texts).size).toBe(texts.length);
    // The view does not jump to the top: the same card is still in place.
    const afterTop = await reference.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(afterTop - referenceTop)).toBeLessThan(60);
    // The control disappears once the archive is fully loaded.
    await expect(page.getByRole('link', { name: /Load \d+ more/ })).toHaveCount(0);

    // Browser Back returns to the first batch, not a broken navigation state.
    await page.goBack();
    await expect(page).toHaveURL(/\/episodes$/);
    await expect(titles).toHaveCount(12);
  });

  test('an episode detail page shows metadata and the YouTube route', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/episodes');
    await page.locator('.card__link').first().click();

    await expect(page).toHaveURL(/\/episodes\/[a-z0-9-]+$/);
    // Title, publication facts and an official link all appear.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/^Published/).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Original video/ })
    ).toHaveAttribute('href', /youtube\.com\/watch\?v=/);

    // The player is thumbnail-first: no iframe until the visitor asks.
    expect(await page.locator('iframe').count()).toBe(0);
    await expect(page.getByRole('button', { name: /Play episode/ })).toBeVisible();

    // Clicking embeds the official privacy-enhanced player.
    await page.getByRole('button', { name: /Play episode/ }).click();
    await expect(page.locator('iframe')).toHaveAttribute(
      'src',
      /youtube-nocookie\.com\/embed\//
    );

    watch.assertClean('episode detail');
  });

  test('keyboard navigation reaches the skip link, then the nav', async ({ page }) => {
    await page.goto('/');

    // The very first tab stop is the skip link, and it becomes visible.
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    // Focus is visibly styled, not merely moved programmatically.
    const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    // Every focusable control in the header is reachable by keyboard.
    const reached: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      reached.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el instanceof HTMLAnchorElement ? el.textContent?.trim() ?? '' : '';
        })
      );
    }
    expect(reached.some((label) => label === 'Episodes')).toBe(true);
    expect(reached.some((label) => label === 'Stories')).toBe(true);

    // Activating a nav link with the keyboard navigates.
    await page.locator('.nav__link', { hasText: 'Episodes' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/episodes$/);
  });
  test('reduced motion disables reveal animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // With reduced motion, revealed content must be visible immediately.
    const opacity = await page
      .locator('[data-reveal]')
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');

    const transition = await page
      .locator('[data-reveal]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(transition)).toBeLessThan(0.01);
  });

  test('a missing page shows the 404 route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('does not exist');
  });

  test('the sitemap and robots are reachable and exclude admin routes', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain('Disallow: /admin');
    expect(robotsText).toContain('Sitemap:');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<urlset');
    expect(sitemapText).not.toContain('/admin');
  });

  test('the PWA manifest is valid', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    const json = JSON.parse(await manifest.text());
    expect(json.name).toContain('2See');
    expect(json.short_name).toBe('2See');
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of json.icons) {
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
    }
    // Every icon is actually served.
    for (const icon of json.icons) {
      const iconResponse = await request.get(icon.src);
      expect(iconResponse.ok(), `${icon.src} must be served`).toBe(true);
    }
  });

  test('pages have unique titles, descriptions and canonical URLs', async ({ page }) => {
    const titles = new Set<string>();

    for (const path of ['/', '/episodes', '/stories', '/about']) {
      await page.goto(path);
      const title = await page.title();
      expect(title, `${path} needs a unique title`).not.toBe('');
      titles.add(title);

      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(description, `${path} needs a meta description`).not.toBe('');

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${path} needs a canonical URL`).not.toBe('');
    }

    expect(titles.size, 'every page has its own title').toBe(4);
  });

  test('public pages send cacheable headers but never private ones', async ({ request }) => {
    const home = await request.get('/');
    const cacheControl = home.headers()['cache-control'] ?? '';
    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).not.toMatch(/no-store/);
  });
});
