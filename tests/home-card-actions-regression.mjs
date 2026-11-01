import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, webkit } from 'playwright';
import { decodeStableImage } from './helpers/decode-stable-image.mjs';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const browsers = new Map();
const roomLinks = {
  coworking: [[['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']], [['Eventi e Gallery', 'eventi/'], ['Organizza un evento', 'eventi/#organizza']]],
  reformer: [[['Prenota la tua lezione', 'prenota/']], [['Prenota la tua lezione', 'prenota/']], [['Prenota la tua lezione', 'prenota/']]],
  wellness: [[['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']]],
  bar: [[['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']]],
  media: [[['Scopri come accedere', 'vivi-tpr/']], [['Scopri come accedere', 'vivi-tpr/']], []],
};
before(async () => {
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => Promise.all([...browsers.values()].map(browser => browser.close())));

async function pageAt(engine, width) {
  const context = await browsers.get(engine).newContext({ viewport: { width, height: width <= 720 ? 852 : 952 }, reducedMotion: 'reduce', hasTouch: width <= 720, isMobile: width <= 720 });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  // Public verification can transfer definitive Room assets over the network;
  // keep interaction waits strict while allowing navigation its own deadline.
  page.setDefaultNavigationTimeout(Number(process.env.TPR_NAVIGATION_TIMEOUT_MS) || 15000);
  // Exercise the real local destination and supplied widget configuration;
  // provider/network side effects are outside these navigation regressions.
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  return { context, page };
}

async function openHomeRoom(page, width, key) {
  await page.locator(`[data-elevator-room="${key}"]`).click();
  await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
  await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) ' + (width <= 720 ? '.tpr-elevator__mobile-cta' : '.tpr-elevator__desktop-copy [data-elevator-explore]')).click();
  await page.waitForFunction(mobile => document.querySelector('#rooms').classList.contains(mobile ? 'is-mobile-expanded' : 'is-explore-ready'), width <= 720);
  if (width > 720) {
    await decodeStableImage(page.locator('.tpr-elevator__explore-track > img'));
    await page.waitForFunction(() => Number(document.querySelector('.tpr-elevator__explore-progress').getAttribute('aria-valuenow')) >= 38);
  }
  return page.locator(width <= 720 ? '.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card' : '.tpr-elevator__explore-card');
}

async function revealHomeCard(page, card, width) {
  if (width <= 720) {
    await card.evaluate(element => element.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }));
    return;
  }
  // The original panorama deliberately places later hotspots offscreen. Use
  // its public keyboard scrollbar without changing production geometry.
  const slider = page.locator('.tpr-elevator__explore-progress');
  await slider.evaluate(element => element.focus({ preventScroll: true }));
  for (let step = 0; step < 14; step++) {
    const direction = await card.evaluate(element => { const box = element.getBoundingClientRect(); return box.left < 0 ? 'ArrowLeft' : box.right > innerWidth ? 'ArrowRight' : null; });
    if (!direction) return;
    await page.keyboard.press(direction);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.fail('Original panorama scrollbar must bring the card into the viewport');
}

