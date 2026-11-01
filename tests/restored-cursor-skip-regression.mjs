import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repository, '.qa/feedback-motion');
let server, origin;
const browsers = new Map();

before(async () => {
  await mkdir(output, { recursive: true });
  server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) return response.writeHead(405).end();
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = path.resolve(repository, '.' + pathname);
      if (!filename.startsWith(repository + path.sep)) return response.writeHead(404).end();
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      let body = await readFile(filename);
      if (filename.endsWith('.html') && !body.includes('updated-motion.js')) {
        body = body.toString().replace('</head>', '<link rel="stylesheet" href="/updated-motion.css"><script defer src="/updated-motion.js"></script></head>');
      }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});

after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

async function fixture(engine, { mobile = false, reducedMotion = 'no-preference', hash = '', deferInitialFrame = false } = {}) {
  const context = await browsers.get(engine).newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1512, height: 952 }, isMobile: mobile, hasTouch: mobile, reducedMotion });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  if (deferInitialFrame) await context.addInitScript(() => {
    // Model a busy cold page delaying paint beyond the controller's800ms guard.
    const requestFrame = requestAnimationFrame.bind(window), cancelFrame = cancelAnimationFrame.bind(window);
    const frames = new Map();
    let deadline = 0, sequence = 0;
    window.requestAnimationFrame = callback => {
      if (!deadline) deadline = performance.now() + 1100;
      const id = ++sequence;
      const tick = now => {
        if (!frames.has(id)) return;
        if (now < deadline) { frames.set(id, requestFrame(tick)); return; }
        frames.delete(id);
        callback(now);
      };
      frames.set(id, requestFrame(tick));
      return id;
    };
    window.cancelAnimationFrame = id => { cancelFrame(frames.get(id)); frames.delete(id); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6_000);
  await page.goto(origin + '/homepage-tpr/' + hash, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function enterRooms(page) {
  await page.evaluate(() => {
    const host = document.querySelector('#rooms');
    scrollTo({ top: host.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  });
  await page.waitForFunction(() => Math.abs(document.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top) < 2);
}

async function assertSkipped(page) {
  await page.waitForFunction(() => document.activeElement?.textContent === 'Eventi');
  const inspect = () => page.evaluate(() => {
    const host = document.querySelector('#rooms');
    return {
      scroll: scrollY,
      end: host.getBoundingClientRect().bottom + scrollY,
      nextTop: host.nextElementSibling.getBoundingClientRect().top,
      exploring: document.body.classList.contains('elevator-exploring'),
      openCards: host.querySelectorAll('.is-flipped').length,
      moving: ['is-lifting', 'is-exploring', 'is-mobile-expanded', 'is-explore-handoff'].some(name => host.classList.contains(name)),
      focus: document.activeElement?.textContent,
    };
  });
  const first = await inspect();
  assert.ok(Math.abs(first.scroll - first.end) < 2, `scroll after complete elevator: ${JSON.stringify(first)}`);
  assert.ok(Math.abs(first.nextTop) < 2, 'the next section starts at the viewport top');
  assert.equal(first.exploring, false);
  assert.equal(first.openCards, 0);
  assert.equal(first.moving, false);
  await page.waitForTimeout(1_450);
  const later = await inspect();
  assert.ok(Math.abs(later.scroll - first.scroll) < 2, 'pending lift/open/handoff callbacks cannot pull the visitor back');
  assert.equal(later.moving, false);
  assert.equal(later.focus, 'Eventi');
}

async function assertPaintedCursor(page, { action, label }) {
  await page.waitForFunction(action => {
    const cursor = document.querySelector('#tprCursor');
    return cursor?.classList.contains('is-visible')
      && cursor.classList.contains('is-action') === action
      && getComputedStyle(cursor).opacity === '1';
  }, action);
  const cursor = page.locator('#tprCursor');
  const state = await cursor.evaluate((node, action) => {
    const image = node.querySelector(action ? '.tpr-cursor__eye' : '.tpr-cursor__spark');
    return {
      topLayer: node.matches(':popover-open'),
      inert: Boolean(node.closest('[inert]')),
      pointerEvents: getComputedStyle(node).pointerEvents,
      imageLoaded: image.naturalWidth > 0,
      imageDisplay: getComputedStyle(image).display,
    };
  }, action);
  assert.deepEqual(state, { topLayer: true, inert: false, pointerEvents: 'none', imageLoaded: true, imageDisplay: 'block' }, label);
  const clip = await cursor.boundingBox();
  assert.ok(clip && clip.x >= 0 && clip.y >= 0, 'cursor artwork stays in the viewport');
  const painted = await page.screenshot({ clip, path: path.join(output, `${label}.png`) });
  await cursor.evaluate(node => { node.style.visibility = 'hidden'; });
  let backdrop;
  try { backdrop = await page.screenshot({ clip }); }
  finally { await cursor.evaluate(node => node.style.removeProperty('visibility')); }
  const changedPixels = await page.evaluate(async ({ painted, backdrop }) => {
    const decode = async png => { const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode(); return image; };
    const [visible, hidden] = await Promise.all([decode(painted), decode(backdrop)]);
    const canvas = document.createElement('canvas'); canvas.width = visible.width; canvas.height = visible.height;
    const ctx = canvas.getContext('2d');
    const pixels = image => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
    const a = pixels(visible), b = pixels(hidden);
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 16) changed++;
    return changed;
  }, { painted: painted.toString('base64'), backdrop: backdrop.toString('base64') });
  assert.ok(changedPixels > 100, `${label}: cursor must paint above the current layer, observed ${changedPixels} pixels`);
}

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: delayed initial paint keeps a Move hash jump and its booking destination`, async () => {
    const { context, page } = await fixture(engine, { hash: '#reformer', deferInitialFrame: true, reducedMotion: 'reduce' });
    try {
      await page.waitForFunction(() => location.hash === '' && document.querySelector('#rooms').dataset.activeRoom === 'reformer');
      assert.ok(Math.abs(await page.locator('.tpr-elevator__sticky').evaluate(node => node.getBoundingClientRect().top)) < 2, 'Move deep link reaches its pinned floor');
      await page.locator('[data-elevator-book]:visible').click();
      await page.waitForLoadState('domcontentloaded');
      assert.equal(new URL(page.url()).pathname, '/prenota/');
    } finally { await context.close(); }
  });

  test(`${engine}: original cursor switches to eye, retains text caret and follows modal/menu layers`, async () => {
    const { context, page } = await fixture(engine);
    try {
      assert.equal(await page.locator('#tprCursor').count(), 1, 'restore the custom cursor');
      await page.mouse.move(400, 400);
      await page.waitForFunction(() => document.querySelector('#tprCursor').classList.contains('is-visible'));
      assert.equal(await page.locator('#tprCursor .tpr-cursor__spark').evaluate(image => image.naturalWidth > 0 && image.src.includes('/assets/cursor-spark.png')), true);
      await assertPaintedCursor(page, { action: false, label: `${engine}-cursor-star` });
      await page.locator('[data-menu-open]').hover();
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-action')), true);
      await page.locator('[data-menu-open]').click();
      await page.locator('[data-menu-close]').hover();
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-visible') && !node.closest('[inert]') && getComputedStyle(node).pointerEvents === 'none'), true);
      await assertPaintedCursor(page, { action: true, label: `${engine}-cursor-source-menu-eye` });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-visible')), false, 'keyboard use restores native pointer behavior');
      const email = page.locator('[data-newsletter-form] input[type=email]');
      await email.hover();
      assert.equal(await email.evaluate(node => getComputedStyle(node).cursor), 'text');
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-visible')), false);
      await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.dataset.cursorFixture = '';
        dialog.innerHTML = '<button>Modal action</button>';
        document.body.append(dialog);
        dialog.showModal();
      });
      await page.getByRole('button', { name: 'Modal action' }).hover();
      const modalCursor = await page.locator('#tprCursor').evaluate(node => ({ visible: node.classList.contains('is-visible'), action: node.classList.contains('is-action'), topLayer: node.matches(':popover-open') || Boolean(node.closest('dialog[open]')) }));
      assert.deepEqual(modalCursor, { visible: true, action: true, topLayer: true });
      await assertPaintedCursor(page, { action: true, label: `${engine}-cursor-fixture-modal-eye` });
      await page.evaluate(() => document.querySelector('[data-cursor-fixture]').close());
      assert.equal(await page.locator('dialog[open]').count(), 0, 'close the fixture itself even when native Offer dialogs precede it');
      await page.mouse.move(250, 200);
      await page.waitForFunction(() => document.querySelector('#tprCursor').parentElement === document.body);
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.parentElement === document.body), true);

      await page.locator('[data-inquiry-open="inquiry-day-pass"]').click();
      const offer = page.locator('#inquiry-day-pass');
      await page.waitForFunction(() => document.querySelector('#inquiry-day-pass').open);
      await offer.locator('[data-inquiry-close]').hover();
      await assertPaintedCursor(page, { action: true, label: `${engine}-cursor-native-offer-eye` });
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.closest('dialog')?.id), 'inquiry-day-pass');
      const offerEmail = offer.locator('input[type=email]');
      await offerEmail.hover();
      assert.equal(await offerEmail.evaluate(node => getComputedStyle(node).cursor), 'text', 'native Offer text fields retain their I-beam');
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-visible')), false);
      assert.equal(await page.locator('html').evaluate(node => node.classList.contains('has-tpr-cursor')), false);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#inquiry-day-pass').open && document.querySelector('#tprCursor').parentElement === document.body);
      assert.equal(await page.locator('#tprCursor').evaluate(node => node.classList.contains('is-visible')), false, 'Offer Escape keeps keyboard pointer behavior');
    } finally { await context.close(); }
  });

  test(`${engine}: Skip during a pending lift reaches the next section without a delayed jump`, async () => {
    const { context, page } = await fixture(engine);
    try {
      await enterRooms(page);
      assert.equal(await page.getByRole('button', { name: 'Salta le stanze' }).count(), 1);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.tpr-elevator__art--current')).opacity) > .99);
      await page.screenshot({ path: path.join(output, `${engine}-skip-desktop.png`) });
      await page.locator('[data-elevator-room=reformer]').click();
      await page.getByRole('button', { name: 'Salta le stanze' }).focus();
      await page.keyboard.press('Enter');
      await assertSkipped(page);
    } finally { await context.close(); }
  });

  test(`${engine}: Skip cancels panorama opening and card exploration`, async () => {
    const { context, page } = await fixture(engine);
    try {
      await enterRooms(page);
      assert.equal(await page.getByRole('button', { name: 'Salta le stanze' }).count(), 1);
      await page.locator('.tpr-elevator__car--current [data-elevator-explore]').filter({ visible: true }).click();
      await page.getByRole('button', { name: 'Salta le stanze' }).click();
      await assertSkipped(page);
      await enterRooms(page);
      await page.locator('.tpr-elevator__car--current [data-elevator-explore]').filter({ visible: true }).click();
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-ready'));
      await page.locator('.tpr-elevator__explore-progress').focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.querySelector('.tpr-elevator__explore-progress').getAttribute('aria-valuenow') === '100');
      await page.evaluate(() => scrollBy({ top: 200, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-handoff'));
      await page.getByRole('button', { name: 'Salta le stanze' }).click();
      await assertSkipped(page);
      await enterRooms(page);
      await page.locator('.tpr-elevator__car--current [data-elevator-explore]').filter({ visible: true }).click();
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-ready'));
      await page.locator('.tpr-elevator__explore-card [data-elevator-card-open]').first().click();
      await page.getByRole('button', { name: 'Salta le stanze' }).click();
      await assertSkipped(page);
    } finally { await context.close(); }
  });

  test(`${engine}: touch keeps its native pointer and Skip clears expanded mobile cards`, async () => {
    const { context, page } = await fixture(engine, { mobile: true, reducedMotion: 'reduce' });
    try {
      assert.equal(await page.locator('#tprCursor').count(), 0, 'no custom cursor on a coarse pointer');
      await enterRooms(page);
      assert.equal(await page.getByRole('button', { name: 'Salta le stanze' }).count(), 1);
      for (const width of [320, 393, 430]) {
        await page.setViewportSize({ width, height: 852 });
        await enterRooms(page);
        const geometry = await page.getByRole('button', { name: 'Salta le stanze' }).evaluate(button => {
          const box = button.getBoundingClientRect();
          const nav = document.querySelector('.tpr-elevator__nav').getBoundingClientRect();
          return { right: box.right, bottom: box.bottom, top: box.top, navBottom: nav.bottom, height: box.height };
        });
        assert.ok(geometry.right <= width && geometry.right > width - 50 && geometry.bottom <= 853, `${width}px: Skip is visible at bottom right: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.top >= geometry.navBottom, `${width}px: Skip does not cover the room navigator`);
        assert.ok(geometry.height >= 44, `${width}px: Skip retains a touch-sized native control`);
      }
      await page.setViewportSize({ width: 393, height: 852 });
      await enterRooms(page);
      await page.locator('.tpr-elevator__car--current .tpr-elevator__mobile-cta').click();
      await page.locator('.tpr-elevator__car--current .tpr-elevator__mobile-card [data-elevator-card-open]').first().click();
      await page.screenshot({ path: path.join(output, `${engine}-skip-mobile-expanded.png`) });
      await page.getByRole('button', { name: 'Salta le stanze' }).click();
      await assertSkipped(page);
    } finally { await context.close(); }
  });
}
