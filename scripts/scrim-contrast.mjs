/**
 * Worst-case contrast measurement for glass scrims.
 *
 * The overlay cards and the hero caption float text over artwork inside a
 * glass panel. Contrast therefore depends on the image, which varies — so
 * this test forces the brightest possible backdrop (pure white) behind each
 * scrim, screenshots the rendered pixels where the text sits, and computes
 * the contrast of the caption colour against what was actually rendered.
 *
 * The result is a guarantee, not a sample: if it passes over pure white, it
 * passes over any frame the channel publishes.
 *
 * Usage: node scripts/scrim-contrast.mjs [base-url]
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';

function decodePng(buffer) {
  let o = 8, w = 0, h = 0, colorType = 6, idat = [];
  while (o < buffer.length) {
    const len = buffer.readUInt32BE(o);
    const type = buffer.toString('ascii', o + 4, o + 8);
    if (type === 'IHDR') {
      w = buffer.readUInt32BE(o + 8);
      h = buffer.readUInt32BE(o + 12);
      colorType = buffer[o + 17];
    }
    if (type === 'IDAT') idat.push(buffer.slice(o + 8, o + 8 + len));
    o += len + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // Playwright element screenshots are RGB (colorType 2, 3 channels); other
  // sources may be RGBA (colorType 6, 4). The channel count comes from the
  // file, never from assumption.
  const ch = colorType === 6 ? 4 : 3;
  const stride = w * ch, out = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0;
      const b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        // Paeth predictor: p = a + b - c, chosen by the smallest of
        // |b-c|, |a-c|, |a+b-2c|.
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v += pr;
      }
      out[y * stride + i] = v & 255;
    }
    prev = out.slice(y * stride, (y + 1) * stride);
  }
  return { w, h, ch, px: out };
}

function contrast(a, b) {
  const lum = (rgb) => {
    const [r, g, bl] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const browser = await chromium.launch();
const dir = mkdtempSync(join(tmpdir(), 'scrim-'));
const targets = [
  { url: `${BASE}/episodes`, selector: '.card--overlay', label: 'card scrim' },
  { url: `${BASE}/`, selector: '.brief-band__caption', label: 'hero caption' }
];

let worst = Infinity;
for (const target of targets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(target.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const count = await page.locator(target.selector).count();
  if (count === 0) { console.log(`${target.label}: none on page`); continue; }

  // Force the brightest possible backdrop behind the glass. The scrim itself
  // is never touched — only what renders behind it — so the measurement is of
  // the scrim doing its job, not of a replaced background.
  await page.evaluate((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      // For a caption nested in a media wrapper, whiten the wrapper, not the
      // caption: the caption's own gradient is the thing under test.
      const host = el.classList.contains('brief-band__caption') ? el.parentElement : el;
      const frame = host.querySelector('.card__frame') ?? host;
      const img = host.querySelector('img');
      if (img) img.style.visibility = 'hidden';
      frame.style.background = '#ffffff';
    });
  }, target.selector);

  const el = page.locator(target.selector).first();
  const box = await el.boundingBox();
  const shot = join(dir, 'scrim.png');
  await el.screenshot({ path: shot });
  const { w, h, ch, px } = decodePng(readFileSync(shot));

  // Sample the band where the caption text sits: the bottom quarter of the
  // scrim, inside the horizontal padding.
  const fg = [247, 243, 236]; // --paper, the caption colour
  let sum = [0, 0, 0], n = 0;
  const yStart = Math.floor(h * 0.75), yEnd = Math.floor(h * 0.95);
  const xStart = Math.floor(w * 0.08), xEnd = Math.floor(w * 0.92);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x += 2) {
      const i = (y * w + x) * ch;
      sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; n++;
    }
  }
  const bg = sum.map((v) => Math.round(v / n));
  const ratio = contrast(fg, bg);
  worst = Math.min(worst, ratio);
  console.log(
    `${target.label}: worst-case backdrop rgb(${bg.join(',')}) → contrast ${ratio.toFixed(2)}:1 ` +
      `(needs 4.5:1) ${ratio >= 4.5 ? 'PASS' : 'FAIL'}`
  );
  await page.close();
}
await browser.close();
console.log(worst >= 4.5 ? 'All glass scrims pass over a pure-white worst case.' : 'FAIL: a scrim cannot guarantee contrast.');
process.exit(worst >= 4.5 ? 0 : 1);
