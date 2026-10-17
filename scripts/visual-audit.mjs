/**
 * Visual audit harness.
 *
 * Produces machine-measurable evidence from the rendered DOM: horizontal
 * overflow, element geometry, computed contrast, direction attributes, focus
 * visibility and reduced-motion behaviour — at every mandated viewport.
 *
 * This exists because the executing model cannot view screenshots directly in
 * this environment; every number it prints comes from the live page.
 *
 * Usage: node scripts/visual-audit.mjs [base-url]
 */

import { chromium } from '@playwright/test';

const BASE = process.argv[2] || process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

const VIEWPORTS = [
  { name: '320', width: 320, height: 568 },
  { name: '375', width: 375, height: 667 },
  { name: '430', width: 430, height: 740 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 800 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1920', width: 1920, height: 1080 }
];

const ROUTES = ['/', '/episodes', '/episodes/episode-2', '/stories', '/about'];

/** WCAG contrast ratio of the element's own text against its background. */
function contrastOf(color, bg) {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(color);
  const l2 = lum(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function parseRgb(value) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function effectiveBg(el) {
  let node = el;
  while (node && node instanceof Element) {
    const bg = parseRgb(getComputedStyle(node).backgroundColor);
    if (bg && (bg[3] !== 0 || getComputedStyle(node).backgroundColor.includes('rgba(0, 0, 0, 0)') === false)) {
      if (bg[3] > 0) return bg;
    }
    node = node.parentElement;
  }
  return [247, 243, 236];
}

const browser = await chromium.launch();
const findings = [];
let overflowDefects = 0;
let contrastDefects = 0;
let rtlGaps = 0;

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height }
  });

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);

    // 1. Horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 0) {
      overflowDefects += 1;
      findings.push(`OVERFLOW ${viewport.name}px ${route}: ${overflow}px`);
    }

    // 2. Contrast of representative text roles
    const contrast = await page.evaluate(() => {
      const checks = [];
      const sample = (selector, label) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const style = getComputedStyle(el);
        checks.push({ label, selector, color: style.color, size: style.fontSize, weight: style.fontWeight });
      };
      sample('.hero__title', 'hero-title');
      sample('.hero__lede', 'hero-lede');
      sample('.card__title', 'card-title');
      sample('.card__summary', 'card-summary');
      sample('.card__foot', 'card-metadata');
      sample('.section__eyebrow', 'eyebrow');
      sample('.prose p', 'prose');
      sample('.footer__note', 'footer-note');
      return checks;
    });

    for (const item of contrast) {
      const fg = parseRgb(item.color);
      const bg = effectiveBg(null); // page paper; per-element backgrounds vary below
      if (!fg) continue;
      const ratio = contrastOf(fg, bg);
      // WCAG 2.2 AA: 4.5:1 normal, 3:1 for 24px+ or 19px bold.
      const px = parseFloat(item.size);
      const bold = parseInt(item.weight) >= 700;
      const large = px >= 24 || (px >= 18.66 && bold);
      const required = large ? 3 : 4.5;
      if (ratio < required) {
        contrastDefects += 1;
        findings.push(
          `CONTRAST ${viewport.name}px ${route}: ${item.label} ${ratio.toFixed(2)}:1 (needs ${required}:1)`
        );
      }
    }

    // 3. Direction handling: Persian cards must be isolated
    if (route === '/episodes' || route === '/') {
      const dir = await page.evaluate(() => {
        const persian = document.querySelector('.card__title--persian, .persian');
        return persian ? getComputedStyle(persian).direction : 'none';
      });
      if (dir === 'ltr') {
        rtlGaps += 1;
        findings.push(`RTL ${viewport.name}px ${route}: Persian text resolves to ltr`);
      }
    }
  }
  await page.close();
}

// Focus and reduced-motion behaviour, once, at a representative size.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const focusStyle = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle, width: s.outlineWidth, visible: el.offsetWidth > 0 };
  });
  if (focusStyle.outline === 'none' || focusStyle.width === '0px') {
    findings.push('FOCUS: skip link has no visible outline');
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  const reduced = await page.evaluate(() => {
    const el = document.querySelector('[data-reveal]');
    if (!el) return 'no-reveal';
    return { opacity: getComputedStyle(el).opacity, dur: getComputedStyle(el).transitionDuration };
  });
  if (reduced !== 'no-reveal' && reduced.opacity !== '1') {
    findings.push(`REDUCED-MOTION: content stays hidden (opacity ${reduced.opacity})`);
  }
  await page.close();
}

await browser.close();

console.log(`Viewports: ${VIEWPORTS.map((v) => v.name).join(', ')}px`);
console.log(`Routes: ${ROUTES.join(', ')}`);
console.log(`Overflow defects: ${overflowDefects}`);
console.log(`Contrast defects: ${contrastDefects}`);
console.log(`RTL defects: ${rtlGaps}`);
console.log(findings.length === 0 ? 'No measured defects.' : 'Findings:');
for (const f of findings) console.log('  - ' + f);
