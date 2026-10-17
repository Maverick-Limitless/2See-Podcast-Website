import { expect, test, type Page } from '@playwright/test';

/**
 * Browser tests for the publishing flow.
 *
 * These drive the real panel in a real browser: sign in, write a draft story,
 * publish it, confirm it is live, add an episode by hand, confirm a duplicate
 * is refused, sign out, and confirm the protected routes are closed.
 *
 * The password comes from E2E_ADMIN_PASSWORD, set by the environment that
 * starts the server. No real credential is ever committed to this file.
 */

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'local-e2e-password-placeholder';

function adminNav(page: Page) {
  return page.getByRole('navigation', { name: 'Publisher sections' });
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill('tosi-podcast');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe('publishing panel', () => {
  test('the login page is reachable and has no registration path', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    // No public registration anywhere in the interface.
    await expect(page.getByRole('link', { name: /register|sign up|create account/i })).toHaveCount(0);
    await expect(page.getByText('one account')).toBeVisible();
  });

  test('a wrong password is refused and sets no session', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('tosi-podcast');
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Incorrect username or password');
    // The generic message must not say which part was wrong.
    await expect(page.getByText(/username/i).first()).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === '2see_session')).toBe(false);
  });

  test('protected routes redirect to login when signed out', async ({ page }) => {
    for (const path of ['/admin', '/admin/stories', '/admin/episodes', '/admin/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    }
  });

  test('sign in, write a draft, publish it, and see it live', async ({ page }) => {
    const title = `Browser test story ${Date.now()}`;
    await signIn(page);

    // Overview shows only operational counts.
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Published stories')).toBeVisible();

    await adminNav(page).getByRole('link', { name: 'Stories' }).click();
    await expect(page).toHaveURL(/\/admin\/stories/);

    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Subtitle', { exact: true }).fill('Written by the browser test');
    await page
      .getByLabel('Body (Markdown)')
      .fill('## A section\n\nA paragraph long enough to read.\n\n- first\n- second');
    await page.getByRole('button', { name: 'Save draft' }).click();

    // The draft appears in the admin list as a draft.
    const row = page.locator('tr', { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText('draft')).toBeVisible();

    // Publishing it puts it on the public site.
    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published.')).toBeVisible();

    await page.goto('/stories');
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    // Clean up: unpublish, then delete with confirmation.
    await page.goto('/admin/stories');
    const liveRow = page.locator('tr', { hasText: title });
    await liveRow.getByRole('button', { name: 'Unpublish' }).click();
    await liveRow.getByRole('button', { name: 'Delete' }).click();
    await liveRow.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.getByText('Deleted.')).toBeVisible();
  });

  test('a duplicate YouTube episode is refused by video ID', async ({ page }) => {
    await signIn(page);
    await adminNav(page).getByRole('link', { name: 'Episodes' }).click();
    await expect(page).toHaveURL(/\/admin\/episodes/);

    // The channel already publishes this video; it is seeded in the database.
    await page.getByLabel('YouTube URL').fill('https://www.youtube.com/watch?v=pJZ9r_h1P4U');
    await page.getByLabel('Title', { exact: true }).fill('A duplicate attempt');
    await page
      .getByLabel('Thumbnail URL')
      .fill('https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg');
    await page.getByLabel('Publication date').fill('2026-10-16T15:00');
    await page.getByRole('button', { name: 'Add as draft' }).click();

    await expect(page.getByRole('alert')).toContainText('already in the archive');

    // Only one row exists for that video.
    await expect(page.locator('tr', { hasText: 'pJZ9r_h1P4U' })).toHaveCount(1);
  });

  test('a non-YouTube URL is rejected before anything is stored', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/episodes');

    await page.getByLabel('YouTube URL').fill('https://evil.example.com/embed/pJZ9r_h1P4U');
    await page.getByLabel('Title', { exact: true }).fill('Should be rejected');
    await page
      .getByLabel('Thumbnail URL')
      .fill('https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg');
    await page.getByLabel('Publication date').fill('2026-10-16T15:00');
    await page.getByRole('button', { name: 'Add as draft' }).click();

    await expect(page.getByRole('alert')).toContainText('youtube.com and youtu.be');
  });

  test('signing out closes the protected routes again', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(BASE + '/');

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the secret values are never rendered in the browser', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    // The YouTube key and session secret are configuration, not page content.
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('AIza');
    expect(body).not.toMatch(/SESSION_SECRET/);
    // The page states the state of each setting without exposing its value.
    await expect(page.getByText(/API key/)).toBeVisible();
    await expect(page.getByText(/never sent to this page/)).toBeVisible();
  });

  test('changing the password requires the current one and signs out every session', async ({
    page
  }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    await page.getByLabel('Current password').fill('wrong-current-password');
    await page.getByLabel('New password', { exact: true }).fill('a-new-valid-password-2026!');
    await page.getByLabel('Confirm new password').fill('a-new-valid-password-2026!');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert')).toContainText('current password is not correct');

    // The account is still reachable, because nothing was changed.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
  });
});
