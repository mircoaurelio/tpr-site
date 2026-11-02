import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.TPR_PLAYWRIGHT_MODULE || 'playwright');
} catch (error) {
  if (process.env.TPR_PLAYWRIGHT_MODULE || !process.env.APPDATA) throw error;
  playwright = require(path.join(process.env.APPDATA, 'npm/node_modules/@playwright/cli/node_modules/playwright'));
}
const base = process.env.TPR_BASE_URL || 'http://127.0.0.1:4173';
const phase = process.env.TPR_QA_PHASE || 'after';
const output = path.resolve('.qa/resume-mobile', `regression-${phase}`);
const widths = [320, 393, 430];
// Home uses the original layered elevator/panorama, covered by
// legacy-room-effect.test.mjs. These assertions cover standalone Room overlays.
const roomRoutes = ['/rooms/coworking/', '/rooms/reformer/', '/rooms/wellness/', '/rooms/bar/', '/rooms/media/'];
const measurements = [];
let browser;

before(async () => {
  await mkdir(output, { recursive: true });
  browser = await playwright.chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
});

async function pageAt(width, route = '/homepage-tpr/', reducedMotion = 'reduce') {
  const context = await browser.newContext({
    viewport: { width, height: 852 }, deviceScaleFactor: 1,
    isMobile: width <= 900, hasTouch: width <= 900, reducedMotion,
  });
  // Real page code runs; external writes are intercepted below by the one
  // newsletter test that needs synthetic responses. No live writes can escape.
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
  const page = await context.newPage();
  const failures = [];
  page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('pageerror', error => failures.push({ error: error.message }));
  page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); }));
  });
  assert.deepEqual(failures, [], 'page scripts and assets must load before interaction checks');
  return { context, page };
}
async function capture(page, name, selector) {
  const target = selector ? page.locator(selector).first() : page;
  await target.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
}
async function headingBounds(locator) {
  return locator.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, fontSize: getComputedStyle(element).fontSize, viewport: innerWidth };
  });
}
async function focusedBounds(page) {
  return page.evaluate(() => {
    const rect = document.activeElement.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight, scrollY, control: document.activeElement.hasAttribute('data-room-back') ? 'back' : document.activeElement.hasAttribute('data-room-explore') ? 'explore' : 'other' };
  });
}
async function waitForVisibleFocus(page) {
  await page.waitForFunction(() => {
    const rect = document.activeElement.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  }, null, { timeout: 1500 }).catch(() => {});
  return focusedBounds(page);
}
function assertVisibleFocus(bounds, label) {
  assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.height, `${label}: focused ${bounds.control} must be visible; bounds ${JSON.stringify(bounds)}`);
}

// Catches the fixed 88px heading overflowing a 320px mobile viewport.
test('320px Home hero retains every letter inside its content area', async () => {
  const { page, context } = await pageAt(320);
  try {
    const bounds = await headingBounds(page.locator('.hero-copy h1'));
    measurements.push({ check: 'hero-320', ...bounds });
    await capture(page, 'hero-320', '.hero');
    assert.ok(bounds.left >= 24 && bounds.right <= 296, `hero must fit between 24px margins: ${JSON.stringify(bounds)}`);
  } finally { await context.close(); }
});

// Catches an unbreakable heading word being hidden by the page's overflow clip.
test('320px Community heading remains completely readable', async () => {
  const { page, context } = await pageAt(320);
  try {
    const bounds = await headingBounds(page.locator('.preview-newsletter .preview-section-title'));
    measurements.push({ check: 'community-320', ...bounds });
    await capture(page, 'community-320', '.preview-newsletter');
    assert.ok(bounds.left >= 24 && bounds.right <= 296, `Community heading must fit between 24px margins: ${JSON.stringify(bounds)}`);
  } finally { await context.close(); }
});

// Catches the native ready-state background obscuring the SVG silhouette.
test('newsletter keeps its native background transparent through ready, busy, error and success', async () => {
  for (const width of widths) {
    const { page, context } = await pageAt(width);
    let release, responseStatus = 500;
    const requestGate = () => new Promise(resolve => { release = resolve; });
    let gate = requestGate();
    await page.route('**/api/newsletter', async route => {
      await gate;
      await route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify({ success: responseStatus === 200 }) });
    });
    try {
      const form = page.locator('[data-newsletter-form]');
      const button = form.locator('[type=submit]');
      const verifyContour = async state => {
        await page.waitForTimeout(240);
        const style = await button.evaluate(element => ({
          background: getComputedStyle(element).backgroundColor,
          fill: getComputedStyle(element.querySelector('.zigzag-contour path')).fill,
          svg: element.querySelector('.zigzag-contour').getAttribute('viewBox'),
          width: element.clientWidth, height: element.clientHeight,
        }));
        measurements.push({ check: 'newsletter', viewportWidth: width, state, ...style });
        await capture(page, `newsletter-${width}-${state}`, '.preview-newsletter');
        assert.equal(style.background, 'rgba(0, 0, 0, 0)', `${width}px ${state}: native background must not cover the rough SVG`);
        assert.equal(style.fill, state === 'disabled' || state === 'success' ? 'rgb(152, 202, 255)' : 'rgb(44, 100, 232)', `${width}px ${state}: SVG retains state fill`);
        const [, , svgWidth, svgHeight] = style.svg.split(' ').map(Number);
        assert.ok(Math.abs(svgWidth - style.width) <= 0.5 && Math.abs(svgHeight - style.height) <= 0.5, 'SVG follows the changing button label');
      };
      await verifyContour('disabled');
      await form.locator('[name=email]').fill('qa@example.com');
      await form.locator('[name=consent]').check();
      await verifyContour('ready');
      await button.click();
      await page.waitForFunction(() => document.querySelector('[data-newsletter-form]').getAttribute('aria-busy') === 'true');
      await verifyContour('busy');
      release();
      await page.waitForFunction(() => !document.querySelector('[data-newsletter-form]').hasAttribute('aria-busy'));
      await verifyContour('error');
      assert.match(await form.locator('[role=status]').textContent(), /non riuscita/);
      responseStatus = 200;
      gate = requestGate();
      await button.click();
      release();
      await page.waitForFunction(() => !document.querySelector('[data-newsletter-form]').hasAttribute('aria-busy'));
      await verifyContour('success');
      assert.match(await form.locator('[role=status]').textContent(), /Grazie/);
      assert.equal(await button.isDisabled(), true);
    } finally { release?.(); await context.close(); }
  }
});

