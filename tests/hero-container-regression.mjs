import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repository, '.qa/hero-container/regression');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const measurements = [];
let browser;

const cases = [
  { label: 'source-1512', width: 1512, height: 952, scale: 1 },
  { label: 'wide-1920', width: 1920, height: 1080, scale: 1 },
  ...[901, 930, 1024, 1163, 1280].map(width => ({ label: `desktop-${width}`, width, height: 952, scale: 1 })),
  // CSS viewport and DPR equivalents for a physical1920px-wide desktop at
  //125/150percent zoom. DPR alone changes rasterization, not layout width.
  { label: '1920-equivalent-125percent', width: 1536, height: 762, scale: 1.25 },
  { label: '1920-equivalent-150percent', width: 1280, height: 635, scale: 1.5 },
  { label: '1024-device-scale-125percent', width: 1024, height: 768, scale: 1.25 },
  { label: '1024-device-scale-150percent', width: 1024, height: 768, scale: 1.5 },
  { label: 'mobile-320', width: 320, height: 568, scale: 1 },
  { label: 'mobile-393', width: 393, height: 852, scale: 1 },
];

before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  try { await browser?.close(); }
  finally { await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(measurements, null, 2)); }
});

for (const entry of cases) {
  test(`Home hero container and title remain contained at ${entry.label}`, { timeout: 20_000 }, async () => {
    const context = await browser.newContext({
      viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: entry.scale,
      reducedMotion: 'reduce', isMobile: entry.width <= 720, hasTouch: entry.width <= 720,
    });
    await context.route('**/*', route => {
      const request = route.request();
      return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === base.origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000); page.setDefaultNavigationTimeout(12_000);
    const errors = [], httpErrors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
    try {
      await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.preview-hero-composite').evaluate(image => image.decode().catch(() => {}));
      const data = await page.evaluate(() => {
        const describe = element => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          return { tag: element.tagName, id: element.id, className: typeof element.className === 'string' ? element.className : '', box: box.toJSON(), overflowX: style.overflowX, overflowY: style.overflowY, maxWidth: style.maxWidth, fontSize: parseFloat(style.fontSize) };
        };
        const main = document.querySelector('main'), hero = document.querySelector('.hero'), image = hero.querySelector('.preview-hero-composite'), title = hero.querySelector('h1');
        const range = document.createRange(); range.selectNodeContents(title);
        const lines = [...title.querySelectorAll('span')].map(span => { const line = document.createRange(); line.selectNodeContents(span); return { text: span.textContent.trim(), box: line.getBoundingClientRect().toJSON(), layoutBox: span.getBoundingClientRect().toJSON() }; });
        const escaped = [...main.querySelectorAll('*')].filter(element => {
          const box = element.getBoundingClientRect(), style = getComputedStyle(element);
          if (!box.width || !box.height || box.right <= innerWidth + 1 || style.display === 'none' || style.visibility === 'hidden' || element.closest('[inert]')) return false;
          // Exclude intentional children of local carousels/clipping masks.
          // Only boxes whose overflow can propagate to main are diagnostic.
          for (let ancestor = element.parentElement; ancestor && ancestor !== main; ancestor = ancestor.parentElement) if (getComputedStyle(ancestor).overflowX !== 'visible') return false;
          return true;
        }).map(describe).sort((a, b) => b.box.right - a.box.right).slice(0, 12);
        return {
          url: location.href, width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollX,
          documentWidth: document.documentElement.scrollWidth, main: describe(main), hero: describe(hero), image: describe(image),
          imageSource: image.currentSrc, naturalWidth: image.naturalWidth, title: describe(title), titleText: range.getBoundingClientRect().toJSON(), lines,
          propagatingOverflow: escaped,
        };
      });
      const problems = [];
      if (Math.abs(data.hero.box.left) > 1 || Math.abs(data.hero.box.right - data.width) > 1) problems.push('hero must reach both viewport edges without an outer blue gutter');
      if (Math.abs(data.image.box.left - data.hero.box.left) > 1 || Math.abs(data.image.box.right - data.hero.box.right) > 1 || !data.naturalWidth) problems.push('decoded source photograph must fill its hero container');
      if (data.documentWidth > data.width + 1) problems.push('document must not have hidden horizontal overflow');
      // Native Range height includes unused font descent. The source mobile
      // 90% leading places that descent outside its line without clipping ink.
      // Check horizontal text extents and the actual CSS line boxes vertically.
      for (const line of data.lines) if (!line.text || line.box.left < data.hero.box.left - 1 || line.box.right > data.hero.box.right + 1 || line.layoutBox.top < data.hero.box.top - 1 || line.layoutBox.bottom > data.hero.box.bottom + 1) problems.push(`hero title line must remain fully readable: ${line.text}`);
      if (data.lines.length !== 2) problems.push('both hero title lines must remain present');
      if (entry.label === 'source-1512') {
        if (Math.abs(data.hero.box.height - 952) > 1) problems.push('1512px source hero retains its952px height');
        if (Math.abs(data.title.fontSize - 160) > .1) problems.push('1512px source hero retains its160px heading');
      }
      measurements.push({ ...entry, ...data, errors, httpErrors, problems });
      if (problems.length) {
        await page.screenshot({ path: path.join(output, `${entry.label}-${phase}-hero.png`), animations: 'disabled' });
        if (data.documentWidth > data.width + 1) await page.locator('.preview-partners').screenshot({ path: path.join(output, `${entry.label}-${phase}-partners.png`), animations: 'disabled' });
      }
      assert.deepEqual(problems, [], `${entry.label}: ${JSON.stringify({ width: data.width, documentWidth: data.documentWidth, hero: data.hero.box, image: data.image.box, title: data.titleText, overflow: data.propagatingOverflow })}`);
    } finally { await context.close(); }
  });
}

