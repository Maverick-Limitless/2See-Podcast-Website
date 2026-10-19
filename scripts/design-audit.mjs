/**
 * Design-proportion audit.
 *
 * Measures what the design system actually renders — resolved spacing and
 * type tokens, the opening composition, card aspect ratios, section rhythm —
 * so proportional claims can be documented against real numbers instead of
 * aesthetic intuition. The golden ratio (φ ≈ 1.618) is reported as a reference
 * wherever a ratio is measured; it is a comparison point, never a target the
 * layout is forced to hit.
 *
 * Usage: node scripts/design-audit.mjs [base-url]
 */

import { chromium } from '@playwright/test';

const BASE = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const PHI = 1.618;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route(/ytimg\.com/, (route) => route.abort());
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);

const measurements = await page.evaluate(() => {
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };

  const out = {
    spacing: {},
    type: {},
    opening: {},
    cards: [],
    rhythm: {}
  };

  for (const name of ['--u0', '--u1', '--u2', '--u3', '--u4', '--u5', '--u6', '--u7', '--u8']) {
    const value = token(name);
    if (value !== '') out.spacing[name] = value;
  }
  for (const name of ['--t-micro', '--t-small', '--t-body', '--t-lead', '--t-h4', '--t-h3', '--t-h2', '--t-h1', '--t-display']) {
    const value = token(name);
    if (value !== '') out.type[name] = value;
  }

  const text = rect(document.querySelector('.brief-band__text'));
  const media = rect(document.querySelector('.brief-band__media'));
  const title = rect(document.querySelector('.brief-band__title'));
  const lede = rect(document.querySelector('.brief-band__lede'));
  out.opening = { text, media, title, lede };

  for (const card of [...document.querySelectorAll('.mosaic .card')].slice(0, 6)) {
    const mediaEl = card.querySelector('.card__media, .card--overlay');
    const r = rect(card);
    const m = rect(mediaEl);
    if (r) out.cards.push({ card: r, media: m });
  }

  const section = document.querySelector('.section');
  if (section) {
    const s = getComputedStyle(section);
    out.rhythm = { paddingBlock: s.paddingBlock, gap: s.rowGap };
  }
  // Resolve the clamp() tokens the way the page actually does: apply each to
  // a probe element and read back the computed size.
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  out.resolvedType = {};
  for (const name of ['--t-micro', '--t-small', '--t-body', '--t-lead', '--t-h4', '--t-h3', '--t-h2', '--t-h1', '--t-display']) {
    probe.style.fontSize = `var(${name})`;
    out.resolvedType[name] = getComputedStyle(probe).fontSize;
  }
  probe.remove();
  const titleStyle = getComputedStyle(document.querySelector('.brief-band__title'));
  out.rhythm.titleSize = titleStyle.fontSize;
  out.rhythm.titleLineHeight = titleStyle.lineHeight;
  const ledeStyle = getComputedStyle(document.querySelector('.brief-band__lede'));
  out.rhythm.ledeSize = ledeStyle.fontSize;
  out.rhythm.ledeLineHeight = ledeStyle.lineHeight;
  const measure = document.querySelector('.brief-band__lede');
  out.rhythm.ledeMeasurePx = measure ? Math.round(measure.getBoundingClientRect().width) : null;

  return out;
});

await browser.close();

console.log('Design-proportion audit — viewport 1280×900, route /');
console.log('φ (golden ratio) =', PHI);
console.log('\nResolved spacing tokens:');
for (const [name, value] of Object.entries(measurements.spacing)) console.log(`  ${name} = ${value}`);
console.log('\nResolved type scale:');
for (const [name, value] of Object.entries(measurements.type)) console.log(`  ${name} = ${value}`);

const { opening } = measurements;
if (opening.text && opening.media && opening.text.w > 0 && opening.media.w > 0) {
  const wide = Math.max(opening.text.w, opening.media.w);
  const narrow = Math.min(opening.text.w, opening.media.w);
  console.log(`\nOpening composition:`);
  console.log(`  text ${opening.text.w}×${opening.text.h}, media ${opening.media.w}×${opening.media.h}`);
  console.log(`  text:media width ratio = ${(wide / narrow).toFixed(3)}  (φ = ${PHI})`);
}
if (opening.title && opening.lede && opening.lede.h > 0) {
  console.log(`  title ${opening.title.w}×${opening.title.h}, lede block ${opening.lede.w}×${opening.lede.h}`);
  console.log(`  title:lede height ratio = ${(opening.title.h / opening.lede.h).toFixed(3)}`);
}

console.log('\nFirst mosaic cards (card and media aspect ratios):');
for (const item of measurements.cards) {
  const cardAspect = item.card.w && item.card.h ? (item.card.w / item.card.h).toFixed(3) : '—';
  const mediaAspect = item.media && item.media.w && item.media.h ? (item.media.w / item.media.h).toFixed(3) : '—';
  console.log(`  card ${item.card.w}×${item.card.h} (aspect ${cardAspect}), media ${item.media ? `${item.media.w}×${item.media.h}` : 'none'} (aspect ${mediaAspect})`);
}

console.log('\nType-scale consecutive ratios (resolved at this viewport):');
const sizes = Object.entries(measurements.resolvedType)
  .map(([name, value]) => ({ name, px: parseFloat(value) }))
  .filter((t) => Number.isFinite(t.px))
  .sort((a, b) => a.px - b.px);
for (let i = 1; i < sizes.length; i += 1) {
  console.log(`  ${sizes[i - 1].name}→${sizes[i].name}: ${(sizes[i].px / sizes[i - 1].px).toFixed(3)}`);
}

console.log('\nSection rhythm:');
for (const [name, value] of Object.entries(measurements.rhythm)) console.log(`  ${name} = ${value}`);
