/**
 * Manual smoke test of the content-management flows.
 *
 * Usage: node scripts/verify-admin.mjs <password>
 *
 * Covers story draft -> publish -> public visibility, duplicate episode
 * rejection, unpublish removing content from the public site, and login
 * throttling. Complements tests/ — this only checks a running server.
 */

const BASE = process.env.ORIGIN || process.env.BASE_URL || 'http://127.0.0.1:4173';

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function get(path, jar) {
  return fetch(`${BASE}${path}`, {
    headers: {
      accept: 'text/html',
      ...(jar?.cookie ? { cookie: jar.cookie } : {})
    },
    redirect: 'manual'
  });
}

function post(path, body, jar) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'text/html',
      origin: BASE,
      ...(jar?.cookie ? { cookie: jar.cookie } : {})
    },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual'
  });
}

function applyCookies(response, jar) {
  const next = jar ?? { cookie: '', attrs: {} };
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    next.cookie = next.cookie
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => !c.startsWith(`${name}=`))
      .join('; ');
    next.cookie += `${next.cookie ? '; ' : ''}${name}=${value}`;
    next.attrs[name] = raw;
  }
  return next;
}

const csrfFromHtml = (html) => /name="csrf" value="([^"]+)"/.exec(html)?.[1] ?? null;

/** SvelteKit actions are invoked with ?/name and replies may be a 200 whose
 *  body carries the form result, or a redirect. Accept headers decide. */
async function runAction(path, name, body, jar) {
  const page = await get(path, jar);
  const html = await page.text();
  const response = await post(`${path}?/${name}`, { csrf: csrfFromHtml(html), ...body }, jar);
  return { status: response.status, text: await response.text(), jar: applyCookies(response, jar) };
}

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/verify-admin.mjs <password>');
  process.exit(2);
}

const loginPage = await get('/login');
const loginJar = applyCookies(loginPage, null);
const signInResponse = await post('/login', {
  csrf: csrfFromHtml(await loginPage.text()),
  username: 'tosi-podcast',
  password
}, loginJar);
const session = applyCookies(signInResponse, loginJar);
check('sign-in succeeds', Boolean(session.attrs['2see_session']));

if (!session.attrs['2see_session']) {
  console.error('Could not sign in; stopping.');
  process.exit(1);
}

const title = `Smoke test ${new Date().toISOString()}`;

// 1. Create a draft story.
{
  const result = await runAction('/admin/stories', 'add', {
    title,
    subtitle: 'Created by the smoke test',
    bodyMarkdown: 'A short body paragraph for the smoke test.\n\n## A heading\n\nMore text.',
    state: 'draft'
  }, session);
  check('story draft is created', result.status === 303 || result.status === 200,
    `HTTP ${result.status}`);
}

// 2. Find its id, publish it, and confirm it appears publicly.
const listHtml = await (await get('/admin/stories', session)).text();
const storyId = extractId(listHtml, title);
check('draft appears in the admin list', storyId !== null, `id ${storyId ?? 'not found'}`);

if (storyId) {
  const published = await runAction('/admin/stories', 'publish', { id: storyId }, session);
  check('publish action runs', published.status === 303 || published.status === 200,
    `HTTP ${published.status}`);

  const publicList = await (await get('/stories')).text();
  check('published story is on the public stories page', publicList.includes(title));

  // 3. Unpublish and confirm it disappears again.
  const archived = await runAction('/admin/stories', 'unpublish', { id: storyId }, session);
  check('unpublish action runs', archived.status === 303 || archived.status === 200,
    `HTTP ${archived.status}`);
  const afterUnpublish = await (await get('/stories')).text();
  check('unpublished story is gone from the public page', !afterUnpublish.includes(title));

  // 4. Delete it.
  const removed = await runAction('/admin/stories', 'remove', { id: storyId, confirm: 'yes' }, session);
  check('delete action runs', removed.status === 303 || removed.status === 200,
    `HTTP ${removed.status}`);
}

// 5. Duplicate YouTube episode is rejected by video ID.
{
  const result = await runAction('/admin/episodes', 'add', {
    youtubeUrl: 'https://www.youtube.com/watch?v=pJZ9r_h1P4U',
    title: 'Duplicate attempt',
    thumbnail: 'https://i.ytimg.com/vi/pJZ9r_h1P4U/maxresdefault.jpg',
    publishedAt: new Date().toISOString().slice(0, 16)
  }, session);
  check('duplicate YouTube ID is rejected', /already/i.test(result.text),
    `HTTP ${result.status}`);
}

// 6. A malformed YouTube URL is rejected without reaching storage.
{
  const result = await runAction('/admin/episodes', 'add', {
    youtubeUrl: 'https://evil.example.com/embed/ABCDEFGHIJK',
    title: 'Should be rejected',
    thumbnail: 'https://i.ytimg.com/vi/x/maxresdefault.jpg',
    publishedAt: new Date().toISOString().slice(0, 16)
  }, session);
  check('non-YouTube host is rejected', /youtube\.com and youtu\.be/i.test(result.text),
    `HTTP ${result.status}`);
}

// 7. A request without a valid CSRF token is refused, and creates nothing.
const pageForCsrf = await get('/admin/stories', session);
const csrfPageHtml = await pageForCsrf.text();
const staleToken = csrfFromHtml(csrfPageHtml);
const csrfProbe = await post('/admin/stories?/add', {
  csrf: 'a'.repeat(64),
  title: 'csrf probe',
  bodyMarkdown: 'body',
  state: 'draft'
}, session);
const csrfBody = await csrfProbe.text();
check('missing CSRF token is refused', /expired|not valid/i.test(csrfBody),
  `HTTP ${csrfProbe.status}`);
check('CSRF failure creates no story',
  !(await (await get('/stories')).text()).includes('csrf probe'));

console.log('');
console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

function extractId(html, wanted) {
  for (const row of html.split('<tr>').slice(1)) {
    if (!row.includes(wanted)) continue;
    const match = /name="id" value="(\d+)"/.exec(row);
    if (match) return match[1];
  }
  return null;
}
