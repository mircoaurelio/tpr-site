import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const output = path.resolve(process.env.TPR_QA_OUTPUT || '.qa/feedback-carousels/regression');
const browsers = new Map();
const records = [];
before(async () => {
  await mkdir(output, { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2));
});

async function pageAt(engine, width, route) {
  const context = await browsers.get(engine).newContext({ viewport: { width, height: width < 500 ? 852 : 952 }, reducedMotion: 'reduce', isMobile: width < 500, hasTouch: width < 500 });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', request => ['GET', 'HEAD'].includes(request.request().method()) && new URL(request.request().url()).origin === base.origin ? request.continue() : request.abort());
  await page.goto(new URL(`${route}/`, base).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })); });
  const track = page.locator(route === 'eventi' ? '.preview-event-carousel' : '.preview-offer-carousel');
  await track.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  return { context, page, track, errors };
}

async function position(track) {
  return track.evaluate(element => ({ left: element.scrollLeft, max: element.scrollWidth - element.clientWidth }));
}

// Removing a control handler or retaining the old end/center initialization
// makes cards unreachable or makes the first card inaccessible on arrival.
test('visible controls reach every offer and event card from the first card', async () => {
  for (const engine of ['chromium', 'webkit']) for (const width of [1512, 1280, 393]) for (const route of ['homepage-tpr', 'vivi-tpr', 'eventi']) {
    const { context, page, track, errors } = await pageAt(engine, width, route);
    try {
      const previous = page.locator('[data-carousel-prev]'), next = page.locator('[data-carousel-next]');
      assert.equal(await next.count(), 1, `${engine}/${width}/${route}: visible next control is required`);
      assert.equal(await next.isVisible(), true);
      assert.equal(await previous.isDisabled(), true);
      assert.equal((await position(track)).left, 0, `${route} must start with the first card`);
      const reached = new Set();
      for (let step = 0; step < 5; step++) {
        for (const title of await track.evaluate(element => [...element.children].filter(card => { const box = card.getBoundingClientRect(), track = element.getBoundingClientRect(); return box.left >= track.left - 1 && box.right <= track.right + 1; }).map(card => card.querySelector('h3').textContent))) reached.add(title);
        if (await next.isDisabled()) break;
        await next.click();
        await page.waitForTimeout(80);
      }
      const last = await position(track);
      assert.ok(Math.abs(last.left - last.max) <= 1);
      const expectedTitles = route === 'eventi' ? ['Shamans Ritual', 'The Dinner', 'Ceramic Workshop', 'The People’s Week Talk'] : null;
      if (expectedTitles) assert.deepEqual([...reached].sort(), expectedTitles.sort(), 'all published events must become fully readable');
      else assert.equal(reached.size, 4, `all four offer cards must become fully readable: ${[...reached]}`);
      assert.equal(await next.isDisabled(), true);
      await previous.click();
      await page.waitForTimeout(80);
      assert.ok((await position(track)).left < last.left);
      await track.evaluate(element => element.focus({ preventScroll: true }));
      await page.keyboard.press('Home');
      await page.waitForTimeout(80);
      assert.equal((await position(track)).left, 0);
      await page.keyboard.press('End');
      await page.waitForTimeout(80);
      assert.ok(Math.abs((await position(track)).left - last.max) <= 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.equal(await page.locator('.preview-room-cards [data-carousel-prev],.preview-room-cards [data-carousel-next]').count(), 0);
      assert.deepEqual(errors, []);
      records.push({ engine, width, route, reached: [...reached], last, errors });
      await page.screenshot({ path: path.join(output, `${engine}-${width}-${route}.png`) });
    } finally { await context.close(); }
  }
});

// Removing pointer capture/movement leaves the card stationary. Preventing
// pointerdown or suppressing every click breaks the card's normal CTA action.
test('desktop drag moves the track and a normal offer click still activates its link', async () => {
  for (const engine of ['chromium', 'webkit']) for (const route of ['vivi-tpr', 'eventi']) {
    const { context, page, track } = await pageAt(engine, 1512, route);
    try {
      const box = await track.boundingBox();
      const x = 700, y = Math.max(150, Math.min(700, box.y + 150));
      const beforeDrag = (await position(track)).left;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 340, y, { steps: 18 }); await page.mouse.up();
      await page.waitForTimeout(160);
      assert.ok((await position(track)).left > beforeDrag + 200, `${engine}/${route}: drag must expose later cards`);
      assert.equal(await page.locator('.is-carousel-dragging').count(), 0);
      if (route !== 'vivi-tpr') continue;
      await track.evaluate(element => { element.scrollLeft = 0; element.focus({ preventScroll: true }); });
      await page.keyboard.press('Home'); await page.waitForTimeout(100);
      const link = track.locator('a').first();
      // Hold the destination at the real link boundary: separate popup tests
      // own the next interaction, while this checks click versus drag delivery.
      await link.evaluate(element => { window.offerLinkClicks = 0; element.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); window.offerLinkClicks++; }, { capture: true }); });
      await link.click();
      assert.equal(await page.evaluate(() => window.offerLinkClicks), 1, 'a normal click must activate the real CTA');
      const linkBox = await link.boundingBox();
      await page.mouse.move(linkBox.x + linkBox.width * .8, linkBox.y + linkBox.height / 2); await page.mouse.down(); await page.mouse.move(linkBox.x + linkBox.width * .8 - 250, linkBox.y + linkBox.height / 2, { steps: 16 }); await page.mouse.up();
      assert.equal(await page.evaluate(() => window.offerLinkClicks), 1, 'dragging a link must not activate the CTA');
    } finally { await context.close(); }
  }
});

