import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TPR_PLAYWRIGHT_MODULE || 'playwright');
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A base ending in /tpr-site/ retains that public project mount for every route.
const base = (process.env.TPR_BASE_URL || 'http://127.0.0.1:4175').replace(/\/?$/, '/');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve(process.env.TPR_QA_OUTPUT || path.join(repository, '.qa/designer-typography', `regression-${phase}`));
const records = [];
let browser;
before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2)); });

const routes = {
  home: 'homepage-tpr/', about: 'about/', contacts: 'contatti/', events: 'eventi/', vivi: 'vivi-tpr/', booking: 'prenota/',
  coworking: 'rooms/coworking/', move: 'rooms/reformer/', recharge: 'rooms/wellness/', fuel: 'rooms/bar/', media: 'rooms/media/',
};
async function pageAt(route, width = 1512) {
  const page = await browser.newPage({ viewport: { width, height: width === 1512 ? 952 : 852 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const resources = { check: 'resources', route, width, errors: [], fontFailures: [] };
  records.push(resources);
  page.on('pageerror', error => resources.errors.push(error.message));
  page.on('response', response => { if (/\.(?:otf|ttf|woff2?)(?:\?|$)/i.test(response.url()) && !response.ok()) resources.fontFailures.push({ url: response.url(), status: response.status() }); });
  await page.route('**/*', request => ['GET', 'HEAD'].includes(request.request().method()) ? request.continue() : request.abort());
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })); });
  assert.deepEqual(resources.errors, [], 'page initialization must complete before typography inspection');
  assert.deepEqual(resources.fontFailures, [], 'font files must load at the selected public mount');
  return page;
}
async function platformFonts(page, selector) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    assert.ok(nodeId, `text specimen must exist: ${selector}`);
    return (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.filter(font => font.glyphCount > 0);
  } finally { await session.detach(); }
}
async function typeAt(page, selector) {
  return page.locator(selector).first().evaluate(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    return { text: element.textContent.trim(), family: style.fontFamily, size: parseFloat(style.fontSize), weight: style.fontWeight, lineHeight: parseFloat(style.lineHeight), tracking: style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing), box: { x: box.x, y: box.y, width: box.width, height: box.height }, fontsReady: document.fonts.status };
  });
}
async function expectType(page, route, selector, expected) {
  const value = await typeAt(page, selector), fonts = await platformFonts(page, selector);
  records.push({ check: 'type', route, selector, value, fonts, expected });
  assert.equal(value.fontsReady, 'loaded');
  assert.equal(value.size, expected.size, `${route} ${selector}: source font size`);
  assert.equal(value.lineHeight, expected.lineHeight ?? expected.size, `${route} ${selector}: source line spacing`);
  assert.equal(value.weight, String(expected.weight), `${route} ${selector}: source weight`);
  assert.equal(value.tracking, expected.tracking ?? 0, `${route} ${selector}: source tracking`);
  assert.ok(fonts.length > 0, `${selector} must actually paint text`);
  assert.ok(fonts.every(font => font.isCustomFont && font.postScriptName === expected.face), `${route} ${selector} must paint the source font, not a fallback: ${JSON.stringify(fonts)}`);
}

