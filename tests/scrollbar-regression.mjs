import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as playwright from 'playwright';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repository, '.qa/public-journeys/scrollbars');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const engines = (process.env.TPR_SCROLLBAR_BROWSERS || 'chromium,webkit').split(',').map(name => name.trim()).filter(Boolean);
const routes = ['homepage-tpr/', 'about/', 'contatti/', 'eventi/', 'vivi-tpr/', 'prenota/', 'rooms/coworking/', 'rooms/reformer/', 'rooms/wellness/', 'rooms/bar/', 'rooms/media/'];
const viewports = [{ width: 320, height: 568 }, { width: 393, height: 852 }, { width: 844, height: 390 }, { width: 1512, height: 952 }];
const browsers = new Map(), evidence = [];

before(async () => {
  await mkdir(output, { recursive: true });
  for (const name of engines) {
    assert.ok(playwright[name], `unknown browser: ${name}`);
    browsers.set(name, await playwright[name].launch({ headless: true }));
  }
});
after(async () => {
  try { await Promise.all([...browsers.values()].map(browser => browser.close())); }
  finally { await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(evidence, null, 2)); }
});

async function pageAt(name, viewport, route = 'homepage-tpr/') {
  const context = await browsers.get(name).newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, isMobile: viewport.width <= 720, hasTouch: viewport.width <= 720 });
  await context.route('**/*', requestRoute => {
    const request = requestRoute.request();
    return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === base.origin ? requestRoute.continue() : requestRoute.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000); page.setDefaultNavigationTimeout(12_000);
  try {
    await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); }));
    });
    return { context, page };
  } catch (error) { await context.close(); throw error; }
}

async function snapshot(page, label, browser, viewport) {
  const state = await page.evaluate(() => {
    const standard = CSS.supports('scrollbar-width', 'none');
    const webkit = CSS.supports('selector(::-webkit-scrollbar)');
    const containers = [];
    for (const element of [document.scrollingElement, ...document.querySelectorAll('body *')]) {
      if (!element) continue;
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !box.width || !box.height || element.closest('[inert]')) continue;
      const documentRoot = element === document.scrollingElement;
      const vertical = element.scrollHeight > element.clientHeight + 1 && (documentRoot || ['auto', 'scroll'].includes(style.overflowY));
      const horizontal = element.scrollWidth > element.clientWidth + 1 && (documentRoot || ['auto', 'scroll'].includes(style.overflowX));
      if (!vertical && !horizontal) continue;
      const pseudo = getComputedStyle(element, '::-webkit-scrollbar');
      containers.push({
        tag: element.tagName, id: element.id, className: typeof element.className === 'string' ? element.className : '', documentRoot,
        vertical, horizontal, overflowX: style.overflowX, overflowY: style.overflowY,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
        scrollbarWidth: style.scrollbarWidth, webkitDisplay: pseudo.display, webkitWidth: pseudo.width, webkitHeight: pseudo.height,
      });
    }
    return { url: location.href, standard, webkit, containers };
  });
  const result = { label, browser, viewport, ...state };
  evidence.push(result);
  return result;
}

function scrollbarFailures(state) {
  return state.containers.flatMap(container => {
    const failures = [];
    if (state.standard && container.scrollbarWidth !== 'none') failures.push('standard scrollbar-width must be none');
    if (state.webkit && !(container.webkitDisplay === 'none' || container.webkitWidth === '0px' && container.webkitHeight === '0px')) failures.push('supported WebKit scrollbar must be hidden or zero-sized');
    return failures.length ? [{ ...container, failures }] : [];
  });
}

async function floor(page, key) {
  await page.locator(`[data-elevator-room="${key}"]`).click();
  await page.waitForFunction(key => { const host = document.querySelector('#rooms'); return host.dataset.activeRoom === key && !host.classList.contains('is-lifting'); }, key);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
}

