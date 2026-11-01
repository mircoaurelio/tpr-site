import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const engine = process.env.TPR_ENGINE || 'chromium';
const source = JSON.parse(await readFile(new URL('../design/room-card-faces.json', import.meta.url), 'utf8')).rooms;
const inks = { coworking: [44, 100, 232], reformer: [63, 153, 65], wellness: [63, 153, 65], bar: [235, 100, 43], media: [44, 100, 232] };
const output = path.resolve('.qa/figma-full-audit-20261101/source-arrow', process.env.TPR_QA_PHASE || engine);
const records = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await ({ chromium, webkit })[engine].launch(); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2)); });

// The reference is the original PDF card face, not the icon selected by CSS.
// A typographic diagonal arrow cannot match its irregular circle + chevron.
for (const width of [1512, 393]) test(`${engine}: standalone ${width}px card arrows retain the original PDF silhouette`, { timeout: 45000 }, async () => {
  const context = await browser.newContext({ viewport: { width, height: 952 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage();
  try {
    for (const [key, ink] of Object.entries(inks)) {
      await page.goto(new URL(`rooms/${key}/`, base).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-room-explore]').click();
      const card = page.locator('.preview-room-card').first();
      const actual = await card.screenshot();
      const cardBox = await card.boundingBox(), iconBox = await card.locator('.preview-room-card-label > span').boundingBox();
      const actualCrop = [Math.floor(iconBox.x - cardBox.x - 4), Math.floor(iconBox.y - cardBox.y - 4), Math.ceil(iconBox.width + 8), Math.ceil(iconBox.height + 8)];
      await writeFile(path.join(output, `${key}-${width}.png`), actual);
      const result = await page.evaluate(async ({ actual, source, ink, actualCrop }) => {
        const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
        const [painted, original] = await Promise.all([load(`data:image/png;base64,${actual}`), load(source)]);
        const normalize = (image, crop) => {
          const canvas = document.createElement('canvas'); canvas.width = crop[2]; canvas.height = crop[3];
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, ...crop, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const points = []; let left = Infinity, top = Infinity, right = -1, bottom = -1;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (pixels[i + 3] > 127 && ink.every((value, channel) => Math.abs(value - pixels[i + channel]) < 45)) {
              points.push([x, y]); left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
          }
          const grid = new Set();
          for (const [x, y] of points) grid.add(Math.min(31, Math.floor((x - left) * 32 / (right - left + 1))) + Math.min(31, Math.floor((y - top) * 32 / (bottom - top + 1))) * 32);
          return { grid, bounds: [right - left + 1, bottom - top + 1], pixels: points.length };
        };
        const a = normalize(painted, actualCrop);
        const s = normalize(original, [Math.floor(original.width * .85), Math.floor(original.height * .8), Math.floor(original.width * .12), Math.floor(original.height * .16)]);
        const intersection = [...a.grid].filter(point => s.grid.has(point)).length;
        return { intersectionOverUnion: intersection / (a.grid.size + s.grid.size - intersection), actualBounds: a.bounds, sourceBounds: s.bounds, coloredPixels: a.pixels };
      }, { actual: actual.toString('base64'), source: new URL(source[key].cards[0].front, base).href, ink, actualCrop });
      records.push({ key, width, ...result });
      assert.ok(result.intersectionOverUnion > .70, `${key}: painted arrow must match the original circle/chevron silhouette; overlap ${result.intersectionOverUnion}`);
    }
  } finally { await context.close(); }
});