test('1920px booking CTA retains a blue backdrop for its white text', { timeout: 20_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  try {
    await page.route('**/*', route => {
      const request = route.request();
      return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === base.origin ? route.continue() : route.abort();
    });
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; await document.querySelector('.preview-hero-composite').decode(); });
    const cta = await page.locator('.preview-header .preview-button').evaluate(element => ({
      box: element.getBoundingClientRect().toJSON(), color: getComputedStyle(element).color,
    }));
    await page.screenshot({ path: path.join(output, `wide-1920-cta-${phase}.png`), animations: 'disabled' });
    // Sample the actual painted photograph/background at the control's position.
    // Hiding the header removes its white glyphs and outline without moving art.
    const backdrop = await page.screenshot({ animations: 'disabled', style: '.preview-header { visibility: hidden !important; }' });
    const coverage = await page.evaluate(async ({ png, box }) => {
      const image = new Image(); image.src = png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const { data, width } = context.getImageData(0, 0, canvas.width, canvas.height);
      let blue = 0, total = 0;
      for (let y = Math.ceil(box.top); y < box.bottom; y += 4) {
        for (let x = Math.ceil(box.left); x < box.right; x += 4) {
          const i = (y * width + x) * 4;
          if (Math.abs(data[i] - 44) <= 8 && Math.abs(data[i + 1] - 100) <= 8 && Math.abs(data[i + 2] - 232) <= 8) blue++;
          total++;
        }
      }
      return { blue, total, fraction: blue / total };
    }, { png: 'data:image/png;base64,' + backdrop.toString('base64'), box: cta.box });
    measurements.push({ check: 'wide-1920-cta-backdrop', cta, coverage });
    assert.equal(cta.color, 'rgb(255, 255, 255)', 'the source booking CTA retains white text');
    assert.ok(coverage.total > 0 && coverage.fraction >= .95,
      `white booking text must sit over blue rather than the bright office photo: ${JSON.stringify({ cta, coverage })}`);
  } finally { await page.close(); }
});
