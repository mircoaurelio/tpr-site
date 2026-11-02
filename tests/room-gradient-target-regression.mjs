import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve('.qa/room-gradient-target', phase), evidence = [];
const browsers = new Map();
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
before(async () => {
  await mkdir(output, { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});

for (const engine of ['chromium', 'webkit']) test(`${engine}: decoded Room mask preload also supplies its first CSS use without another request`, { timeout: 30_000 }, async () => {
  const context = await browsers.get(engine).newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  let probeStarted = false, releaseMask;
  const pendingMask = new Promise(resolve => { releaseMask = resolve; });
  const secondRequests = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== base.origin) return route.abort();
    const headers = request.headers();
    // WebKit sends Origin for a CSS mask's CORS request; Chromium exposes the
    // same mode through Sec-Fetch-Mode. A completed Image preload must supply
    // that resource, even when a second request would be slow on a cold visit.
    if (probeStarted && url.pathname.endsWith('/room-wellness-photo-mask-union-2x.webp') && (headers.origin || headers['sec-fetch-mode'] === 'cors')) {
      secondRequests.push(url.pathname);
      await pendingMask;
    }
    return route.continue();
  });
  const page = await context.newPage();
  try {
    await page.goto(new URL('homepage-tpr/#reformer', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'reformer' && Math.abs(document.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top) < 2);
    const initialMaskRequest = await page.evaluate(() => performance.getEntriesByType('resource').some(resource => resource.name.endsWith('/room-wellness-photo-mask-union-2x.webp') && resource.initiatorType === 'img' && resource.responseEnd > 0));
    assert.ok(initialMaskRequest, 'the original image preload has already completed before selection');
    probeStarted = true;
    await page.locator('[data-elevator-room="wellness"]').tap();
    await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-lifting'));
    const rect = await page.locator('.tpr-elevator__photo-plane').boundingBox();
    const png = await page.screenshot({
      style: '#rooms .tpr-elevator__car:not(.tpr-elevator__car--shade), #rooms .tpr-elevator__character-plane { visibility:hidden !important }',
      clip: { x: 20, y: Math.floor(rect.y + rect.height) - 2, width: 353, height: 1 },
    });
    // Decode the exact repository mask as data only after taking the screenshot.
    // This measures its alpha without warming the CSS resource being tested.
    const maskBytes = await readFile(path.join(repository, 'assets/figma-updated/composites/room-wellness-photo-mask-union-2x.webp'));
    const painted = await page.evaluate(async ({ png, maskData, rect }) => {
      const decode = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
      const [image, mask] = await Promise.all([decode('data:image/png;base64,' + png), decode(maskData)]);
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = Math.ceil(rect.width); alphaCanvas.height = Math.ceil(rect.height);
      const alphaContext = alphaCanvas.getContext('2d'); alphaContext.drawImage(mask, 0, 0, rect.width, rect.height);
      const alpha = alphaContext.getImageData(20, Math.floor(rect.height) - 2, canvas.width, 1).data;
      const distanceFromBottom = rect.y + rect.height - (Math.floor(rect.y + rect.height) - 1.5);
      const tolerance = Math.ceil(255 * distanceFromBottom / (rect.height * .28)) + 2;
      let total = 0, matches = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (alpha[i + 3] < 250) continue;
        total++;
        if (Math.max(...[194, 213, 105].map((value, channel) => Math.abs(pixels[i + channel] - value))) <= tolerance) matches++;
      }
      return { total, matches, ratio: matches / total, tolerance };
    }, { png: png.toString('base64'), maskData: 'data:image/webp;base64,' + maskBytes.toString('base64'), rect });
    evidence.push({ engine, probe: 'cold-css-mask', secondRequests, painted });
    assert.deepEqual(secondRequests, [], 'decoded masks must not start a separate first-use CSS request');
    assert.ok(painted.total >= 8 && painted.ratio >= .95, `destination edge must paint immediately while a redundant mask request would be pending: ${JSON.stringify(painted)}`);
  } finally { releaseMask(); await context.close(); }
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(evidence, null, 2));
});

