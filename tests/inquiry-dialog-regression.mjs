import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const endpoint = 'https://thepeoplesroom.it/api/inquiry';
const output = path.resolve(process.env.TPR_QA_OUTPUT || '.qa/feedback-inquiries');
const offers = [['day-pass', 'DAY PASS'], ['all-inclusive', 'ALL INCLUSIVE'], ['flex-8', 'FLEX 8'], ['ufficio-virtuale', 'UFFICIO VIRTUALE']];
const browsers = new Map(), records = [];
before(async () => {
  await mkdir(output, { recursive: true });
  for (const [engine, api] of Object.entries({ chromium, webkit })) browsers.set(engine, await api.launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2));
});

async function pageAt(engine, route, width = 1512) {
  const context = await browsers.get(engine).newContext({ viewport: { width, height: width < 500 ? 852 : 952 }, reducedMotion: 'reduce', hasTouch: width < 500, isMobile: width < 500 });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const posts = [], errors = [];
  let response = { status: 200, body: { success: true }, delay: 0 };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.url() === endpoint && request.method() === 'POST') {
      posts.push({ url: request.url(), body: request.postDataJSON() });
      const result = response;
      if (result.delay) await new Promise(resolve => setTimeout(resolve, result.delay));
      return route.fulfill({ status: result.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': base.origin }, body: JSON.stringify(result.body) });
    }
    if (request.method() === 'OPTIONS' && request.url() === endpoint) return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': base.origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    return ['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === base.origin ? route.continue() : route.abort();
  });
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, posts, errors, respond: value => { response = value; } };
}
async function fill(form) {
  await form.locator('select[name=user_type]').selectOption('Freelancer');
  await form.locator('[name=name]').fill('Ada Test');
  await form.locator('[name=email]').fill('ada@example.invalid');
  await form.locator('[name=phone]').fill('+39 0200000000');
  await form.locator('[name=message]').fill('Richiesta di prova intercettata, nessun invio reale.');
}
async function openOffer(page, id) {
  const trigger = page.locator(`#${id} [data-inquiry-open]`);
  assert.equal(await trigger.count(), 1, `offer ${id} must have a popup trigger`);
  await trigger.scrollIntoViewIfNeeded();
  const initialScroll = await trigger.evaluate(element => ({ top: scrollY, left: element.closest('[data-carousel]').scrollLeft }));
  await trigger.click();
  const dialog = page.locator(`#inquiry-${id}`);
  await dialog.waitFor({ state: 'visible' });
  return { trigger, dialog, initialScroll, form: dialog.locator('[data-inquiry-form]') };
}

