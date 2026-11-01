import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodeStableImage } from './helpers/decode-stable-image.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repository, '.qa/public-journeys/legacy-effect');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const evidence = [];
const roomKeys = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
let server, browser, origin, targetBase;
const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} versus ${expected}`);
const targetHome = (suffix = '') => new URL('homepage-tpr/', targetBase).href + suffix;

before(async () => {
  await mkdir(output, { recursive: true });
  const baseline = new Map();
  const previous = filename => execFileSync('git', ['show', `b18dca48:${filename}`], { cwd: repository, encoding: 'utf8', maxBuffer: 2_000_000 });
  baseline.set('/baseline/index.html', previous('homepage-tpr/index.html').replaceAll('../shared-elevator.js', '/baseline/shared-elevator.js'));
  baseline.set('/baseline/styles.css', previous('homepage-tpr/styles.css').replaceAll('../shared-elevator.css', '/baseline/shared-elevator.css'));
  baseline.set('/baseline/script.js', previous('homepage-tpr/script.js'));
  baseline.set('/baseline/shared-elevator.js', previous('shared-elevator.js'));
  baseline.set('/baseline/shared-elevator.css', previous('shared-elevator.css'));
  server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) return response.writeHead(405).end();
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/baseline/') pathname += 'index.html';
      let body;
      if (baseline.has(pathname)) body = baseline.get(pathname);
      else {
        if (pathname.startsWith('/baseline/assets/')) pathname = pathname.slice('/baseline'.length);
        let filename = path.resolve(repository, '.' + pathname);
        if (filename !== repository && !filename.startsWith(repository + path.sep)) return response.writeHead(404).end();
        if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
        body = await readFile(filename);
        pathname = filename;
      }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
      response.writeHead(200, { 'Content-Type': types[path.extname(pathname)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  // TPR_BASE_URL is a hosting root, e.g. https://host/tpr-site/ rather than a
  // complete homepage URL. Preserve its project mount when resolving Home.
  targetBase = new URL(process.env.TPR_BASE_URL || origin + '/');
  targetBase.pathname = targetBase.pathname.replace(/\/$/, '') + '/';
  targetBase.search = ''; targetBase.hash = '';
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});

after(async () => {
  try { await browser?.close(); }
  finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(evidence, null, 2));
  }
});

async function fixture(kind, width = 1280, height = 900, { reducedMotion = 'no-preference', suffix = '' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, isMobile: width <= 720, hasTouch: width <= 720, deviceScaleFactor: 1 });
  await context.route('**/*', requestRoute => {
    const request = requestRoute.request();
    const requestOrigin = new URL(request.url()).origin;
    return ['GET', 'HEAD'].includes(request.method()) && [origin, targetBase.origin].includes(requestOrigin) ? requestRoute.continue() : requestRoute.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(10_000);
  try {
    await page.goto(kind === 'baseline' ? origin + '/baseline/' + suffix : targetHome(suffix), { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => {
        // Original Home includes below-fold lazy images. Prime them before
        // decoding so the independent baseline cannot wait on lazy loading.
        image.loading = 'eager';
        return image.decode().catch(() => {});
      }));
    });
    assert.equal(await page.locator('#rooms.tpr-elevator .tpr-elevator__sticky').count(), 1, `${kind}: retain the original sticky elevator with photo/car planes and real panorama`);
    await page.evaluate(() => { const host = document.querySelector('#rooms'); scrollTo({ top: host.getBoundingClientRect().top + scrollY, behavior: 'instant' }); });
    await page.waitForFunction(() => Math.abs(document.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top) < 2);
    return { context, page };
  } catch (error) { await context.close(); throw error; }
}

async function stableScroll(page) {
  await page.evaluate(() => new Promise(resolve => {
    let previous = scrollY, stable = 0;
    const started = performance.now();
    const tick = () => {
      stable = Math.abs(scrollY - previous) < .1 ? stable + 1 : 0;
      previous = scrollY;
      if (stable >= 4 || performance.now() - started > 3_000) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

async function floor(page, key) {
  await page.locator(`[data-elevator-room="${key}"]`).click();
  await page.waitForFunction(key => { const host = document.querySelector('#rooms'); return host.dataset.activeRoom === key && !host.classList.contains('is-lifting') && !host.style.height; }, key);
}

async function openExplore(page, key = 'coworking') {
  await floor(page, key);
  await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy [data-elevator-explore]').click();
  await page.waitForFunction(() => { const host = document.querySelector('#rooms'); return host.classList.contains('is-exploring') && host.classList.contains('is-explore-ready') && !host.classList.contains('is-explore-opening'); });
  await decodeStableImage(page.locator('.tpr-elevator__explore-track > img'));
  // Ensure the initial opening scroll has been observed before a boundary test.
  await page.waitForFunction(() => Number(document.querySelector('.tpr-elevator__explore-progress').getAttribute('aria-valuenow')) >= 38);
}

async function panorama(page) {
  return page.locator('#rooms').evaluate(host => {
    const track = host.querySelector('.tpr-elevator__explore-track');
    const image = track.querySelector(':scope > img');
    const card = track.querySelector('.tpr-elevator__explore-card');
    return {
      progress: parseFloat(getComputedStyle(host).getPropertyValue('--explore-progress')),
      x: track.getBoundingClientRect().x, width: track.getBoundingClientRect().width,
      imageX: image.getBoundingClientRect().x, cardX: card.getBoundingClientRect().x,
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, src: image.src,
      viewport: { width: innerWidth, height: innerHeight }, y: scrollY,
    };
  });
}

async function wheelProgress(page, previous, direction) {
  await page.mouse.move(16, 450);
  await page.mouse.wheel(0, direction * 240);
  await page.waitForFunction(({ previous, direction }) => {
    const progress = parseFloat(getComputedStyle(document.querySelector('#rooms')).getPropertyValue('--explore-progress'));
    return direction > 0 ? progress > previous + .03 : progress < previous - .03;
  }, { previous, direction });
  return panorama(page);
}

test('original1250ms lift keeps the photo plane fixed while cars slide vertically', { timeout: 30_000 }, async () => {
  const samples = [];
  for (const kind of ['baseline', 'target']) {
    const { page, context } = await fixture(kind);
    try {
      if (kind === 'target') {
        await page.waitForFunction(() => {
          const image = document.querySelector('.tpr-elevator__art--current');
          return image.naturalWidth > 0 && parseFloat(getComputedStyle(image).opacity) >= .95 && getComputedStyle(image).visibility === 'visible';
        });
        evidence.push({ check: 'native-current-photo-visible', kind, phase: 'entry', ...(await page.locator('.tpr-elevator__art--current').evaluate(image => ({ src: image.src, opacity: getComputedStyle(image).opacity, naturalWidth: image.naturalWidth }))) });
      }
      const photoBefore = await page.locator('.tpr-elevator__photo-plane').boundingBox();
      await page.locator('[data-elevator-room="reformer"]').click();
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-lifting'));
      // Deliberately sample inside the original1250ms transition, not after it.
      await page.waitForTimeout(350);
      const sample = await page.locator('#rooms').evaluate(host => {
        const current = host.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade)');
        const incoming = host.querySelector('.tpr-elevator__car--incoming:not(.tpr-elevator__car--shade)');
        const photo = host.querySelector('.tpr-elevator__photo-plane');
        const height = host.querySelector('.tpr-elevator__frame').clientHeight;
        const transformY = element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
        return { height, lifting: host.classList.contains('is-lifting'), currentY: transformY(current) / height, incomingY: transformY(incoming) / height, photoTransform: getComputedStyle(photo).transform, photo: photo.getBoundingClientRect().toJSON(), duration: parseFloat(getComputedStyle(current).transitionDuration) * 1000 };
      });
      evidence.push({ check: 'normal-lift', kind, photoBefore, ...sample }); samples.push(sample);
      assert.equal(sample.lifting, true);
      assert.ok(sample.currentY < -.01 && sample.currentY > -.99, `${kind}: current car must be moving upward`);
      assert.ok(sample.incomingY > .01 && sample.incomingY < .99, `${kind}: incoming car must rise from below`);
      close(sample.incomingY - sample.currentY, 1, .015, `${kind}: car separation`);
      close(sample.photo.y, photoBefore.y, 2, `${kind}: photo-plane vertical position`);
      close(sample.photo.x, photoBefore.x, 2, `${kind}: photo-plane horizontal position`);
      assert.equal(sample.photoTransform, 'none');
      close(sample.duration, 1250, 2, `${kind}: original lift duration`);
      await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'reformer' && !document.querySelector('#rooms').classList.contains('is-lifting'));
      if (kind === 'target') {
        await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.tpr-elevator__art--current')).opacity) >= .95);
        evidence.push({ check: 'native-current-photo-visible', kind, phase: 'settled', ...(await page.locator('.tpr-elevator__art--current').evaluate(image => ({ src: image.src, opacity: getComputedStyle(image).opacity, naturalWidth: image.naturalWidth }))) });
      }
    } finally { await context.close(); }
  }
  close(samples[1].currentY, samples[0].currentY, .15, 'target retains baseline lift progression');
});

test('native floor scrolling advances and reverses the original sequence without boundary wrapping', { timeout: 35_000 }, async () => {
  for (const kind of ['baseline', 'target']) {
    const { page, context } = await fixture(kind, 1280, 900, { reducedMotion: 'reduce' });
    try {
      const height = await page.locator('.tpr-elevator__frame').evaluate(frame => frame.clientHeight);
      const sequence = [];
      await page.mouse.move(16, 450);
      for (const [direction, rooms] of [[1, roomKeys.slice(1)], [-1, roomKeys.slice(0, -1).reverse()]]) {
        for (const key of rooms) {
          await page.mouse.wheel(0, direction * height);
          await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key, key);
          await stableScroll(page);
          sequence.push(await page.locator('#rooms').evaluate(host => ({ key: host.dataset.activeRoom, y: scrollY, stickyTop: host.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top })));
        }
      }
      assert.deepEqual(sequence.map(item => item.key), ['reformer', 'wellness', 'bar', 'media', 'bar', 'wellness', 'reformer', 'coworking']);
      assert.ok(sequence.every(item => Math.abs(item.stickyTop) < 2));
      await page.mouse.wheel(0, -height); await stableScroll(page);
      const firstExit = await page.locator('#rooms').evaluate(host => ({ active: host.dataset.activeRoom, top: host.getBoundingClientRect().top }));
      assert.equal(firstExit.active, 'coworking'); assert.ok(firstExit.top > 1);
      await floor(page, 'media'); await page.mouse.wheel(0, height * 2 + 40); await stableScroll(page);
      const lastExit = await page.locator('#rooms').evaluate(host => ({ active: host.dataset.activeRoom, bottom: host.getBoundingClientRect().bottom }));
      assert.equal(lastExit.active, 'media'); assert.ok(lastExit.bottom < height);
      evidence.push({ check: 'native-floor-sequence', kind, sequence, firstExit, lastExit });
    } finally { await context.close(); }
  }
});

test('legacy buttons, hotspots and room hashes preserve native floor alignment and query strings', { timeout: 45_000 }, async () => {
  const query = '?audit=legacy&keep=a%2Bb';
  const { page, context } = await fixture('target', 1280, 900, { reducedMotion: 'reduce', suffix: query });
  const retain = async (key, label) => {
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(16, 450); await page.mouse.wheel(0, 16);
    await page.waitForFunction(before => scrollY > before, before); await stableScroll(page);
    const actual = await page.locator('#rooms').evaluate(host => ({ active: host.dataset.activeRoom, y: scrollY, hash: location.hash, search: location.search }));
    assert.equal(actual.active, key, `${label}: next small wheel input must retain the requested floor`);
    assert.equal(actual.search, query); evidence.push({ check: label, ...actual });
  };
  try {
    for (const key of roomKeys) { await floor(page, key); await retain(key, `button-${key}`); }
    await page.locator('[data-room-link="wellness"]').first().click();
    await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'wellness');
    await retain('wellness', 'external-hotspot');
    for (const key of roomKeys) {
      await page.goto('about:blank');
      await page.goto(targetHome(query + '#' + key), { waitUntil: 'networkidle' });
      await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && location.hash === '', key);
      await retain(key, `initial-hash-${key}`);
    }
    for (const key of [...roomKeys].reverse()) {
      await page.evaluate(key => { location.hash = key; }, key);
      await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && location.hash === '', key);
      await retain(key, `hashchange-${key}`);
    }
    await page.evaluate(() => { location.hash = 'qa-unrecognized-fragment'; });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).hash, '#qa-unrecognized-fragment'); assert.equal(new URL(page.url()).search, query);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  } finally { await context.close(); }
});

test('restored Home keeps small portrait and short-landscape room copy readable and reachable', { timeout: 60_000 }, async () => {
  for (const [width, height] of [[320, 568], [320, 852], [370, 667], [844, 390]]) {
    const { page, context } = await fixture('target', width, height, { reducedMotion: 'reduce' });
    try {
      for (const key of roomKeys) {
        await floor(page, key);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
        const data = await page.locator('#rooms').evaluate(host => {
          const rect = element => element.getBoundingClientRect().toJSON();
          const within = box => box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1;
          const unclipped = (element, box, stop) => {
            for (let ancestor = element; ancestor && ancestor !== stop; ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor), frame = rect(ancestor);
              if (['hidden', 'clip'].includes(style.overflowY) && (box.top < frame.top - 1 || box.bottom > frame.bottom + 1 || ancestor === element && ancestor.scrollHeight > ancestor.clientHeight + 1)) return false;
              if (['hidden', 'clip'].includes(style.overflowX) && (box.left < frame.left - 1 || box.right > frame.right + 1)) return false;
            }
            return true;
          };
          const car = host.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade)');
          const copy = car.querySelector(matchMedia('(max-width:720px)').matches ? '.tpr-elevator__mobile-copy' : '.tpr-elevator__desktop-copy');
          const range = document.createRange(); range.selectNodeContents(copy.querySelector('h2'));
          const text = [...copy.querySelectorAll('p')].map(paragraph => {
            const box = rect(paragraph), style = getComputedStyle(paragraph);
            let scroller;
            for (let ancestor = paragraph.parentElement; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
              if (['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) { scroller = ancestor; break; }
            }
            if (scroller) {
              const frame = rect(scroller), contentTop = box.top - frame.top + scroller.scrollTop - scroller.clientTop;
              return { text: paragraph.textContent.trim(), fontSize: parseFloat(style.fontSize), scrollable: true, accessible: within(frame) && unclipped(scroller, frame, host) && unclipped(paragraph, box, scroller) && scroller.clientHeight >= Math.min(box.height, parseFloat(style.lineHeight) * 2) && contentTop >= -2 && contentTop + box.height <= scroller.scrollHeight + 2 && box.left >= -1 && box.right <= innerWidth + 1 };
            }
            return { text: paragraph.textContent.trim(), fontSize: parseFloat(style.fontSize), scrollable: false, accessible: within(box) && unclipped(paragraph, box, host) };
          });
          return { key: host.dataset.activeRoom, width: innerWidth, height: innerHeight, title: range.getBoundingClientRect().toJSON(), explore: rect(copy.querySelector('[data-elevator-explore]')), nav: [...host.querySelectorAll('[data-elevator-room]')].map(rect), text, horizontalOverflow: document.documentElement.scrollWidth - innerWidth };
        });
        const within = box => box.left >= -1 && box.right <= data.width + 1 && box.top >= -1 && box.bottom <= data.height + 1;
        evidence.push({ check: 'target-readability', ...data });
        const problems = [];
        if (!within(data.title)) problems.push('full title outside viewport');
        if (!within(data.explore)) problems.push('Explore outside viewport');
        if (!data.nav.every(within)) problems.push('room navigation outside viewport');
        if (!data.text.length || !data.text.every(paragraph => paragraph.accessible && paragraph.fontSize >= 14)) problems.push('copy clipped, unreachable or smaller than14px');
        if (data.horizontalOverflow > 1) problems.push('horizontal document overflow');
        if (problems.length) await page.screenshot({ path: path.join(output, `readability-${width}-${key}-${phase}.png`), animations: 'disabled' });
        assert.deepEqual(problems, [], `${width}x${height} ${key}: ${JSON.stringify(data)}`);
      }
    } finally { await context.close(); }
  }
});

test('Explore opens a wide real image at39percent and vertical scroll pans image and cards together', { timeout: 35_000 }, async () => {
  const samples = [];
  for (const kind of ['baseline', 'target']) {
    const { page, context } = await fixture(kind);
    try {
      await openExplore(page);
      const start = await panorama(page);
      assert.ok(start.naturalWidth > start.naturalHeight * 2 && start.width > start.viewport.width * 2, `${kind}: Explore must render the real wide panorama, not a card-only replacement`);
      close(start.progress, .39, .015, `${kind}: original opening pan`);
      const forward = await wheelProgress(page, start.progress, 1);
      const reverse = await wheelProgress(page, forward.progress, -1);
      for (const [before, after] of [[start, forward], [forward, reverse]]) {
        assert.ok(Math.abs(after.x - before.x) > 10, `${kind}: vertical scroll must move the wide track`);
        close(after.imageX - before.imageX, after.x - before.x, 2, `${kind}: image pans with track`);
        close(after.cardX - before.cardX, after.x - before.x, 2, `${kind}: cards pan with track`);
      }
      assert.ok(forward.y > start.y && forward.x < start.x);
      assert.ok(reverse.y < forward.y && reverse.x > forward.x);
      evidence.push({ check: 'panorama-scroll', kind, start, forward, reverse }); samples.push({ start, forward, reverse });
    } finally { await context.close(); }
  }
  close(samples[1].start.progress, samples[0].start.progress, .015, 'target opening matches baseline');
  close(samples[1].forward.progress - samples[1].start.progress, samples[0].forward.progress - samples[0].start.progress, .03, 'target native-scroll pan matches baseline');
});

test('panorama preserves reverse exit, next-room handoff and final-room page exit', { timeout: 45_000 }, async () => {
  for (const kind of ['baseline', 'target']) {
    const { page, context } = await fixture(kind);
    try {
      await openExplore(page);
      const opening = await panorama(page);
      await wheelProgress(page, opening.progress, 1);
      await page.locator('.tpr-elevator__explore-progress').focus();
      await page.keyboard.press('Home');
      await page.waitForFunction(() => !document.querySelector('#rooms').classList.contains('is-exploring') && !document.querySelector('#rooms').style.height);
      const reverse = await page.locator('#rooms').evaluate(host => ({ top: host.getBoundingClientRect().top, viewport: innerHeight, active: host.dataset.activeRoom, mode: host.dataset.mode }));
      assert.ok(reverse.top >= reverse.viewport - 2, `${kind}: reversing to the panorama start exits above Rooms`);
      assert.equal(reverse.active, 'coworking');
      await openExplore(page);
      await page.locator('.tpr-elevator__explore-progress').focus(); await page.keyboard.press('End');
      await page.waitForFunction(() => Number(document.querySelector('.tpr-elevator__explore-progress').getAttribute('aria-valuenow')) === 100);
      await stableScroll(page);
      await page.mouse.move(16, 450); await page.mouse.wheel(0, 80);
      await page.waitForFunction(() => { const host = document.querySelector('#rooms'); return host.dataset.activeRoom === 'reformer' && !host.classList.contains('is-exploring') && !host.classList.contains('is-lifting') && !host.style.height; });
      const handoff = await page.locator('#rooms').evaluate(host => ({ active: host.dataset.activeRoom, top: host.getBoundingClientRect().top, stickyTop: host.querySelector('.tpr-elevator__sticky').getBoundingClientRect().top, mode: host.dataset.mode }));
      assert.equal(handoff.active, 'reformer'); close(handoff.stickyTop, 0, 2, `${kind}: next floor remains pinned`);
      await openExplore(page, 'media');
      await page.locator('.tpr-elevator__explore-progress').focus(); await page.keyboard.press('End');
      await page.waitForFunction(() => Number(document.querySelector('.tpr-elevator__explore-progress').getAttribute('aria-valuenow')) === 100);
      await stableScroll(page);
      await page.mouse.move(16, 450); await page.mouse.wheel(0, 80);
      await page.waitForFunction(() => !document.querySelector('#rooms').classList.contains('is-exploring') && !document.querySelector('#rooms').style.height);
      const exit = await page.locator('#rooms').evaluate(host => ({ active: host.dataset.activeRoom, bottom: host.getBoundingClientRect().bottom, mode: host.dataset.mode }));
      assert.equal(exit.active, 'media'); assert.ok(exit.bottom <= 2, `${kind}: Media panorama end releases to following page content`);
      evidence.push({ check: 'panorama-boundaries', kind, reverse, handoff, exit });
    } finally { await context.close(); }
  }
});

test('at720px and below Explore retains original expanding mobile cards instead of desktop panorama mode', { timeout: 40_000 }, async () => {
  for (const kind of ['baseline', 'target']) for (const width of [320, 720]) {
    const { page, context } = await fixture(kind, width, 852);
    try {
      const cta = page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-cta');
      await cta.click();
      await page.waitForFunction(() => document.querySelector('#rooms').classList.contains('is-mobile-expanded'));
      await page.waitForFunction(() => {
        const drop = document.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-drop-inner');
        return drop.clientHeight > 0 && drop.scrollWidth > drop.clientWidth;
      });
      const expanded = await page.locator('#rooms').evaluate(host => {
        const drop = host.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-drop-inner');
        return { expanded: host.classList.contains('is-mobile-expanded'), desktopExplore: host.classList.contains('is-exploring'), mode: host.dataset.mode, overflowX: getComputedStyle(drop).overflowX, scrollWidth: drop.scrollWidth, clientWidth: drop.clientWidth };
      });
      assert.equal(expanded.desktopExplore, false); assert.equal(expanded.mode, undefined);
      assert.equal(await cta.getAttribute('aria-expanded'), 'true');
      assert.equal(expanded.overflowX, 'auto'); assert.ok(expanded.scrollWidth > expanded.clientWidth);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#rooms').classList.contains('is-mobile-expanded'));
      assert.equal(await cta.getAttribute('aria-expanded'), 'false');
      await cta.click(); await floor(page, 'reformer');
      assert.equal(await page.locator('#rooms').evaluate(host => host.classList.contains('is-mobile-expanded')), false, `${kind}: changing floors closes mobile cards`);
      evidence.push({ check: 'mobile-expansion', kind, width, ...expanded });
    } finally { await context.close(); }
  }
});
