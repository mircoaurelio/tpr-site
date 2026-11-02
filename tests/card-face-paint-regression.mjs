import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const engine = process.env.TPR_ENGINE || 'chromium';
const output = path.resolve('.qa/figma-full-audit-20261101/card-paint', process.env.TPR_QA_PHASE || engine);
const records = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await ({ chromium, webkit })[engine].launch(); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2)); });

async function comparePaint(page, card, key) {
  const native = await card.locator('.tpr-card-rotor').count() === 0;
  const frontFacing = native
    ? await card.locator('.tpr-elevator__card-back').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11 < 0)
    : await card.locator('.tpr-card-rotor').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11 >= 0);
  const actual = await card.screenshot();
  // Independently render only the physically facing surface as the paint
  // reference. This detects hidden-face leakage, including mirrored text,
  // rather than merely trusting computed backface-visibility/rotation values.
  const style = await page.addStyleTag({ content: native
    ? `.tpr-elevator__explore-card:not(.tpr-card-scene) .tpr-elevator__card-back{opacity:${frontFacing ? 0 : 1}!important;transition:none!important}`
    : `.tpr-card-scene .tpr-card-${frontFacing ? 'front' : 'back'}-face{opacity:1!important}.tpr-card-scene .tpr-card-${frontFacing ? 'back' : 'front'}-face{opacity:0!important}` });
  const expected = await card.screenshot();
  await style.evaluate(el => el.remove());
  await writeFile(path.join(output, `${key}-actual.png`), actual);
  await writeFile(path.join(output, `${key}-reference.png`), expected);
  const mismatch = await page.evaluate(async ({ actual, expected }) => {
    const load = async data => { const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode(); return image; };
    const [a, b] = await Promise.all([load(actual), load(expected)]);
    const canvas = document.createElement('canvas'); canvas.width = a.width; canvas.height = a.height;
    const ctx = canvas.getContext('2d');
    const pixels = image => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
    const x = pixels(a), y = pixels(b); let changed = 0;
    for (let i = 0; i < x.length; i += 4) if ([0, 1, 2, 3].some(channel => Math.abs(x[i + channel] - y[i + channel]) > 24)) changed++;
    return changed / (a.width * a.height);
  }, { actual: actual.toString('base64'), expected: expected.toString('base64') });
  records.push({ key, native, frontFacing, mismatch });
  assert.ok(mismatch < .005, `${key}: the opposite face must not paint through the facing surface (${(mismatch * 100).toFixed(2)}% wrong pixels)`);
}

async function freezeTurn(card, time) {
  await card.locator('.tpr-card-rotor').evaluate((el, time) => { const animation = el.getAnimations()[0]; animation.pause(); animation.currentTime = time; }, time);
}

for (const home of [false, true]) for (const width of [1512, 393]) test(`${engine}: ${home ? 'Home' : 'standalone'} ${width}px paints only the physically facing card at rest, mid-turn and reverse`, { timeout: 35000 }, async () => {
  const context = await browser.newContext({ viewport: { width, height: 952 }, reducedMotion: 'no-preference' });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(20000);
  try {
    await page.goto(new URL(home ? 'homepage-tpr/' : 'rooms/coworking/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.tpr-cursor{display:none!important}' });
    if (home) {
      await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) ' + (width <= 720 ? '.tpr-elevator__mobile-cta' : '.tpr-elevator__desktop-copy [data-elevator-explore]')).click();
      await page.waitForFunction(mobile => document.querySelector('#rooms').classList.contains(mobile ? 'is-mobile-expanded' : 'is-explore-ready'), width <= 720);
    } else await page.locator('[data-room-explore]').click();
    const card = page.locator(home ? (width <= 720 ? '.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card' : '.tpr-elevator__explore-card') : '.preview-room-card').first();
    await card.locator('.tpr-card-rotor').waitFor({ state: 'attached' });
    const open = card.locator(home ? '[data-elevator-card-open]' : '[data-room-card-open]');
    const key = `${home ? 'home' : 'standalone'}-${width}`;
    await comparePaint(page, card, `${key}-front-rest`);
    await open.focus(); await page.keyboard.press('Enter');
    await freezeTurn(card, 136); await comparePaint(page, card, `${key}-front-turn`);
    await freezeTurn(card, 544); await comparePaint(page, card, `${key}-back-turn`);
    await card.locator('.tpr-card-rotor').evaluate(el => el.getAnimations()[0].finish());
    await comparePaint(page, card, `${key}-back-rest`);
    await page.keyboard.press('Escape');
    await freezeTurn(card, 136); await comparePaint(page, card, `${key}-reverse-front`);
    await card.locator('.tpr-card-rotor').evaluate(el => { const a = el.getAnimations()[0]; a.currentTime = 0; a.pause(); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await comparePaint(page, card, `${key}-reduced-front`);
    await open.focus(); await page.keyboard.press('Enter');
    await comparePaint(page, card, `${key}-reduced-back`);
  } finally { await context.close(); }
});

for (const failedSource of ['room-card-faces.json', 'room-coworking-card-postazioni-front-2x.webp']) test(`${engine}: desktop fallback with failed ${failedSource} suppresses reversed back paint while opening and closing`, { timeout: 35000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1512, height: 952 }, reducedMotion: 'no-preference' });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  await context.route(`**/${failedSource}*`, route => route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(20000);
  try {
    const failure = page.waitForEvent('requestfailed', { predicate: request => request.url().includes(failedSource), timeout: 20000 });
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.tpr-cursor{display:none!important}' });
    await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy [data-elevator-explore]').click();
    await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-explore-ready'));
    await failure;
    const card = page.locator('.tpr-elevator__explore-card').first(), back = card.locator('.tpr-elevator__card-back');
    assert.equal(await card.locator('.tpr-card-rotor').count(), 0, 'failed source must retain the complete native panorama without an incomplete enhanced face');
    const key = `native-${failedSource.replaceAll('.', '-')}`;
    const freeze = async time => {
      await page.waitForFunction(el => el.getAnimations().some(animation => animation.transitionProperty === 'transform'), await back.elementHandle());
      await back.evaluate((el, time) => el.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }), time);
    };
    await card.locator('[data-elevator-card-open]').focus(); await page.keyboard.press('Enter');
    await freeze(75);
    assert.ok(await back.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11 < 0), 'opening sample must exercise the reversed half of the native turn');
    await comparePaint(page, card, `${key}-opening75`);
    // The paint reference removes CSS transitions; the requested open state is
    // now settled. Native focus and Escape remain owned by the original engine.
    assert.equal(await card.locator('[data-elevator-card-close]').evaluate(el => el === document.activeElement), true);
    await comparePaint(page, card, `${key}-open-rest`);
    await page.keyboard.press('Escape');
    await freeze(225);
    assert.equal(await back.getAttribute('aria-hidden'), 'true');
    assert.equal(await back.evaluate(el => el.inert), true);
    await comparePaint(page, card, `${key}-closing225`);
    assert.equal(await card.locator('[data-elevator-card-open]').evaluate(el => el === document.activeElement), true);
    await comparePaint(page, card, `${key}-closed-rest`);
  } finally { await context.close(); }
});
