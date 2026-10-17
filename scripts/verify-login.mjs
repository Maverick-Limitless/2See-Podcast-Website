/**
 * Manual smoke test of the authentication and admin flow.
 *
 * This is not the automated suite (see tests/); it verifies a running server
 * behaves the way the documentation claims.
 *
 * Usage: node scripts/verify-login.mjs [password]
 */

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function get(path, jar) {
  return fetch(`${BASE}${path}`, {
    headers: jar?.cookie ? { cookie: jar.cookie } : {},
    redirect: 'manual'
  });
}

function post(path, body, jar) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // SvelteKit checks the Origin header on every POST.
      origin: BASE,
      ...(jar?.cookie ? { cookie: jar.cookie } : {})
    },
    body: new URLSearchParams(body).toString(),
    redirect: 'manual'
  });
}

/** Merges Set-Cookie headers from a response into a jar, keeping attributes. */
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

const password = process.argv[2];

// 1. Unauthenticated visit to /admin must redirect to login.
{
  const response = await get('/admin');
  check('/admin redirects when signed out',
    response.status === 303 || response.status === 302,
    `HTTP ${response.status} → ${response.headers.get('location') ?? 'none'}`);
}

// 2. Login page serves a CSRF token.
let jar = null;
{
  const response = await get('/login');
  const html = await response.text();
  jar = applyCookies(response, null);
  const token = csrfFromHtml(html);
  check('login page includes a CSRF token', token !== null, token ? `${token.length} chars` : 'missing');
}

if (password) {
  // 3. Wrong password rejected, generically, with no session cookie issued.
  const wrong = await post('/login', {
    csrf: csrfFromHtml(await (await get('/login')).text()),
    username: 'tosi-podcast',
    password: 'definitely-not-the-password'
  }, jar);
  const wrongHtml = await wrong.text();
  check('wrong password is rejected',
    wrong.status === 401 || wrongHtml.includes('Incorrect'), `HTTP ${wrong.status}`);
  const wrongJar = applyCookies(wrong, jar);
  check('no session cookie for a failed login', !wrongJar.attrs['2see_session']);

  // 4. Correct password grants a session. A fresh token/cookie pair is used, so
  //    the GET that issued the CSRF token is the same jar the POST carries.
  const page = await get('/login');
  const pageHtml = await page.text();
  const loginJar = applyCookies(page, null);
  const ok = await post('/login', {
    csrf: csrfFromHtml(pageHtml),
    username: 'tosi-podcast',
    password
  }, loginJar);
  const location = ok.headers.get('location') ?? '';
  check('correct password signs in',
    ok.status === 303 && location.includes('/admin'), `HTTP ${ok.status} → ${location || 'none'}`);

  const sessionJar = applyCookies(ok, loginJar);
  const cookie = sessionJar.attrs['2see_session'] ?? '';
  check('session cookie is HttpOnly', /HttpOnly/i.test(cookie), cookie || 'absent');
  check('session cookie is SameSite', /SameSite=/i.test(cookie),
    /SameSite=\w+/i.exec(cookie)?.[0] ?? 'absent');
  check('session cookie is Secure in production', /Secure/i.test(cookie),
    /Secure/i.test(cookie) ? 'yes' : 'no');

  // 5. Panel screens load.
  const panel = await get('/admin', sessionJar);
  check('admin overview loads while signed in', panel.status === 200, `HTTP ${panel.status}`);
  const episodes = await get('/admin/episodes', sessionJar);
  check('episode management loads', episodes.status === 200, `HTTP ${episodes.status}`);
  const settings = await get('/admin/settings', sessionJar);
  check('settings load', settings.status === 200, `HTTP ${settings.status}`);

  // 6. Admin HTML must never be publicly cacheable.
  const cacheControl = panel.headers.get('cache-control') ?? '';
  check('admin HTML is not publicly cacheable',
    /no-store|no-cache|private/i.test(cacheControl), cacheControl || 'unset');

  // 7. Sign out, then confirm the protected route is closed again.
  const out = await post('/logout', {}, sessionJar);
  check('sign out redirects', out.status === 303, `HTTP ${out.status}`);
  const signedOut = applyCookies(out, sessionJar);
  const after = await get('/admin', signedOut);
  check('protected route is closed after sign out',
    after.status === 303 || after.status === 302, `HTTP ${after.status}`);
}

console.log('');
console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
