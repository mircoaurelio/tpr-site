import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve('.qa/mobile-room-viewport', phase);
const browsers = new Map(), evidence = [];
const rooms = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
before(async () => {
  await mkdir(output, { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(evidence, null, 2));
});

// Browser emulation normally resizes svh together with the window. Safari's
// retracting toolbar keeps svh at the SMALL viewport while innerHeight/dvh grow.
// Freeze only those CSS lengths to model that independent, documented condition.
async function safariViewport(engine, width, smallHeight, visibleHeight) {
  const context = await browsers.get(engine).newContext({ viewport: { width, height: smallHeight }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== base.origin) return route.abort();
    if (url.pathname.endsWith('.css')) {
      const response = await route.fetch();
      const body = (await response.text()).replace(/(-?\d*\.?\d+)svh\b/g, (_, amount) => `${Number(amount) * smallHeight / 100}px`);
      return route.fulfill({ response, body });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width, height: visibleHeight });
  await page.evaluate(() => {
    const host = document.querySelector('#rooms');
    scrollTo({ top: host.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  });
  await page.waitForFunction(() => Math.abs(document.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top) < 1);
  return { page, context };
}
async function measure(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector), box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height, background: getComputedStyle(element).backgroundColor };
    };
    const host = document.querySelector('#rooms');
    return { room: host.dataset.activeRoom, lifting: host.classList.contains('is-lifting'), viewport: innerHeight, width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      sticky: rect('.tpr-elevator__sticky'), frame: rect('.tpr-elevator__frame'), nav: rect('.tpr-elevator__nav'),
      current: rect('.tpr-elevator__car--shade.tpr-elevator__car--current'), incoming: rect('.tpr-elevator__car--shade.tpr-elevator__car--incoming') };
  });
}
function uncovered(data) {
  return ['sticky', 'frame'].filter(key => data[key].top > 1 || data[key].bottom < data.viewport - 1).map(key => `${key}: ${data[key].top}..${data[key].bottom}, visible viewport 0..${data.viewport}`);
}

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: all mobile Room backgrounds cover the viewport as Safari retracts its toolbar`, { timeout: 55_000 }, async () => {
    const { page, context } = await safariViewport(engine, 393, 664, 852);
    const problems = [];
    try {
      for (const room of rooms) {
        if (room !== 'coworking') {
          await page.locator(`[data-elevator-room="${room}"]`).tap();
          await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-lifting'));
          await page.waitForTimeout(950);
          const moving = await measure(page);
          evidence.push({ engine, phase: 'during-lift', targetRoom: room, ...moving });
          problems.push(...uncovered(moving));
          if (room === 'reformer') await page.screenshot({ path: path.join(output, `${engine}-toolbar-during-move.png`) });
          await page.waitForFunction(room => document.querySelector('#rooms').dataset.activeRoom === room && !document.querySelector('#rooms').classList.contains('is-lifting'), room);
        }
        const settled = await measure(page);
        evidence.push({ engine, phase: 'settled', ...settled });
        problems.push(...uncovered(settled));
        assert.equal(settled.documentWidth, 393);
        if (Math.round(settled.current.height) !== 852) problems.push(`${room}: shade height ${settled.current.height} does not cover 852px`);
        if (settled.nav.bottom > settled.viewport || settled.nav.top < settled.viewport - 100) problems.push(`${room}: navigator does not follow the visible bottom`);
      }
      assert.deepEqual(problems, [], 'no unpainted strip beneath the moving Room');
    } finally { await context.close(); }
  });

  test(`${engine}: narrow and wide phones and expanded cards adapt to dynamic viewport height`, { timeout: 55_000 }, async () => {
    for (const [width, small, expanded] of [[320, 568, 667], [430, 740, 932]]) {
      const { page, context } = await safariViewport(engine, width, small, expanded);
      try {
        await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-cta').tap();
        await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-mobile-expanded'));
        for (const height of [expanded, small, expanded]) {
          await page.setViewportSize({ width, height });
          // Native focus may scroll toward the expanding Explore control.
          // Measure the Room once it is pinned, rather than while entering it.
          await page.evaluate(() => {
            const host = document.querySelector('#rooms');
            scrollTo({ top: host.getBoundingClientRect().top + scrollY + 100, behavior: 'instant' });
          });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const data = await measure(page);
          evidence.push({ engine, phase: 'expanded-cards-resize', ...data });
          assert.deepEqual(uncovered(data), []);
          assert.equal(data.documentWidth, width);
          assert.ok(data.nav.bottom <= height && data.nav.top >= height - 100);
        }
      } finally { await context.close(); }
    }
  });
}