// Catches focus moved into a details overlay above the preserved scroll position.
test('mobile room exploration and back keep their focused controls visible', async () => {
  for (const width of widths) {
    for (const route of roomRoutes) {
      const { page, context } = await pageAt(width, route);
      const name = route === '/homepage-tpr/' ? 'home' : route.split('/')[2];
      try {
        const explore = page.locator('[data-room-explore]').first();
        await explore.evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - 426));
        await explore.click();
        const opened = await waitForVisibleFocus(page);
        measurements.push({ check: 'room-open', route, width, ...opened });
        await capture(page, `room-${name}-${width}-open`);
        assert.equal(opened.control, 'back');
        assertVisibleFocus(opened, `${width}px ${route} open`);
        await page.locator('[data-room-back]').first().click();
        const closed = await waitForVisibleFocus(page);
        measurements.push({ check: 'room-back', route, width, ...closed });
        await capture(page, `room-${name}-${width}-back`);
        assert.equal(closed.control, 'explore');
        assertVisibleFocus(closed, `${width}px ${route} back`);
        await explore.click();
        await waitForVisibleFocus(page);
        await page.keyboard.press('Escape');
        assertVisibleFocus(await waitForVisibleFocus(page), `${width}px ${route} Escape`);
      } finally { await context.close(); }
    }
  }
});

// The recovered Menu_TPR reference replaces the old menu. Keep its explicit
// glyph styling protected from the body reset and retain a48px touch target.
test('source menu close glyph retains its 48px target and keyboard behavior', async () => {
  for (const width of [...widths, 1512]) {
    const { page, context } = await pageAt(width);
    try {
      await page.locator('[data-menu-open]').click();
      const fontSize = await page.locator('[data-menu-close]').evaluate(element => getComputedStyle(element).fontSize);
      const position = await page.locator('[data-menu-close]').evaluate(element => {
        const style = getComputedStyle(element);
        return { right: parseFloat(style.right), top: parseFloat(style.top), width: element.clientWidth, height: element.clientHeight };
      });
      measurements.push({ check: 'menu-close', width, fontSize, position });
      await capture(page, `menu-${width}`, '.preview-menu');
      assert.equal(fontSize, '36px');
      assert.deepEqual(position, width <= 900 ? { right: 16, top: 20, width: 48, height: 48 } : { right: 72, top: 24, width: 48, height: 48 });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-menu-open]').evaluate(element => element === document.activeElement), true);
    } finally { await context.close(); }
  }
});

test('393px and 430px typography follows the inspected mobile source sizes', async () => {
  for (const width of [393, 430]) {
    const { page, context } = await pageAt(width);
    try {
      // Figma Mobile Article 560:2843 uses 36px at its native 393px width.
      const heroFont = parseFloat((await headingBounds(page.locator('.hero-copy h1'))).fontSize);
      assert.ok(Math.abs(heroFont - 36 * width / 393) < .01);
      assert.equal((await headingBounds(page.locator('.preview-newsletter .preview-section-title'))).fontSize, '48px');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    } finally { await context.close(); }
  }
});

test('normal-motion mobile navigation settles on a visible focused control', async () => {
  for (const route of ['/rooms/coworking/']) {
    const { page, context } = await pageAt(393, route, 'no-preference');
    try {
      const explore = page.locator('[data-room-explore]').first();
      await explore.evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - 426));
      await explore.click();
      assertVisibleFocus(await waitForVisibleFocus(page), `${route} smooth open`);
      await page.locator('[data-room-back]').first().click();
      assertVisibleFocus(await waitForVisibleFocus(page), `${route} smooth back`);
    } finally { await context.close(); }
  }
});

test('desktop standalone Room exploration preserves viewport position', async () => {
  for (const route of roomRoutes) {
    const { page, context } = await pageAt(1512, route);
    try {
      const explore = page.locator('[data-room-explore]').first();
      await explore.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      await explore.click();
      assert.equal(await page.evaluate(() => scrollY), before, `${route} desktop open must not scroll`);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => scrollY), before, `${route} desktop back must not scroll`);
    } finally { await context.close(); }
  }
});