// The supplied six source-* WebPs are 1200px review renders of 1512px PDF
// canvases with the mock 30px browser chrome removed. These crop coordinates
// come from those exported canvases, rather than reading CSS declarations.
const sourceSpecimens = {
  home: { crop: { x: 796, y: 1816, width: 636, height: 240 }, selector: '.preview-rooms-intro .preview-lead' },
  about: { crop: { x: 80, y: 1308, width: 636, height: 240 }, selector: '.preview-about > .preview-two-columns:nth-of-type(3) .preview-section-title' },
  contacts: { crop: { x: 80, y: 240, width: 636, height: 80 }, selector: '.preview-contacts h1' },
  events: { crop: { x: 80, y: 240, width: 636, height: 240 }, selector: '.preview-events h1' },
  vivi: { crop: { x: 796, y: 240, width: 636, height: 160 }, selector: '.preview-vivi-intro .preview-lead p:first-child' },
  booking: { crop: { x: 80, y: 240, width: 636, height: 240 }, selector: '.preview-booking h1' },
};
async function compareInk(page, sourceFile, screenshot, sourceCrop, actualCrop = sourceCrop) {
  const reference = await readFile(path.join(repository, 'design/review', sourceFile));
  return page.evaluate(async ({ reference, actual, sourceCrop, actualCrop }) => {
    async function bounds(data, crop) {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = Math.round(image.height * 1200 / image.width);
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const scale = 1200 / 1512, x = Math.floor(crop.x * scale), y = Math.floor(crop.y * scale), width = Math.ceil(crop.width * scale), height = Math.ceil(crop.height * scale);
      const pixels = context.getImageData(x, y, width, height).data;
      let left = width, right = -1, top = height, bottom = -1;
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4;
        if (pixels[i] > 180 && pixels[i + 1] > 180 && pixels[i + 2] > 180) { left = Math.min(left, col); right = Math.max(right, col); top = Math.min(top, row); bottom = Math.max(bottom, row); }
      }
      return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
    }
    return { source: await bounds(reference, sourceCrop), current: await bounds(actual, actualCrop) };
  }, { reference: reference.toString('base64'), actual: screenshot.toString('base64'), sourceCrop, actualCrop });
}
function expectInk(value, label) {
  assert.ok(value.source && value.current, `${label}: source and native text must both paint`);
  for (const metric of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(value.source[metric] - value.current[metric]) <= 3, `${label}: ${metric} must retain source wrapping and glyph bounds at the1200px review scale: ${JSON.stringify(value)}`);
}

const display = size => ({ size, weight: 700, face: 'PPRader-Bold' });
const body = size => ({ size, weight: 400, face: 'AlteHaasGrotesk' });
test('six desktop pages paint the supplied typefaces and retain source size, spacing and ink wrapping', { timeout: 120_000 }, async () => {
  const specimens = {
    home: [['#hero-title', { ...display(160), lineHeight: 144 }], ['.preview-home-about .preview-body-copy p', body(24)], ['.preview-rooms-intro h2', display(80)], ['.preview-rooms-intro .preview-lead', body(40)]],
    about: [['.preview-about > .preview-two-columns .preview-lead p', body(40)], ['.preview-manifesto-card p', body(24)], ['.preview-manifesto-card h2', display(40)], ['.preview-contact-section > h2', display(80)]],
    contacts: [['.preview-contacts h1', display(80)], ['.preview-contacts > .preview-two-columns .preview-lead', body(40)], ['.preview-contact-card h2', display(40)], ['.preview-form-heading p', body(24)], ['.preview-fields input', { size: 16, weight: 700, face: 'AlteHaasGrotesk_Bold' }]],
    events: [['.preview-events h1', display(80)], ['.preview-events > .preview-two-columns .preview-lead p', body(40)], ['.preview-event-card h3', display(40)], ['.preview-event-card p span', body(16)]],
    vivi: [['.preview-vivi-intro .preview-cap-text', { ...display(80), lineHeight: 72 }], ['.preview-vivi-intro .preview-lead p', body(40)], ['.preview-offers-heading h2', display(80)], ['.preview-company-copy h3', display(40)]],
    booking: [['.preview-booking h1', display(80)], ['.preview-booking .preview-lead p', body(40)]],
  };
  for (const [key, values] of Object.entries(specimens)) {
    const page = await pageAt(routes[key]);
    try {
      for (const [selector, expected] of values) await expectType(page, routes[key], selector, expected);
      const screenshot = await page.screenshot({ path: path.join(output, `${key}-1512.png`), fullPage: true, animations: 'disabled' });
      const specimen = sourceSpecimens[key];
      const ink = await compareInk(page, `source-${key}-desktop.webp`, screenshot, specimen.crop);
      records.push({ check: 'source-ink', key, crop: specimen.crop, ink }); expectInk(ink, key);
    } finally { await page.close(); }
  }
});

