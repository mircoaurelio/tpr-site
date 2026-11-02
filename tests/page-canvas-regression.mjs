import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as playwright from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve(`.qa/page-canvas/${phase}`), records = [], browsers = new Map();
const engines = (process.env.TPR_CANVAS_ENGINES || 'chromium,webkit').split(',');
const routes = ['homepage-tpr/', 'about/', 'contatti/', 'eventi/', 'vivi-tpr/', 'prenota/', 'rooms/coworking/', 'rooms/reformer/', 'rooms/wellness/', 'rooms/bar/', 'rooms/media/'];
before(async () => { await mkdir(output, { recursive: true }); for (const name of engines) browsers.set(name, await playwright[name].launch({ headless: true })); });
after(async () => { await Promise.all([...browsers.values()].map(b => b.close())); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2)); });
async function open(name, route, width, scale = 1) {
  const page = await browsers.get(name).newPage({ viewport: { width, height: 952 }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function edgeColors(page, png, y) {
  return page.evaluate(async ({ png, y }) => {
    const image = new Image(); image.src = png; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return [1, image.width - 2].map(x => [...ctx.getImageData(x, Math.round(y), 1, 1).data].slice(0, 3));
  }, { png: 'data:image/png;base64,' + png.toString('base64'), y });
}
const nearColor = (rgb, expected) => rgb.every((value, i) => Math.abs(value - expected[i]) <= 2);

for (const name of engines) {
  test(`${name} white footer fills the viewport on all eleven updated routes`, { timeout: 100_000 }, async () => {
    const problems = [];
    for (const route of routes) {
      const page = await open(name, route, 1920);
      try {
        await page.locator('.preview-footer').evaluate(e => e.scrollIntoView());
        const data = await page.evaluate(() => {
          const footer = document.querySelector('.preview-footer');
          return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, footer: footer.getBoundingClientRect().toJSON(), grid: footer.querySelector('.preview-footer-top').getBoundingClientRect().toJSON() };
        });
        const png = await page.screenshot({ scale: 'css', animations: 'disabled', ...(route === 'contatti/' ? { path: path.join(output, `${name}-contacts-footer.png`) } : {}) });
        const colors = await edgeColors(page, png, data.footer.top + 24);
        if (Math.abs(data.footer.left) > 1 || Math.abs(data.footer.right - 1920) > 1 || !colors.every(rgb => nearColor(rgb, [255, 255, 255]))) problems.push(`${route}: footer exposes colored side rails`);
        if (Math.abs(data.grid.width - 1328) > 1) problems.push(`${route}: footer source content grid changed`);
        if (data.documentWidth > data.width + 1) problems.push(`${route}: horizontal document overflow`);
        records.push({ engine: name, route, ...data, colors });
      } finally { await page.close(); }
    }
    assert.deepEqual(problems, []);
  });
  test(`${name} Contacts artwork reaches the page edge without stretching the source grid`, { timeout: 80_000 }, async () => {
    const problems = [];
    for (const [width, scale] of [[1512, 1], [1536, 1.25], [1920, 1], [393, 1], [320, 1]]) {
      const page = await open(name, 'contatti/', width, scale);
      try {
        await page.locator('.preview-decoration').evaluate(image => image.decode());
        const data = await page.evaluate(() => {
          const box = s => document.querySelector(s).getBoundingClientRect().toJSON();
          return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, main: box('main'), art: box('.preview-page-art'), vector: box('.preview-decoration'), grid: box('.preview-contacts > .preview-two-columns') };
        });
        const png = await page.screenshot({ path: path.join(output, `${name}-contacts-${width}.png`), scale: 'css', animations: 'disabled' });
        const colors = await edgeColors(page, png, 80);
        if (data.main.left > 1 || data.main.right < width - 1 || data.art.left > 1 || data.art.right < width - 1) problems.push(`${width}px: Contacts decorative canvas is inset`);
        if (width >= 1512) {
          if (Math.abs(data.grid.width - 1352) > 1) problems.push(`${width}px: source text/form grid changed`);
          if (Math.abs(data.vector.width - 2135.951416) > 1) problems.push(`${width}px: original decorative SVG was stretched`);
          if (!nearColor(colors[0], [152, 202, 255])) problems.push(`${width}px: source ice artwork stops before the left edge`);
        }
        if (data.documentWidth > width + 1) problems.push(`${width}px: horizontal document overflow`);
        records.push({ engine: name, route: 'contatti/', scale, ...data, colors });
      } finally { await page.close(); }
    }
    assert.deepEqual(problems, []);
  });
  test(`${name} wide Vivi newsletter keeps its source grid through display-contents`, { timeout: 30_000 }, async () => {
    const page = await open(name, 'vivi-tpr/', 1920);
    try {
      const data = await page.evaluate(() => {
        const section = document.querySelector('.preview-vivi .preview-newsletter');
        const heading = section.querySelector('h2').getBoundingClientRect(), lead = section.querySelector('.preview-lead').getBoundingClientRect();
        return { left: heading.left, right: lead.right, span: lead.right - heading.left };
      });
      records.push({ engine: name, check: 'vivi-newsletter-grid', ...data });
      assert.ok(Math.abs(data.left - 284) < 1 && Math.abs(data.right - 1636) < 1 && Math.abs(data.span - 1352) < 1,
        `the newsletter must retain the centered source grid: ${JSON.stringify(data)}`);
    } finally { await page.close(); }
  });
}