for (const engine of ['chromium', 'webkit']) test(`${engine}: mobile photo gradient uses the destination color at the start of every Room lift`, { timeout: 30_000 }, async () => {
  const context = await browsers.get(engine).newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage(), problems = [];
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const rooms = [
      ['reformer', 'rgb(63, 153, 65)'], ['wellness', 'rgb(194, 213, 105)'],
      ['bar', 'rgb(235, 100, 43)'], ['media', 'rgb(255, 193, 0)'], ['coworking', 'rgb(152, 202, 255)'],
    ];
    for (const [room, color] of rooms) {
      await page.locator(`[data-elevator-room="${room}"]`).tap();
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-lifting'));
      const data = await page.evaluate(() => {
        const host = document.querySelector('#rooms'), photo = host.querySelector('.tpr-elevator__photo-plane');
        return { active: host.dataset.activeRoom, lifting: host.classList.contains('is-lifting'), gradient: getComputedStyle(photo, '::after').backgroundImage, liftDuration: getComputedStyle(host).getPropertyValue('--elevator-lift-ms'), photo: photo.getBoundingClientRect().toJSON() };
      });
      evidence.push({ engine, target: room, expectedColor: color, ...data });
      assert.ok(data.lifting && data.active !== room, 'sample must be inside the original lift, before settling');
      assert.match(data.liftDuration, /1250ms/, 'preserve the original lift timing');
      if (!data.gradient.includes(color)) problems.push(`${room}: expected ${color} immediately, painted ${data.gradient}`);
      // Inspect the actual painted lower edge as well: a correct CSS variable
      // must not conceal an old baked Room color in the replacement artwork.
      const png = await page.screenshot({
        // Copy cars legitimately cross the photograph while lifting. Isolate
        // its paint without altering the photo, gradient, shade or animation.
        style: '#rooms .tpr-elevator__car:not(.tpr-elevator__car--shade), #rooms .tpr-elevator__character-plane { visibility:hidden !important }',
        clip: {
        x: 20, y: Math.floor(data.photo.bottom) - 2,
        width: 353, height: 1,
      } });
      const painted = await page.evaluate(async ({ png, color }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // The fixed eye-shaped plane is intentionally transparent across most
        // of this row. Only inspect its actually painted, opaque mask pixels.
        const photo = document.querySelector('#rooms .tpr-elevator__photo-plane');
        const rect = photo.getBoundingClientRect();
        const mask = new Image();
        const maskImage = getComputedStyle(photo, '::after').maskImage !== 'none'
          ? getComputedStyle(photo, '::after').maskImage : getComputedStyle(photo).maskImage;
        mask.src = /url\(["']?(.*?)["']?\)/.exec(maskImage)[1];
        await mask.decode();
        const maskCanvas = document.createElement('canvas'); maskCanvas.width = Math.ceil(rect.width); maskCanvas.height = Math.ceil(rect.height);
        const maskContext = maskCanvas.getContext('2d'); maskContext.drawImage(mask, 0, 0, rect.width, rect.height);
        const alpha = maskContext.getImageData(20, Math.floor(rect.height) - 2, canvas.width, 1).data;
        const expected = color.match(/\d+/g).map(Number);
        // This row is 1.5–2.5px above the end of the original72%→100%
        // gradient, so the photograph still contributes a bounded few bytes.
        // Derive the allowable blend from geometry instead of requiring a
        // mathematically opaque color before the gradient actually ends.
        const distanceFromBottom = rect.bottom - (Math.floor(rect.bottom) - 1.5);
        const tolerance = Math.ceil(255 * distanceFromBottom / (rect.height * .28)) + 2;
        let matches = 0, total = 0, maxError = 0;
        const examples = [];
        for (let i = 0; i < pixels.length; i += 4) {
          if (alpha[i + 3] < 250) continue;
          total++;
          const error = Math.max(...expected.map((value, channel) => Math.abs(pixels[i + channel] - value)));
          maxError = Math.max(maxError, error);
          if (error > tolerance && examples.length < 8) examples.push({ x: 20 + i / 4, rgb: [...pixels.slice(i, i + 3)], alpha: alpha[i + 3], error });
          if (error <= tolerance) matches++;
        }
        return { matches, total, ratio: matches / total, maxError, tolerance, examples };
      }, { png: png.toString('base64'), color });
      evidence.at(-1).paintedEdge = painted;
      if (painted.total < 8 || painted.ratio < .95) problems.push(`${room}: lower photo edge retains another color (${painted.ratio.toFixed(3)} destination pixels across ${painted.total} opaque mask pixels)`);
      await page.waitForFunction(room => document.querySelector('#rooms').dataset.activeRoom === room && !document.querySelector('#rooms').classList.contains('is-lifting'), room);
    }
    assert.deepEqual(problems, []);
  } finally { await context.close(); }
});
