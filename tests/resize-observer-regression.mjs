import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4173/');
const output = path.resolve(process.env.TPR_QA_OUTPUT || '.qa/public-mobile-engines/resize-observer-current-source');
const evidence = { base: base.href, engine: 'unmodified Windows WebKit; native ResizeObserver and native pageerror events', scenarios: [] };
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await webkit.launch(); evidence.version = browser.version(); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(evidence, null, 2)); });
async function withPage(name, route, action) {
  const scenario = { name, url: new URL(route, base).href, errors: [], blockedWrites: [], measurements: [] };
  evidence.scenarios.push(scenario);
  const context = await browser.newContext({ viewport: { width: 1512, height: 952 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request();
    if (['GET', 'HEAD'].includes(request.method())) return route.continue();
    scenario.blockedWrites.push({ method: request.method(), url: request.url() });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  // No ResizeObserver replacement, callback interception or error suppression:
  // these are the same browser errors a visitor receives on the real page.
  page.on('pageerror', error => scenario.errors.push(error.message));
  try {
    await page.goto(scenario.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await action(page, scenario);
    await page.waitForTimeout(250);
    assert.deepEqual(scenario.errors.filter(message => /ResizeObserver loop/i.test(message)), [], 'real content/viewport changes must not raise a ResizeObserver loop error');
    assert.deepEqual(scenario.errors, [], 'page interactions do not raise other runtime errors');
    scenario.status = 'pass';
  } catch (error) {
    scenario.status = 'fail'; scenario.failure = String(error);
    await page.screenshot({ path: path.join(output, `${name}-failure.png`), animations: 'disabled' });
    throw error;
  } finally { await context.close(); }
}
async function contour(locator) {
  await locator.page().waitForFunction(element => {
    const svg = element.querySelector('.zigzag-contour');
    if (!svg) return false;
    const box = svg.viewBox.baseVal;
    return Math.abs(box.width - element.clientWidth) <= 1 && Math.abs(box.height - element.clientHeight) <= 1;
  }, await locator.elementHandle(), { timeout: 2000 });
  const value = await locator.evaluate(element => {
    const svg = element.querySelector('.zigzag-contour'), path = svg.querySelector('path'), box = svg.viewBox.baseVal, ink = path.getBBox();
    return { text: element.textContent.trim(), width: element.clientWidth, height: element.clientHeight, viewBox: { width: box.width, height: box.height }, ink: { x: ink.x, y: ink.y, width: ink.width, height: ink.height }, fill: getComputedStyle(path).fill, stroke: getComputedStyle(path).stroke, background: getComputedStyle(element).backgroundColor, href: element.getAttribute('href') };
  });
  assert.ok(value.ink.width > value.width * .9 && value.ink.height > value.height * .7, 'painted contour covers the resized control');
  assert.ok(value.ink.x >= -1 && value.ink.y >= -1 && value.ink.x + value.ink.width <= value.viewBox.width + 1 && value.ink.y + value.ink.height <= value.viewBox.height + 1, 'rough control edge remains within its SVG rather than clipping after resize');
  assert.ok(value.fill !== 'none' || value.stroke !== 'none', 'resized contour retains visible paint');
  return value;
}
async function paper(locator) {
  return locator.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight, mask: getComputedStyle(element).maskImage, frame: getComputedStyle(element, '::after').backgroundImage }));
}

test('WebKit Home loading and viewport changes retain control contours without ResizeObserver errors', async () => {
  await withPage('home', 'homepage-tpr/', async (page, scenario) => {
    for (const viewport of [{ width: 1512, height: 952 }, { width: 393, height: 852 }, { width: 1512, height: 952 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      const events = await contour(page.locator('.preview-home-events .preview-button').first());
      const pilates = await contour(page.locator('.preview-pilates-banner > span').first());
      scenario.measurements.push({ viewport, events, pilates });
    }
    const [desktop, mobile, restored] = scenario.measurements;
    assert.notEqual(desktop.pilates.width, mobile.pilates.width, 'a genuine responsive size change exercises contour resizing');
    assert.deepEqual(restored.pilates.viewBox, desktop.pilates.viewBox, 'returning to desktop restores the original control extent');
  });
});

test('WebKit About dynamic discovery and viewport changes preserve control and source-paper paint without ResizeObserver errors', async () => {
  await withPage('about', 'about/', async (page, scenario) => {
    const feature = page.locator('.preview-feature-card').first();
    const source = await paper(feature);
    scenario.measurements.push({ state: 'initial-source-paper', ...source });
    assert.deepEqual([source.width, source.height], [560, 434], 'nominal source feature card retains its supplied dimensions');
    assert.match(source.mask, /about-card-mask-560x434\.svg/, 'nominal card paints the supplied source silhouette');
    assert.match(source.frame, /about-card-frame-560x434\.svg/, 'nominal card paints the matching supplied paper frame');
    for (const key of ['community', 'coworking', 'reformer']) {
      await page.locator(`[data-discover="${key}"]`).click();
      await page.waitForFunction(key => document.querySelector('.preview-discover-content').dataset.selectedKey === key && document.querySelector('.preview-discover-content').classList.contains('is-detail'), key);
      const button = await contour(page.locator(`[data-discover="${key}"]`));
      const inserted = await contour(page.locator('.preview-discover-content .preview-button'));
      assert.match(inserted.text, /Esplora Stanza/);
      scenario.measurements.push({ state: `dynamic-${key}`, button, inserted });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(150);
    const small = await paper(feature);
    const smallControl = await contour(page.locator('.preview-discover-content .preview-button'));
    scenario.measurements.push({ state: 'mobile', paper: small, control: smallControl });
    assert.notEqual(small.width, source.width, 'viewport change genuinely resizes the paper card');
    assert.doesNotMatch(small.mask, /about-card-mask-560x434\.svg/, 'mobile card does not stretch the nominal desktop-only paper mask');
    await page.setViewportSize({ width: 1512, height: 952 });
    await page.waitForTimeout(150);
    const restored = await paper(feature);
    scenario.measurements.push({ state: 'restored-source-paper', ...restored, control: await contour(page.locator('.preview-discover-content .preview-button')) });
    assert.equal(restored.mask, source.mask, 'source paper silhouette is restored at its nominal viewport');
    assert.equal(restored.frame, source.frame, 'source paper frame is restored after responsive resizing');
    await page.locator('[data-discover="reformer"]').click();
    await page.waitForFunction(() => !document.querySelector('.preview-discover-content').classList.contains('is-detail'));
    await contour(page.locator('[data-discover="reformer"]'));
  });
});