// Navigation-only offer links or a lost selected-offer mapping make this fail.
test('every Home and Vivi offer opens its own accessible source-sized dialog', async () => {
  for (const engine of ['chromium', 'webkit']) for (const width of [1512, 393]) for (const route of ['homepage-tpr/', 'vivi-tpr/']) {
    const { context, page, posts, errors } = await pageAt(engine, route, width);
    try {
      const original = page.url();
      for (const [id, label] of offers) {
        const { trigger, dialog, form, initialScroll } = await openOffer(page, id);
        assert.equal(page.url(), original);
        assert.equal(await dialog.locator('h2').textContent(), 'Richiedi maggiori informazioni');
        assert.equal((await dialog.locator('.preview-inquiry-subtitle').textContent()).replace(/\s+/g, ' ').trim(), `Offerta ${label}`);
        assert.equal(await form.getAttribute('data-offer'), id);
        assert.equal(await form.getAttribute('data-kind'), 'contact');
        assert.equal(await form.locator('select[name=user_type] option').allTextContents().then(options => options.map(value => value.trim()).filter(Boolean)).then(options => options.slice(1)).then(options => options.join('/')), 'Privato/Freelancer/Startup/Azienda');
        const geometry = await dialog.evaluate(element => {
          const card = element.querySelector('.preview-inquiry-card'), box = card.getBoundingClientRect(), frame = element.getBoundingClientRect(), title = getComputedStyle(element.querySelector('h2'));
          return { width: box.width, height: box.height, top: frame.top, bottom: frame.bottom, viewport: innerHeight, documentWidth: document.documentElement.scrollWidth, title: { size: title.fontSize, lineHeight: title.lineHeight, weight: title.fontWeight, spacing: title.letterSpacing }, focusInside: element.contains(document.activeElement) };
        });
        if (width === 1512) {
          assert.deepEqual([geometry.width, geometry.height], [660, 568]);
          assert.deepEqual(geometry.title, { size: '40px', lineHeight: '40px', weight: '600', spacing: 'normal' });
        } else assert.ok(geometry.width <= width - 32 + 1);
        assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.viewport + 1);
        assert.equal(geometry.documentWidth, width);
        assert.equal(geometry.focusInside, true);
        for (let tab = 0; tab < 10; tab++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true); }
        const close = dialog.locator('[data-inquiry-close]');
        if (id === 'day-pass') await close.click();
        else await page.keyboard.press('Escape');
        await page.waitForFunction(id => !document.getElementById(`inquiry-${id}`).open, id);
        assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
        const restoredScroll = await trigger.evaluate(element => ({ top: scrollY, left: element.closest('[data-carousel]').scrollLeft }));
        assert.ok(Math.abs(restoredScroll.top - initialScroll.top) <= 1 && Math.abs(restoredScroll.left - initialScroll.left) <= 1, 'closing must retain page and carousel position');
        records.push({ engine, width, route, offer: id, geometry });
      }
      const { dialog } = await openOffer(page, 'all-inclusive');
      await page.mouse.click(5, 5);
      await page.waitForFunction(() => !document.querySelector('#inquiry-all-inclusive').open);
      assert.equal(await page.locator('html.is-inquiry-open').count(), 0);
      assert.equal(posts.length, 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('offer submission keeps inputs through pending/error and reports success only after acknowledgement', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const { context, page, posts, respond, errors } = await pageAt(engine, 'vivi-tpr/');
    try {
      await page.addScriptTag({ url: new URL('updated-inquiries.js', base).href });
      const { form } = await openOffer(page, 'flex-8');
      await form.evaluate(element => element.requestSubmit());
      assert.equal(posts.length, 0, 'invalid native form must not fetch');
      await fill(form);
      respond({ status: 503, body: { success: false }, delay: 300 });
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#inquiry-flex-8 form').getAttribute('aria-busy') === 'true');
      assert.equal(await form.locator('[name=name]').inputValue(), 'Ada Test');
      await form.evaluate(element => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await page.waitForFunction(() => document.querySelector('#inquiry-flex-8 form').dataset.state === 'error');
      assert.equal(posts.length, 1, 'pending requests must not duplicate');
      assert.equal(await form.locator('[name=email]').inputValue(), 'ada@example.invalid');
      assert.match(await form.locator('[role=status]').textContent(), /Riprova/);
      assert.deepEqual(posts[0], { url: endpoint, body: { kind: 'contact', user_type: 'Freelancer', name: 'Ada Test', email: 'ada@example.invalid', phone: '+39 0200000000', message: 'Richiesta di prova intercettata, nessun invio reale.', website: '', offer: 'flex-8' } });
      respond({ status: 200, body: { success: false }, delay: 0 });
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#inquiry-flex-8 form').getAttribute('aria-busy') !== 'true');
      assert.equal(await form.getAttribute('data-state'), 'error', 'HTTP200 alone is not success');
      assert.equal(await form.locator('[name=name]').inputValue(), 'Ada Test');
      respond({ status: 200, body: { success: true }, delay: 100 });
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#inquiry-flex-8 form').dataset.state === 'success');
      assert.equal(posts.length, 3);
      assert.match(await form.locator('[role=status]').textContent(), /inviata/);
      assert.equal(await form.locator('[role=status] a[href^="mailto:"]').count(), 0);
      assert.equal(await form.locator('[name=name]').inputValue(), '');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, `${engine}-acknowledged.png`) });
    } finally { await context.close(); }
  }
});

test('contact URL context, company and event forms use controlled inquiry kinds', async () => {
  const cases = [
    ['contatti/?offer=ufficio-virtuale&room=media', 'contact', 'ufficio-virtuale', 'media'],
    ['homepage-tpr/', 'company', undefined, undefined],
    ['eventi/', 'event', undefined, undefined],
  ];
  for (const [route, kind, offer, room] of cases) {
    const { context, page, posts } = await pageAt('chromium', route);
    try {
      const form = page.locator('main [data-inquiry-form]').first();
      assert.equal(await form.getAttribute('data-kind'), kind);
      await fill(form); await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('main [data-inquiry-form]').dataset.state === 'success');
      assert.equal(posts.length, 1); assert.equal(posts[0].body.kind, kind);
      assert.equal(posts[0].body.offer, offer); assert.equal(posts[0].body.room, room);
      assert.equal(posts[0].body.website, '');
      assert.equal(await form.locator('[role=status] a').count(), 0);
    } finally { await context.close(); }
  }
});

test('mobile popup contours follow the visible controls after resizing and status changes', async () => {
  const { context, page, errors } = await pageAt('webkit', 'homepage-tpr/', 393);
  try {
    const { dialog, form } = await openOffer(page, 'all-inclusive');
    for (const width of [393, 320, 430]) {
      await page.setViewportSize({ width, height: 667 });
      await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] .preview-fields > label,dialog[open] .preview-submit')].every(element => { const box = element.querySelector('.zigzag-contour')?.viewBox.baseVal; return box && Math.abs(box.width - element.clientWidth) <= 1 && Math.abs(box.height - element.clientHeight) <= 1; }));
      const bounds = await dialog.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 668);
      assert.ok(await dialog.evaluate(element => element.scrollHeight >= element.clientHeight));
      assert.equal(await form.locator('[name=name]').getAttribute('required'), '');
      await page.screenshot({ path: path.join(output, `webkit-${width}-popup.png`) });
    }
    await fill(form); await form.locator('[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('dialog[open] form').dataset.state === 'success');
    await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] .preview-fields > label,dialog[open] .preview-submit')].every(element => { const box = element.querySelector('.zigzag-contour')?.viewBox.baseVal; return box && Math.abs(box.width - element.clientWidth) <= 1 && Math.abs(box.height - element.clientHeight) <= 1; }));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
