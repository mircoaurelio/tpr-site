import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as playwright from 'playwright';

// Catches the body-blue rails around pink Events after only the hero and
// Room had been made full width. Check painted pixels, not just hidden overflow.
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve(`.qa/home-section-edges/${phase}`);
const engines = (process.env.TPR_SECTION_ENGINES || 'chromium,webkit').split(',');
const browsers = new Map(), records = [];
const cases = [
  { width: 1512, height: 952, scale: 1 },
  { width: 1536, height: 762, scale: 1.25 },
  { width: 1920, height: 1080, scale: 1 },
  { width: 2560, height: 1440, scale: 1 },
  { width: 1280, height: 635, scale: 1.5 },
  { width: 393, height: 852, scale: 1 },
  { width: 320, height: 568, scale: 1 },
];
before(async () => {
  await mkdir(output, { recursive: true });
  for (const name of engines) browsers.set(name, await playwright[name].launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(b => b.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2));
});

for (const name of engines) for (const entry of cases) {
  test(`${name} Home Event color and photograph reach both edges at ${entry.width}px DPR${entry.scale}`, { timeout: 30_000 }, async () => {
    const page = await browsers.get(name).newPage({
      viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: entry.scale,
      isMobile: entry.width <= 720, hasTouch: entry.width <= 720, reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
      await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle', timeout: 15_000 });
      await page.evaluate(async () => { await document.fonts.ready; await document.querySelector('.preview-event-composite').decode(); });
      await page.locator('.preview-home-events').evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY));
      await page.waitForFunction(() => Math.abs(document.querySelector('.preview-home-events').getBoundingClientRect().top) < 1);
      const data = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const image = document.querySelector('.preview-event-composite');
        return {
          viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
          events: box('.preview-home-events'), copy: box('.preview-home-events > .preview-two-columns'),
          image: box('.preview-event-composite'), figure: box('.preview-home-event-photo'),
          naturalImage: [image.naturalWidth, image.naturalHeight],
          membership: box('.preview-membership'), newsletter: box('.preview-newsletter'), footer: box('.preview-footer'),
        };
      });
      const screenshot = await page.screenshot({ path: path.join(output, `${name}-${entry.width}.png`), scale: 'css', animations: 'disabled' });
      const edges = await page.evaluate(async png => {
        const image = new Image(); image.src = png; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const { data, width } = context.getImageData(0, 0, canvas.width, canvas.height);
        const sample = (x, y) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
        return [sample(1, 40), sample(width - 2, 40), sample(1, 80), sample(width - 2, 80)];
      }, 'data:image/png;base64,' + screenshot.toString('base64'));
      const problems = [];
      if (data.documentWidth > data.viewport + 1) problems.push('document has horizontal overflow');
      for (const key of ['events', 'membership', 'newsletter', 'footer']) {
        if (Math.abs(data[key].left) > 1 || Math.abs(data[key].right - data.viewport) > 1) problems.push(`${key} has exposed side gutters`);
      }
      if (data.image.left > 1 || data.image.right < data.viewport - 1) problems.push('the original Event photo/eye stops before the viewport edge');
      if (!data.naturalImage.every(n => n > 0)) problems.push('the original Event composition did not decode');
      if (entry.width >= 1512 && Math.abs(data.copy.width - 1352) > 1) problems.push('source Event copy grid must remain1352px wide');
      if (entry.width >= 1512 && data.image.bottom > data.events.bottom + 1) problems.push('Events clips the enlarged original composition at its bottom');
      for (const rgb of edges) if (rgb.some((n, i) => Math.abs(n - [255, 123, 255][i]) > 2)) problems.push(`Event edge must paint source pink, got${rgb}`);
      records.push({ engine: name, ...entry, ...data, edges, errors, problems });
      assert.deepEqual(errors, []);
      assert.deepEqual(problems, [], `${name} ${entry.width}px: ${JSON.stringify({ data, edges })}`);
    } finally { await page.close(); }
  });
}

for (const name of engines) {
  test(`${name} wide Home partner heading stays visible against its decorative background`, { timeout: 30_000 }, async () => {
    const page = await browsers.get(name).newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    try {
      await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle', timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      const title = page.locator('.preview-partners h2');
      const actual = await title.screenshot({ scale: 'css', animations: 'disabled' });
      const backdrop = await title.screenshot({ scale: 'css', animations: 'disabled', style: '.preview-partners h2 { color: transparent !important; }' });
      const mask = await title.screenshot({ scale: 'css', animations: 'disabled', style: '.preview-partners h2 { color: #ff0000 !important; }' });
      const contrast = await page.evaluate(async images => {
        const pixels = await Promise.all(images.map(async png => {
          const image = new Image(); image.src = png; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        }));
        let glyphPixels = 0, visiblePixels = 0;
        for (let i = 0; i < pixels[2].length; i += 4) {
          // Fully painted glyph interiors, independently marked in red.
          if (pixels[2][i] < 245 || pixels[2][i + 1] > 10 || pixels[2][i + 2] > 10) continue;
          glyphPixels++;
          const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(pixels[0][i + channel] - pixels[1][i + channel])));
          if (difference > 40) visiblePixels++;
        }
        return { glyphPixels, visiblePixels, fraction: visiblePixels / glyphPixels };
      }, [actual, backdrop, mask].map(png => 'data:image/png;base64,' + png.toString('base64')));
      records.push({ check: 'partners-visible-ink', engine: name, contrast });
      assert.ok(contrast.glyphPixels > 100 && contrast.fraction >= .97,
        `the original background must not hide partner heading letters: ${JSON.stringify(contrast)}`);
    } finally { await page.close(); }
  });
}