// An unconditional vertical-wheel conversion would steal ordinary page travel.
test('vertical wheel keeps page travel while Shift wheel deliberately moves a carousel', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const { context, page, track } = await pageAt(engine, 1280, 'eventi');
    try {
      const box = await track.boundingBox();
      await page.mouse.move(600, box.y + 160);
      const beforeY = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 200); await page.waitForTimeout(160);
      assert.equal((await position(track)).left, 0);
      assert.ok(await page.evaluate(before => scrollY > before + 100, beforeY), 'ordinary wheel must continue scrolling the page');
      await track.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.mouse.move(600, (await track.boundingBox()).y + 160);
      await page.keyboard.down('Shift'); await page.mouse.wheel(0, 300); await page.keyboard.up('Shift'); await page.waitForTimeout(180);
      assert.ok((await position(track)).left > 100, 'Shift wheel must move horizontally when there is room');
    } finally { await context.close(); }
  }
});

test('native mobile swiping still advances both carousel types', async () => {
  for (const route of ['vivi-tpr', 'eventi']) {
    const { context, page, track } = await pageAt('chromium', 393, route);
    try {
      await track.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
      const input = await context.newCDPSession(page);
      await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 330, y: 180 }] });
      for (let step = 0; step < 16; step++) { await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 330 - step * 17, y: 180 }] }); await page.waitForTimeout(16); }
      await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(400);
      assert.ok((await position(track)).left > 100);
    } finally { await context.close(); }
  }
});

test('loading the enhancement twice still advances one card per click', async () => {
  const { context, page, track } = await pageAt('chromium', 1512, 'homepage-tpr');
  try {
    await page.addScriptTag({ url: new URL('updated-carousels.js', base).href });
    await page.locator('[data-carousel-next]').click();
    await page.waitForTimeout(80);
    assert.equal((await position(track)).left, 560);
  } finally { await context.close(); }
});

test('releasing outside the track before a drag cannot turn a later hover into a drag', async () => {
  const { context, page, track } = await pageAt('chromium', 1280, 'eventi');
  try {
    const box = await track.boundingBox();
    await page.mouse.move(600, box.y + 1); await page.mouse.down();
    await page.mouse.move(600, box.y - 5); await page.mouse.up();
    await page.mouse.move(300, box.y + 70);
    assert.equal((await position(track)).left, 0);
    assert.equal(await page.locator('.is-carousel-dragging').count(), 0);
  } finally { await context.close(); }
});