test('restored Home elevator retains updated source typography and264/384px text positions', { timeout: 60_000 }, async () => {
  const page = await pageAt(routes.home);
  try {
    for (const key of ['coworking', 'reformer', 'wellness', 'bar', 'media']) {
      await page.evaluate(key => { location.hash = key; }, key);
      await page.waitForFunction(key => document.querySelector('#rooms')?.dataset.activeRoom === key && !document.querySelector('#rooms')?.classList.contains('is-lifting'), key);
      await page.waitForTimeout(150);
      const copy = '.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy';
      await expectType(page, key, `${copy} h2`, display(80));
      await expectType(page, key, `${copy} p`, body(24));
      const position = await page.locator(copy).evaluate(element => {
        const frame = element.closest('.tpr-elevator__frame').getBoundingClientRect(), title = element.querySelector('h2').getBoundingClientRect(), paragraph = element.querySelector('p').getBoundingClientRect();
        return { x: title.x - frame.x, titleY: title.y - frame.y, bodyY: paragraph.y - frame.y, width: title.width, titleHeight: title.height };
      });
      records.push({ check: 'room-source-position', key, position });
      assert.ok(Math.abs(position.x - 796) <= 1, 'source Room copy aligns to the right column');
      assert.ok(Math.abs(position.titleY - 264) <= 1, `${key}: source Room title starts at264px: ${JSON.stringify(position)}`);
      assert.ok(Math.abs(position.bodyY - 384) <= 1, `${key}: source Room body starts at384px after80px heading and40px gap`);
      assert.equal(position.titleHeight, 80, `${key}: source Room heading stays on one line`);
      if (key === 'coworking') {
        const screenshot = await page.screenshot({ path: path.join(output, 'room-coworking-1512.png'), animations: 'disabled' });
        const titleInk = await compareInk(page, 'source-home-desktop.webp', screenshot, { x: 796, y: 2480, width: 636, height: 80 }, { x: 796, y: 264, width: 636, height: 80 });
        const bodyInk = await compareInk(page, 'source-home-desktop.webp', screenshot, { x: 796, y: 2600, width: 636, height: 24 }, { x: 796, y: 384, width: 636, height: 24 });
        records.push({ check: 'room-source-ink', titleInk, bodyInk }); expectInk(titleInk, 'Coworking title'); expectInk(bodyInk, 'Coworking body');
      }
    }
  } finally { await page.close(); }
});

async function clipping(page) {
  return page.evaluate(() => {
    const clipped = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, element = node.parentElement;
      if (!node.textContent.trim() || !element || element.closest('script,style,svg,.sr-only,[hidden],[inert],[aria-hidden="true"],[data-carousel],.tpr-elevator__explore,.tpr-elevator__mobile-drop')) continue;
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || !box.width || !box.height) continue;
      const range = document.createRange(); range.selectNode(node);
      const lines = [...range.getClientRects()];
      if (lines.some(line => line.width > 1 && (line.left < -1 || line.right > innerWidth + 1))) clipped.push({ text: node.textContent.trim(), selector: element.tagName + '.' + element.className, lines: lines.map(r => ({ x: r.x, right: r.right })) });
    }
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, clipped };
  });
}
test('all eleven mobile routes load real fonts and keep text inside320/393px viewports', { timeout: 180_000 }, async () => {
  for (const width of [393, 320]) for (const [key, route] of Object.entries(routes)) {
    const page = await pageAt(route, width);
    try {
      const selector = key === 'home' ? '#hero-title' : key === 'about' ? '.preview-manifesto-card h2' : 'main h1';
      const fonts = await platformFonts(page, selector);
      assert.ok(fonts.length && fonts.every(font => font.isCustomFont && font.postScriptName === 'PPRader-Bold'), `${key} ${width}px: actual display glyphs use PP Rader Bold`);
      const paragraph = await page.locator('main p').evaluateAll(elements => elements.find(e => e.getBoundingClientRect().width && !e.closest('[hidden],[inert],[aria-hidden="true"]'))?.textContent.trim());
      assert.ok(paragraph, 'mobile body text must exist');
      const paragraphFonts = await platformFonts(page, 'main p');
      assert.ok(paragraphFonts.length && paragraphFonts.every(font => font.isCustomFont && font.postScriptName === 'AlteHaasGrotesk'), `${key} ${width}px: actual body glyphs use Alte Haas Grotesk`);
      const result = await clipping(page); records.push({ check: 'mobile-clipping', key, width, fonts, paragraphFonts, result });
      assert.equal(result.documentWidth, width, `${key}: the page must not overflow horizontally`);
      assert.deepEqual(result.clipped, [], `${key} ${width}px: text outside intentional horizontal carousels must fit`);
      if (key === 'home') for (const room of ['coworking', 'reformer', 'wellness', 'bar', 'media']) {
        await page.evaluate(room => { location.hash = room; }, room);
        await page.waitForFunction(room => document.querySelector('#rooms')?.dataset.activeRoom === room && !document.querySelector('#rooms')?.classList.contains('is-lifting'), room);
        await page.waitForTimeout(150);
        const bodySelector = '.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-copy-text p';
        const type = await typeAt(page, bodySelector), bodyFonts = await platformFonts(page, bodySelector), fit = await clipping(page);
        records.push({ check: 'mobile-room-type', width, room, type, bodyFonts, fit });
        assert.ok(type.size >= 14, `${room} copy remains readable at${width}px`);
        assert.ok(bodyFonts.length && bodyFonts.every(font => font.isCustomFont && font.postScriptName === 'AlteHaasGrotesk'), `${room} uses the real body font`);
        assert.deepEqual(fit.clipped, [], `${room} title and copy fit the viewport`);
      }
      await page.screenshot({ path: path.join(output, `${key}-${width}.png`), fullPage: true, animations: 'disabled' });
    } finally { await page.close(); }
  }
});

