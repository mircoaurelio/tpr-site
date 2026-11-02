import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { configureImageLoading } from '../scripts/asset_loading.mjs';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function createPage(width = 1512) {
  const context = await browser.newContext({ viewport: { width, height: 952 }, isMobile: width < 721, hasTouch: width < 721 });
  const requests = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== base.origin) return route.abort();
    requests.push({ path: url.pathname, headers: await request.allHeaders() });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  return { context, page, requests };
}

for (const width of [1512, 393]) test(`${width}px: Home defers unused panorama/card photos while retaining all original masks`, { timeout: 20000 }, async () => {
  const { context, page, requests } = await createPage(width);
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    const deferred = requests.filter(({ path }) => /room-.+-(?:panorama-fallback|window)-2x\.webp$/.test(path));
    assert.deepEqual(deferred.map(({ path }) => path), [], 'belowfold panorama/card photos must not compete with the initial hero');
    const masks = requests.filter(({ path }) => /room-.+-photo-mask-union-2x\.webp$/.test(path));
    assert.equal(new Set(masks.map(({ path }) => path)).size, 5, 'all exact gradient masks remain eager');
    await page.locator('#rooms').evaluate(host => scrollTo(0, host.getBoundingClientRect().top + scrollY));
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(item => /room-coworking-panorama-fallback-2x\.webp$/.test(item.name)));
  } finally { await context.close(); }
});

test('cold desktop Explore keeps the complete Room visible until the original panorama has decoded', { timeout: 25000 }, async () => {
  const { context, page } = await createPage();
  let releasePanorama;
  const panoramaReady = new Promise(resolve => { releasePanorama = resolve; });
  let requested = false;
  await page.route('**/room-coworking-panorama-fallback-2x.webp', async route => {
    requested = true;
    await panoramaReady;
    await route.continue();
  });
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#rooms')?.dataset.elevatorReady);
    await page.locator('#rooms').evaluate(host => scrollTo(0, host.getBoundingClientRect().top + scrollY));
    await page.locator('.tpr-elevator__car--current .tpr-elevator__desktop-copy [data-elevator-explore]').click();
    await page.waitForTimeout(120);
    assert.ok(requested, 'Explore intent starts loading the unchanged panorama');
    assert.equal(await page.locator('#rooms').evaluate(host => host.classList.contains('is-exploring')), false, 'pending pixels must not replace the visible Room with an empty panorama');
    assert.equal(await page.locator('.tpr-elevator__art--current').evaluate(image => getComputedStyle(image).display !== 'none' && getComputedStyle(image).visibility !== 'hidden'), true);
    releasePanorama();
    await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-ready'));
    const panorama = await page.locator('.tpr-elevator__explore-track > img').evaluate(image => ({ src: image.currentSrc, width: image.naturalWidth }));
    assert.match(panorama.src, /room-coworking-panorama-(?:fallback|background)-2x\.webp$/);
    assert.ok(panorama.width > 0);
  } finally { releasePanorama(); await context.close(); }
});

test('cold mobile Explore keeps the full Room visible until its card photos decode', { timeout: 25000 }, async () => {
  const { context, page } = await createPage(393);
  let releasePhotos;
  const photosReady = new Promise(resolve => { releasePhotos = resolve; });
  await page.route('**/room-coworking-*-window-2x.webp', async route => { await photosReady; await route.continue(); });
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#rooms')?.dataset.elevatorReady);
    await page.locator('#rooms').evaluate(host => scrollTo(0, host.getBoundingClientRect().top + scrollY));
    await page.locator('.tpr-elevator__car--current .tpr-elevator__mobile-cta').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#rooms').evaluate(host => host.classList.contains('is-mobile-expanded')), false, 'pending photos must not open an empty mobile card strip');
    releasePhotos();
    await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-mobile-expanded'));
    const cardsReady = await page.locator('.tpr-elevator__car--current .tpr-elevator__mobile-card-photo-window img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
    assert.equal(cardsReady, true);
  } finally { releasePhotos(); await context.close(); }
});

test('Home prepares hero parallax immediately and defers the original event composite/raw photo until near Events', { timeout: 25000 }, async () => {
  const { context, page, requests } = await createPage();
  await page.route('**/homepage-tpr/', async route => {
    const response = await route.fetch();
    return route.fulfill({ response, body: configureImageLoading(await response.text(), '/homepage-tpr/') });
  });
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    await page.locator('[data-photo-parallax="hero"]').waitFor({ state: 'attached' });
    assert.deepEqual(requests.filter(({ path }) => /home-events-photo-eye-2x\.webp|shamans-ritual\.jpeg/.test(path)).map(({ path }) => path), [], 'event enhancement must respect belowfold image scheduling');
    await page.locator('.preview-home-event-photo').evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight + 200));
    await page.locator('[data-photo-parallax="events"]').waitFor({ state: 'attached' });
    for (const file of ['home-events-photo-eye-2x.webp', 'shamans-ritual.jpeg']) assert.ok(requests.some(({ path }) => path.endsWith(file)), `near Events loads the unchanged ${file}`);
  } finally { await context.close(); }
});

