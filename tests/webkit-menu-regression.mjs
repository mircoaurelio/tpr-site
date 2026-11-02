import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { webkit } from 'playwright';

// Real source and native WebKit keyboard preferences. No emulation of iOS
// hardware, no tabindex mutation, no application or keyboard mocks.
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4173/');
const url = new URL('homepage-tpr/', base.href.endsWith('/') ? base : `${base}/`).href;
const output = path.resolve(process.env.TPR_QA_OUTPUT || '.qa/public-mobile-engines/menu-current-source');
const viewports = [{ width: 375, height: 667 }, { width: 412, height: 915 }, { width: 844, height: 390 }];
const expectedForward = ['About', 'TPR Rooms', 'coworking', 'wellness', 'media', 'reformer', 'bar', 'Vivi TPR', 'Eventi', 'Contatti', 'brand', 'close'];
const expectedBackward = ['brand', 'Contatti', 'Eventi', 'Vivi TPR', 'bar', 'reformer', 'media', 'wellness', 'coworking', 'TPR Rooms', 'About', 'close'];
const evidence = { url, engine: 'Windows WebKit with default native link-tab preference', scenarios: [] };
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await webkit.launch({ headless: true }); evidence.browserVersion = browser.version(); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(evidence, null, 2)); });

async function focusState(page) {
  // WebKit can complete focused-element scrolling on the next rendering frame.
  // Measure its settled viewport position, rather than the intermediate frame.
  await page.waitForFunction(() => {
    const active = document.activeElement;
    if (!active.closest('.preview-menu')) return true;
    const r = active.getBoundingClientRect();
    return r.top >= -.5 && r.bottom <= innerHeight + .5 && r.left >= -.5 && r.right <= innerWidth + .5;
  }, null, { timeout: 1200 }).catch(() => {});
  return page.evaluate(() => {
    const active = document.activeElement, r = active.getBoundingClientRect();
    const href = active.getAttribute('href') || '';
    const room = /rooms\/([^/]+)\//.exec(href)?.[1];
    const token = active.tagName === 'BODY' ? 'body' : active.hasAttribute('data-menu-close') ? 'close' : active.classList.contains('preview-menu-brand') ? 'brand' : room || active.textContent.trim();
    return { token: token.slice(0, 100), tag: active.tagName, inMenu: !!active.closest('.preview-menu'), opener: active.hasAttribute('data-menu-open'), x: r.x, right: r.right, top: r.top, bottom: r.bottom, visible: r.top >= -0.5 && r.bottom <= innerHeight + .5 && r.left >= -.5 && r.right <= innerWidth + .5, menuHidden: document.querySelector('.preview-menu').getAttribute('aria-hidden') };
  });
}
async function withPage(viewport, name, action) {
  const scenario = { viewport, name, writesBlocked: [] };
  evidence.scenarios.push(scenario);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    scenario.writesBlocked.push({ method: route.request().method(), url: route.request().url() });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await action(page, scenario);
    scenario.status = 'pass';
  } catch (error) {
    scenario.status = 'fail'; scenario.error = String(error);
    await page.screenshot({ path: path.join(output, `${viewport.width}x${viewport.height}-${name}.png`), animations: 'disabled' });
    throw error;
  } finally { await context.close(); }
}

for (const viewport of viewports) {
  const size = `${viewport.width}x${viewport.height}`;
  // Catches edge-only wrapping: default WebKit Tab skips anchors unless the
  // dialog deliberately moves focus through its complete interactive sequence.
  test(`${size}: WebKit menu includes every link in forward and reverse Tab cycles`, async () => {
    await withPage(viewport, 'tab-cycle', async (page, scenario) => {
      await page.locator('[data-menu-open]').tap();
      const forward = [], backward = [];
      for (const _ of expectedForward) { await page.keyboard.press('Tab'); forward.push(await focusState(page)); }
      await page.locator('[data-menu-close]').focus();
      for (const _ of expectedBackward) { await page.keyboard.press('Shift+Tab'); backward.push(await focusState(page)); }
      scenario.forward = forward; scenario.backward = backward;
      assert.deepEqual(forward.map(f => f.token), expectedForward, 'Tab must visit every menu item and wrap to close');
      assert.deepEqual(backward.map(f => f.token), expectedBackward, 'Shift+Tab must visit every menu item and wrap to close');
      assert.ok([...forward, ...backward].every(f => f.inMenu && f.visible), 'every keyboard-focused menu control remains visible in the viewport');
    });
  });
  test(`${size}: WebKit Escape after Tab closes menu and restores its touched opener`, async () => {
    await withPage(viewport, 'tab-escape', async (page, scenario) => {
      await page.locator('[data-menu-open]').tap();
      await page.keyboard.press('Tab');
      scenario.afterTab = await focusState(page);
      await page.keyboard.press('Escape');
      scenario.afterEscape = await focusState(page);
      assert.equal(scenario.afterEscape.menuHidden, 'true', 'Escape closes the menu after keyboard navigation');
      assert.equal(scenario.afterEscape.opener, true, 'Escape restores the touched menu opener');
    });
  });
  test(`${size}: WebKit Escape from close returns focus to its touched opener`, async () => {
    await withPage(viewport, 'touch-escape', async (page, scenario) => {
      await page.locator('[data-menu-open]').tap();
      scenario.beforeEscape = await focusState(page);
      await page.keyboard.press('Escape');
      scenario.afterEscape = await focusState(page);
      assert.equal(scenario.afterEscape.menuHidden, 'true');
      assert.equal(scenario.afterEscape.opener, true, 'touch does not natively focus buttons in WebKit; dialog must explicitly restore its opener');
    });
  });
}
