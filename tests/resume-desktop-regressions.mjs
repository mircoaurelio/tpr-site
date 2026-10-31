import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.TPR_PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) {
  if (process.env.TPR_PLAYWRIGHT_MODULE || !process.env.APPDATA) throw error;
  playwright = require(path.join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright'));
}
const output = process.env.TPR_QA_OUTPUT ? path.resolve(process.env.TPR_QA_OUTPUT) : path.resolve('.qa/resume-desktop', `regression-${process.env.TPR_QA_PHASE || 'after'}`);
const measurements = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await playwright.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2)); });

async function pageAt(route, width = 1512) {
  const page = await browser.newPage({ viewport: { width, height: 952 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const resources = { check: 'page-resources', route, viewport: width, failed: [], errors: [], stylesheets: [], httpErrors: [] };
  measurements.push(resources);
  page.on('requestfailed', request => resources.failed.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('pageerror', error => resources.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') resources.errors.push(message.text()); });
  page.on('response', response => {
    if (response.request().resourceType() === 'stylesheet') resources.stylesheets.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] });
    if (response.status() >= 400) resources.httpErrors.push({ url: response.url(), status: response.status() });
  });
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.goto(new URL(route, process.env.TPR_BASE_URL || 'http://127.0.0.1:4173').href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  resources.parsedStylesheets = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ url: link.href, rules: link.sheet?.cssRules.length || 0, disabled: link.sheet?.disabled })));
  assert.deepEqual(resources.failed, [], 'required page resources must finish loading');
  assert.deepEqual(resources.httpErrors, [], 'required page resources must return successful responses');
  assert.deepEqual(resources.errors, [], 'page initialization must not raise browser errors');
  assert.ok(resources.parsedStylesheets.every(sheet => sheet.rules > 0 && !sheet.disabled), `required stylesheet failed to parse: ${JSON.stringify(resources)}`);
  return page;
}
async function imagePixels(buffer, analyze) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async ({ data, analyze }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      return new Function('pixels', `return (${analyze})(pixels)`)(pixels);
    }, { data: buffer.toString('base64'), analyze: String(analyze) });
  } finally { await page.close(); }
}

// Catches a smooth background hiding the approved irregular paper silhouette.
test('Home Pilates callout paints a torn outer edge without clipping its content', async () => {
  for (const width of [1512, 768, 393, 320]) {
    const page = await pageAt('/homepage-tpr/', width);
    try {
      const banner = page.locator('.preview-pilates-banner');
      const screenshot = await banner.screenshot({ path: path.join(output, `pilates-${width}.png`) });
      const contour = await imagePixels(screenshot, ({ data, width, height }) => {
        const top = [], bottom = [];
        const yellow = (x, y) => { const i = (y * width + x) * 4; return data[i] > 245 && data[i + 1] > 165 && data[i + 1] < 225 && data[i + 2] < 35; };
        for (let x = Math.ceil(width * .15); x < width * .85; x++) {
          for (let y = 0; y < 14; y++) if (yellow(x, y)) { top.push(y); break; }
          for (let y = height - 1; y >= height - 14; y--) if (yellow(x, y)) { bottom.push(height - 1 - y); break; }
        }
        const coversContent = [[25, 10], [width - 25, 10], [25, height - 10], [width - 25, height - 10]].every(([x, y]) => yellow(x, y));
        return { width, height, topVariation: Math.max(...top) - Math.min(...top), bottomVariation: Math.max(...bottom) - Math.min(...bottom), paintedColumns: top.length, coversContent };
      });
      const content = await banner.evaluate(element => {
        const frame = element.getBoundingClientRect();
        return [...element.querySelectorAll('strong,span')].filter(e => !e.classList.contains('zigzag-contour')).map(child => {
          const range = document.createRange(); range.selectNodeContents(child); const r = range.getBoundingClientRect();
          return { fits: r.left >= frame.left && r.right <= frame.right && r.top >= frame.top && r.bottom <= frame.bottom, text: child.textContent.trim() };
        });
      });
      measurements.push({ check: 'pilates', viewport: width, contour, content });
      assert.ok(contour.topVariation >= 2 && contour.bottomVariation >= 2, `${width}px callout must expose irregular yellow top and bottom edges: ${JSON.stringify(contour)}`);
      assert.ok(contour.paintedColumns > contour.width * .6, 'paper must cover the central callout width');
      assert.ok(contour.coversContent, 'yellow paper must cover the text area rather than letterboxing its silhouette');
      assert.ok(content.every(item => item.fits), `${width}px callout text must remain inside its hit area: ${JSON.stringify(content)}`);
    } finally { await page.close(); }
  }
});

// Catches the small browser-native arrow replacing the source's large white V.
test('Enquiry select shows the source-sized chevron while retaining native hit area and keyboard selection', async () => {
  for (const [route, width] of [['/contatti/', 1512], ['/eventi/', 1512], ['/homepage-tpr/', 1512], ['/vivi-tpr/', 393], ['/contatti/', 320]]) {
    const page = await pageAt(route, width);
    try {
      const label = page.locator('.preview-select').first(), select = label.locator('select');
      const screenshot = await label.screenshot({ path: path.join(output, `select-${route.split('/')[1]}-${width}.png`) });
      const arrow = await imagePixels(screenshot, ({ data, width, height }) => {
        const points = [];
        for (let y = Math.floor(height / 2) - 12; y < height / 2 + 12; y++) for (let x = width - 44; x < width - 5; x++) {
          const i = (y * width + x) * 4;
          if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) points.push([x, y]);
        }
        return points.length ? { width: Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])) + 1, height: Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])) + 1 } : { width: 0, height: 0 };
      });
      const nativeControl = await label.evaluate(element => {
        const select = element.querySelector('select'), bounds = element.getBoundingClientRect();
        return { hitArea: document.elementFromPoint(bounds.right - 25, bounds.top + bounds.height / 2) === select, paddingRight: parseFloat(getComputedStyle(select).paddingRight), appearance: getComputedStyle(select).appearance };
      });
      await select.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
      const selectedIndex = await select.evaluate(element => element.selectedIndex);
      measurements.push({ check: 'select', route, viewport: width, arrow, nativeControl, selectedIndex });
      assert.ok(arrow.width >= 18 && arrow.width <= 28 && arrow.height >= 9, `${route} ${width}px must show a large source chevron: ${JSON.stringify(arrow)}`);
      assert.ok(nativeControl.hitArea && nativeControl.paddingRight >= 40, 'decorative chevron must not intercept or overlap the native select');
      assert.equal(selectedIndex, 1, 'native keyboard selection must still work');
    } finally { await page.close(); }
  }
});