for (const action of ['skip', 'room-change', 'escape', 'failed-decode']) test(`pending desktop Explore: ${action} preserves the current journey after the panorama finishes`, { timeout: 25000 }, async () => {
  const { context, page } = await createPage();
  let releasePanorama;
  const panoramaReady = new Promise(resolve => { releasePanorama = resolve; });
  await page.route('**/room-coworking-panorama-fallback-2x.webp', async route => {
    await panoramaReady;
    if (action === 'failed-decode') await route.abort();
    else await route.continue();
  });
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#rooms')?.dataset.elevatorReady);
    await page.locator('#rooms').evaluate(host => scrollTo(0, host.getBoundingClientRect().top + scrollY));
    await page.locator('.tpr-elevator__car--current .tpr-elevator__desktop-copy [data-elevator-explore]').click();
    await page.locator('[data-elevator-explore][aria-busy="true"]').waitFor({ state: 'attached' });
    if (action === 'skip') await page.locator('[data-elevator-skip]').click();
    if (action === 'room-change') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('[data-elevator-room="reformer"]').click();
      await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'reformer');
    }
    if (action === 'escape') await page.keyboard.press('Escape');
    const intendedScroll = await page.evaluate(() => scrollY);
    releasePanorama();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(850);
    assert.equal(await page.locator('#rooms').evaluate(host => host.classList.contains('is-exploring')), false, 'late or failed image decode must never open a stale exploration');
    assert.equal(await page.locator('[data-elevator-explore][aria-busy]').count(), 0);
    const image = await page.locator('.tpr-elevator__art--current').evaluate(image => ({ width: image.naturalWidth, display: getComputedStyle(image).display }));
    assert.ok(image.width > 0 && image.display !== 'none', 'the established Room photo remains available');
    if (action === 'skip') assert.ok(Math.abs(await page.evaluate(() => scrollY) - intendedScroll) <= 1, 'Skip cannot be followed by a delayed panorama scroll jump');
  } finally { releasePanorama(); await context.close(); }
});

test('direct Room hash and rapid navigation retain the exact destination art and native lift duration', { timeout: 25000 }, async () => {
  const { context, page } = await createPage();
  try {
    await page.goto(new URL('homepage-tpr/#media', base).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'media' && Math.abs(document.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top) < 2);
    assert.match(await page.locator('.tpr-elevator__art--current').getAttribute('src'), /room-media-masked-photos-2x\.webp$/);
    for (const room of ['reformer', 'bar', 'wellness']) await page.locator(`[data-elevator-room="${room}"]`).click();
    await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'wellness' && !document.querySelector('#rooms').classList.contains('is-lifting'));
    const result = await page.locator('#rooms').evaluate(host => ({ lift: getComputedStyle(host).getPropertyValue('--elevator-lift-ms').trim(), art: host.querySelector('.tpr-elevator__art--current').currentSrc, loaded: host.querySelector('.tpr-elevator__art--current').naturalWidth > 0 }));
    assert.equal(result.lift, '1250ms');
    assert.match(result.art, /room-wellness-masked-photos-2x\.webp$/);
    assert.equal(result.loaded, true);
  } finally { await context.close(); }
});

for (const width of [1512, 393]) test(`${width}px: build loading policy preserves exact hero/event pixels and settled page geometry`, { timeout: 30000 }, async () => {
  const captures = [];
  for (const decorate of [false, true]) {
    const { context, page } = await createPage(width);
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (decorate) await page.route('**/homepage-tpr/', async route => {
        const response = await route.fetch();
        return route.fulfill({ response, body: configureImageLoading(await response.text(), '/homepage-tpr/') });
      });
      await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const record = {};
      for (const [key, selector, imageSelector] of [['hero', '.hero', '.preview-hero-composite'], ['events', '.preview-home-event-photo', '.preview-event-composite']]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.locator(imageSelector).evaluate(image => image.decode());
        record[key] = await page.locator(selector).screenshot();
      }
      record.geometry = await page.locator('#rooms,.preview-home-events,#offerte,.preview-company-media').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { selector: element.id || element.className, x: rect.x, top: rect.top + scrollY, width: rect.width, height: rect.height };
      }));
      captures.push(record);
    } finally { await context.close(); }
  }
  for (const key of ['hero', 'events']) assert.equal(Buffer.compare(captures[0][key], captures[1][key]), 0, `${key} must retain the original exact pixels after image loading`);
  assert.deepEqual(captures[1].geometry, captures[0].geometry, 'reserving the existing Room class cannot change the final source geometry');
});