test('short desktop Rooms reserve readable copy, title and reachable actions', { timeout: 90_000 }, async () => {
  for (const [width, height] of [[901, 500], [1024, 600]]) {
    const page = await pageAt(routes.home, width); await page.setViewportSize({ width, height });
    try {
      for (const key of ['coworking', 'reformer', 'wellness', 'bar', 'media']) {
        await page.evaluate(key => { location.hash = key; }, key);
        await page.waitForFunction(key => document.querySelector('#rooms')?.dataset.activeRoom === key && !document.querySelector('#rooms')?.classList.contains('is-lifting'), key);
        await page.waitForTimeout(150);
        const value = await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy').evaluate(element => {
          const title = element.querySelector('h2'), text = element.querySelector('.tpr-elevator__updated-text'), paragraph = element.querySelector('p'), actions = element.querySelector('.tpr-elevator__desktop-actions'), frame = element.closest('.tpr-elevator__frame');
          const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const style = getComputedStyle(paragraph), overflow = getComputedStyle(text).overflowY;
          return { title: rect(title), text: rect(text), actions: rect(actions), frame: rect(frame), fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), overflow, scrollHeight: text.scrollHeight, clientHeight: text.clientHeight, tabIndex: text.tabIndex };
        });
        records.push({ check: 'short-desktop-readable-copy', width, height, key, value });
        assert.ok(value.fontSize >= 14, `${key} ${width}×${height}: long source copy must remain readable`);
        assert.ok(value.clientHeight >= value.lineHeight * 2 - 1, `${key} ${width}×${height}: at least two body lines must remain visible: ${JSON.stringify(value)}`);
        assert.ok(value.title.y >= value.frame.y - 1 && value.title.bottom <= value.text.y + 1, 'responsive title must retain its own visible slot');
        assert.ok(value.actions.y >= value.text.bottom - 1 && value.actions.bottom <= value.frame.bottom + 1, 'actions must remain below text and inside the scene');
        if (value.scrollHeight > value.clientHeight + 1) {
          assert.ok(['auto', 'scroll'].includes(value.overflow), 'long copy must remain reachable by scrolling');
          assert.equal(value.tabIndex, 0, 'the text scroller must be keyboard reachable');
        }
        const fit = await clipping(page); assert.deepEqual(fit.clipped, [], 'responsive Room title/body must not be clipped horizontally');
      }
    } finally { await page.close(); }
  }
});