async function activate(page, locator, mode) {
  if (mode === 'keyboard') {
    // Windows WebKit's native Tab preference can skip links. Explicit focus
    // plus Enter still exercises native keyboard activation of an anchor.
    await locator.evaluate(element => element.focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
  } else if (mode === 'touch') await locator.tap();
  else await locator.click();
}

async function assertPilatesDestination(page) {
  await page.waitForURL(new URL('prenota/', base).href);
  assert.equal((await page.locator('h1').textContent()).trim(), 'Prenota la tua lezione di Pilates');
  const widget = page.locator('.preview-booking-panel .mindbody-widget');
  assert.equal(await widget.count(), 1);
  assert.equal(await widget.getAttribute('data-widget-type'), 'Schedules');
  assert.equal(await widget.getAttribute('data-widget-id'), '4581434fffc');
  assert.equal(await page.locator('script[src="https://brandedweb.mindbodyonline.com/embed/widget.js"]').count(), 1);
}

for (const engine of ['chromium', 'webkit']) for (const width of [320, 393, 1512]) {
  // Missing/wrong anchors, invalid nested buttons, or focusable hidden backs
  // must fail independently of the Move navigation checks below.
  test(`${engine} Home ${width}px: all 15 card actions have native destinations and accessible flip controls`, { timeout: 90_000 }, async () => {
    const { context, page } = await pageAt(engine, width);
    try {
      await page.goto(new URL('homepage-tpr/', base).href);
      let links = 0;
      for (const [key, expected] of Object.entries(roomLinks)) {
        const cards = await openHomeRoom(page, width, key);
        assert.equal(await cards.count(), 3);
        for (const [index, wanted] of expected.entries()) {
          const card = cards.nth(index), back = card.locator(width <= 720 ? '.tpr-elevator__mobile-card-back' : '.tpr-elevator__card-back');
          assert.deepEqual(await back.locator('a').allTextContents(), wanted.map(([label]) => label), `${key} card ${index + 1} must expose real links`);
          assert.deepEqual(await back.locator('a').evaluateAll(nodes => nodes.map(node => node.href)), wanted.map(([, route]) => new URL(route, base).href));
          links += wanted.length;
          assert.equal(await card.locator('button button,button a,a button,a a').count(), 0, 'interactive controls must be siblings');
          assert.equal(await back.getAttribute('aria-hidden'), 'true');
          assert.equal(await back.evaluate(element => element.inert), true, 'closed back must be inert');
          for (const link of await back.locator('a').all()) {
            await link.evaluate(element => element.focus({ preventScroll: true }));
            assert.equal(await link.evaluate(element => element === document.activeElement), false, 'closed links must not receive keyboard focus');
          }
          const open = card.locator('[data-elevator-card-open]'), close = back.locator('[data-elevator-card-close]');
          await revealHomeCard(page, card, width);
          await activate(page, open, 'keyboard');
          assert.equal(await open.getAttribute('aria-expanded'), 'true');
          assert.equal(await open.getAttribute('aria-controls'), await back.getAttribute('id'));
          assert.equal(await back.getAttribute('aria-hidden'), 'false');
          assert.equal(await back.evaluate(element => element.inert), false);
          assert.equal(await open.evaluate(element => element.inert), true, 'hidden front must be inert');
          assert.equal(await close.evaluate(element => element === document.activeElement), true);
          await page.keyboard.press('Escape');
          assert.equal(await open.getAttribute('aria-expanded'), 'false');
          assert.equal(await open.evaluate(element => element === document.activeElement), true);
          assert.equal(await page.locator('#rooms').evaluate((element, mobile) => element.classList.contains(mobile ? 'is-mobile-expanded' : 'is-exploring'), width <= 720), true, 'first Escape closes the card before the room');
          await activate(page, open, width <= 720 ? 'touch' : 'pointer');
          await activate(page, close, width <= 720 ? 'touch' : 'pointer');
          assert.equal(await open.getAttribute('aria-expanded'), 'false');
        }
        const ids = await page.locator('#rooms [id]').evaluateAll(nodes => nodes.map(node => node.id));
        assert.equal(new Set(ids).size, ids.length, 'current and incoming cars must use unique control ids');
        await page.keyboard.press('Escape');
      }
      assert.equal(links, 15);
    } finally { await context.close(); }
  });

  test(`${engine} ${width}px: each Home and standalone Move card opens the real Pilates schedule by pointer and keyboard`, { timeout: 150_000 }, async () => {
    const { context, page } = await pageAt(engine, width);
    try {
      for (const source of ['home', 'standalone']) for (const mode of [width <= 720 ? 'touch' : 'pointer', 'keyboard', ...(source === 'home' && width <= 720 ? ['edge-touch'] : [])]) for (const index of [0, 1, 2]) {
        await page.goto(new URL(source === 'home' ? 'homepage-tpr/' : 'rooms/reformer/', base).href);
        let card, open, link;
        if (source === 'home') {
          card = (await openHomeRoom(page, width, 'reformer')).nth(index);
          await revealHomeCard(page, card, width);
          open = card.locator('[data-elevator-card-open]');
          link = card.locator('.tpr-elevator__card-cta a');
        } else {
          await page.locator('[data-room-explore]').click();
          card = page.locator('.preview-room-card').nth(index);
          open = card.locator('[data-room-card-open]');
          link = card.locator('.preview-room-card-back a');
          await card.scrollIntoViewIfNeeded();
        }
        assert.equal(await link.count(), 1, `${source} Move card ${index + 1} must contain a native booking link`);
        assert.equal(await link.textContent(), 'Prenota la tua lezione');
        assert.equal(await link.getAttribute('href').then(value => new URL(value, page.url()).href), new URL('prenota/', base).href);
        await activate(page, open, mode === 'edge-touch' ? 'touch' : mode);
        if (mode === 'edge-touch') {
          const pill = await card.locator('.tpr-elevator__card-cta').boundingBox();
          // The visible pill includes its horizontal padding. A tap near its
          // outline must book exactly as a tap on the centered label does.
          await page.touchscreen.tap(pill.x + 8, pill.y + pill.height / 2);
        } else await activate(page, link, mode);
        await assertPilatesDestination(page);
      }
    } finally { await context.close(); }
  });
}