test('Media collapsed mobile text and document hide scrollbars without losing keyboard End scrolling', { timeout: 30_000 }, async () => {
  const failures = [];
  for (const name of engines) {
    const viewport = { width: 320, height: 568 };
    const { page, context } = await pageAt(name, viewport);
    try {
      await floor(page, 'media');
      const state = await snapshot(page, 'collapsed-media', name, viewport);
      const hiddenFailures = scrollbarFailures(state);
      if (hiddenFailures.length) {
        failures.push({ browser: name, problems: hiddenFailures });
        await page.screenshot({ path: path.join(output, `media-${name}-${phase}.png`), animations: 'disabled' });
      }
      const text = page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-copy-text-inner');
      await page.waitForFunction(() => { const element = document.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-copy-text-inner'); return element.scrollHeight > element.clientHeight + 1; });
      const before = await text.evaluate(element => ({ y: scrollY, max: element.scrollHeight - element.clientHeight, top: element.scrollTop }));
      await text.focus();
      assert.equal(await text.evaluate(element => document.activeElement === element), true, `${name}: long text remains keyboard focusable`);
      await page.keyboard.press('End');
      await page.waitForFunction(() => { const element = document.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-copy-text-inner'); return element.scrollTop >= element.scrollHeight - element.clientHeight - 2; });
      const after = await text.evaluate(element => ({ y: scrollY, top: element.scrollTop, frame: element.getBoundingClientRect().toJSON(), last: element.querySelector('p:last-child').getBoundingClientRect().toJSON(), room: document.querySelector('#rooms').dataset.activeRoom }));
      evidence.push({ label: 'media-keyboard-end', browser: name, before, after });
      assert.ok(after.top > before.top); assert.ok(after.last.bottom <= after.frame.bottom + 2);
      assert.equal(after.room, 'media'); assert.ok(Math.abs(after.y - before.y) <= 2, `${name}: End scrolls text, not the room document`);
    } finally { await context.close(); }
  }
  assert.deepEqual(failures, [], `visible scrollbar styling: ${JSON.stringify(failures, null, 2)}`);
});

for (const name of engines) for (const viewport of viewports) {
  test(`${name} ${viewport.width}x${viewport.height} hides scrollbars across all11 routes and interactive containers`, { timeout: 90_000 }, async () => {
    const failures = [];
    for (const route of routes) {
      const { page, context } = await pageAt(name, viewport, route);
      const inspect = async label => {
        const state = await snapshot(page, `${route}:${label}`, name, viewport);
        const problems = scrollbarFailures(state);
        if (problems.length) failures.push({ route, label, problems });
      };
      try {
        await inspect('initial');
        await page.locator('[data-menu-open]').click(); await inspect('menu'); await page.keyboard.press('Escape');
        for (const textarea of await page.locator('textarea:visible').all()) await textarea.fill(Array.from({ length: 30 }, (_, i) => `Scrollbar audit line ${i + 1}. No submission.`).join('\n'));
        await inspect('forms-and-carousels');
        if (route === 'homepage-tpr/') {
          await floor(page, 'media'); await inspect('collapsed-media');
          if (viewport.width <= 720) {
            await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-cta').click();
            await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-mobile-expanded'));
            await inspect('expanded-mobile-cards');
          }
        } else if (route.startsWith('rooms/')) {
          await page.locator('[data-room-explore]').click(); await inspect('room-card-carousel');
        }
      } finally { await context.close(); }
    }
    assert.deepEqual(failures, [], `${name} ${viewport.width}x${viewport.height}: ${JSON.stringify(failures, null, 2)}`);
  });
}

test('hidden scrollbars preserve the mobile card strip and native vertical panorama pan', { timeout: 40_000 }, async () => {
  for (const name of engines) {
    const mobile = await pageAt(name, { width: 320, height: 568 });
    try {
      await floor(mobile.page, 'coworking');
      await mobile.page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-cta').click();
      const strip = mobile.page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-drop-inner');
      await mobile.page.waitForFunction(() => { const element = document.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-drop-inner'); return element.clientHeight > 0 && element.scrollWidth > element.clientWidth; });
      const before = await strip.evaluate(element => ({ left: element.scrollLeft, x: element.firstElementChild.getBoundingClientRect().x, overflow: getComputedStyle(element).overflowX, touchAction: getComputedStyle(element).touchAction }));
      await strip.evaluate(element => element.scrollBy({ left: element.clientWidth, behavior: 'instant' }));
      const after = await strip.evaluate(element => ({ left: element.scrollLeft, x: element.firstElementChild.getBoundingClientRect().x }));
      assert.ok(['auto', 'scroll'].includes(before.overflow)); assert.notEqual(before.touchAction, 'none');
      assert.ok(after.left > before.left && after.x < before.x, `${name}: mobile cards still scroll horizontally`);
      evidence.push({ label: 'mobile-card-scroll', browser: name, before, after });
    } finally { await mobile.context.close(); }
    const desktop = await pageAt(name, { width: 1512, height: 952 });
    try {
      await floor(desktop.page, 'coworking');
      await desktop.page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy [data-elevator-explore]').click();
      await desktop.page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-ready'));
      const read = () => desktop.page.locator('#rooms').evaluate(host => ({ y: scrollY, progress: parseFloat(getComputedStyle(host).getPropertyValue('--explore-progress')), imageX: host.querySelector('.tpr-elevator__explore-track>img').getBoundingClientRect().x, cardX: host.querySelector('.tpr-elevator__explore-card').getBoundingClientRect().x }));
      const before = await read();
      await desktop.page.mouse.move(16, 450); await desktop.page.mouse.wheel(0, 240);
      await desktop.page.waitForFunction(progress => parseFloat(getComputedStyle(document.querySelector('#rooms')).getPropertyValue('--explore-progress')) > progress + .02, before.progress);
      const after = await read();
      assert.ok(after.y > before.y && after.imageX < before.imageX);
      assert.ok(Math.abs(after.imageX - before.imageX - (after.cardX - before.cardX)) < 2);
      evidence.push({ label: 'native-panorama-scroll', browser: name, before, after });
    } finally { await desktop.context.close(); }
  }
});
