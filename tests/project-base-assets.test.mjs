import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(repository, '.qa/public-journeys/base-regression');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const roomKeys = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.otf': 'font/otf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

// Serve the real checkout exactly at the chosen mount. In the project case,
// /assets/ must return 404 instead of silently falling back to repository files.
async function fixtureAt(mount) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    const record = { method: request.method, pathname };
    requests.push(record);
    const finish = (status, body = '') => {
      record.status = status;
      response.writeHead(status, { 'Content-Type': 'text/plain' });
      response.end(body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) return finish(405);
    if (!pathname.startsWith(mount)) return finish(404, 'Outside fixture mount');
    let filename = path.resolve(repository, pathname.slice(mount.length));
    if (filename !== repository && !filename.startsWith(repository + path.sep)) return finish(404);
    try {
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      const body = await readFile(filename);
      record.status = 200;
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { finish(404, 'Not found'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    mount, requests,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function prime(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await window.tprLittleMen?.ready;
    await Promise.all([...document.images].map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
  });
}

function inspectSourceCharacter(element, { key, source }) {
  const figure = element.querySelector('.tpr-character');
  const original = new DOMParser().parseFromString(source, 'image/svg+xml');
  const paths = [...(figure?.querySelectorAll('path') || [])];
  const expected = [...original.querySelectorAll('path')];
  const rect = figure?.getBoundingClientRect();
  return {
    characterKey: figure?.dataset.character,
    source: figure?.dataset.characterSource,
    sourcePathsMatch: paths.length > 0 && paths.length === expected.length
      && paths.every((node, index) => node.getAttribute('d') === expected[index].getAttribute('d')
        && node.dataset.sourcePathIndex === expected[index].dataset.sourcePathIndex),
    painted: !!figure && rect.width > 0 && rect.height > 0
      && getComputedStyle(figure).visibility === 'visible'
      && paths.some(node => !['none', 'transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(node).fill)),
    maskImage: getComputedStyle(element).maskImage,
    expectedCharacter: key,
  };
}

// Catches shared CSS and source SVG/photo URLs dropping /tpr-site/ at runtime.
test('Room assets load at the project prefix and root preview mount', { timeout: 120_000 }, async () => {
  const evidence = { phase, started: new Date().toISOString(), mounts: [], failures: [] };
  await mkdir(output, { recursive: true });
  const characterSources = Object.fromEntries(await Promise.all(roomKeys.map(async key => [
    key, await readFile(path.join(repository, `assets/figma-updated/characters/${key}.svg`), 'utf8'),
  ])));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  try {
    for (const mount of ['/', '/tpr-site/']) {
      const fixture = await fixtureAt(mount);
      const mountEvidence = { mount, states: [], requests: fixture.requests, blocked: [] };
      evidence.mounts.push(mountEvidence);
      try {
        const routes = ['homepage-tpr/', ...roomKeys.map(key => `rooms/${key}/`)];
        for (const route of routes) {
          const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
          const responses = new Map();
          try {
            await context.route('**/*', requestRoute => {
              const request = requestRoute.request();
              if (['GET', 'HEAD'].includes(request.method()) && new URL(request.url()).origin === fixture.origin) return requestRoute.continue();
              mountEvidence.blocked.push({ url: request.url(), method: request.method() });
              return requestRoute.abort();
            });
            const page = await context.newPage();
            page.setDefaultTimeout(3_000);
            page.setDefaultNavigationTimeout(10_000);
            const captureResponse = response => responses.set(response.url(), {
              status: response.status(), resourceType: response.request().resourceType(),
              contentType: response.headers()['content-type'],
            });
            page.on('response', captureResponse);
            const documentResponse = await page.goto(`${fixture.origin}${mount}${route}`, { waitUntil: 'networkidle' });
            assert.equal(documentResponse.status(), 200, `fixture must serve real ${mount}${route}`);
            await prime(page);
            if (route === 'homepage-tpr/') {
              assert.equal(await page.locator('#rooms.tpr-elevator').count(), 1, 'Home must use the original elevator');
              // Keep the desktop check and load a separate mobile document:
              // resizing a scrolled elevator can legitimately change its Room.
              const mobilePage = await context.newPage();
              mobilePage.setDefaultTimeout(3_000);
              mobilePage.on('response', captureResponse);
              await mobilePage.setViewportSize({ width: 393, height: 852 });
              await mobilePage.goto(`${fixture.origin}${mount}${route}`, { waitUntil: 'networkidle' });
              await prime(mobilePage);
              const arts = new Set();
              for (const key of roomKeys) {
                await page.locator(`[data-elevator-room="${key}"]`).click();
                await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
                await page.locator('#rooms').evaluate(async host => {
                  await Promise.all([...host.querySelectorAll('.tpr-elevator__art--current')].map(image => image.decode().catch(() => {})));
                });
                await page.waitForFunction(key => document.querySelector('.tpr-elevator__character--current .tpr-character')?.dataset.character === key, key);
                const characterState = await page.locator('.tpr-elevator__character--current').evaluate(inspectSourceCharacter, { key, source: characterSources[key] });
                const state = await page.locator('#rooms').evaluate(host => {
                  const image = host.querySelector('.tpr-elevator__art--current');
                  const plane = host.querySelector('.tpr-elevator__photo-plane');
                  return {
                    room: host.dataset.activeRoom, art: image.src, naturalWidth: image.naturalWidth,
                    planeMaskImage: getComputedStyle(plane).maskImage,
                  };
                });
                // The source union mask now belongs to the mobile-only fade,
                // while the desktop photograph carries its own exact alpha.
                // Exercise the actual pseudo-element before checking its URL.
                await mobilePage.locator(`[data-elevator-room="${key}"]`).click();
                await mobilePage.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
                state.gradientMaskImage = await mobilePage.locator('#rooms .tpr-elevator__photo-plane').evaluate(plane => getComputedStyle(plane, '::after').maskImage);
                const maskUrl = /^url\(["']?(.+?)["']?\)$/.exec(state.gradientMaskImage)?.[1];
                const characterUrl = `${fixture.origin}${mount}assets/figma-updated/characters/${key}.svg`;
                const assetUrls = [state.art, maskUrl, characterUrl].filter(Boolean);
                for (const url of assetUrls) if (!responses.has(url)) await page.waitForResponse(response => response.url() === url, { timeout: 2_000 }).catch(() => {});
                const actual = { route, key, ...state, character: characterState, maskUrl, assets: assetUrls.map(url => ({ url, response: responses.get(url) })) };
                mountEvidence.states.push(actual); arts.add(state.art);
                const problems = [];
                if (state.room !== key || !state.naturalWidth || characterState.characterKey !== key || characterState.source !== 'figma-separato' || !characterState.sourcePathsMatch || !characterState.painted) problems.push('selected room must render its real source artwork and supplied inline character paths');
                if (new URL(state.art).pathname !== `${mount}assets/figma-updated/composites/room-${key}-masked-photos-2x.webp`) problems.push('selected Room must use its exact alpha photo composition');
                if (state.planeMaskImage !== 'none') problems.push('source alpha photos must not be clipped a second time');
                if (!maskUrl || new URL(maskUrl).pathname !== `${mount}assets/figma-updated/composites/room-${key}-photo-mask-union-2x.webp`) problems.push('gradient must use the selected Room original source mask');
                for (const asset of actual.assets) {
                  if (new URL(asset.url).origin !== fixture.origin || !new URL(asset.url).pathname.startsWith(`${mount}assets/`)) problems.push(`effective asset must remain under ${mount}assets/: ${asset.url}`);
                  const character = asset.url === characterUrl;
                  if (asset.response?.status !== 200 || asset.response?.resourceType !== (character ? 'fetch' : 'image') || (character && !asset.response?.contentType?.startsWith('image/svg+xml'))) problems.push(`effective source asset must have an actual successful response: ${asset.url}`);
                }
                if (problems.length) evidence.failures.push({ mount, ...actual, problems });
              }
              if (arts.size !== roomKeys.length) evidence.failures.push({ mount, route, problem: 'all five Room states must render distinct room artwork', arts: [...arts] });
              for (const [url, response] of responses) if (response.resourceType === 'image' && response.status >= 400) evidence.failures.push({ mount, route, problem: 'actual Home image request failed', url, response });
              continue;
            }
            for (const key of [route.split('/')[1]]) {
              const character = page.locator('[data-room-panel]:visible .preview-room-character');
              await character.locator(`.tpr-character[data-character="${key}"]`).waitFor();
              const state = await character.evaluate(inspectSourceCharacter, { key, source: characterSources[key] });
              state.room = await character.evaluate(element => element.closest('[data-room-panel]').dataset.roomPanel);
              const characterUrl = `${fixture.origin}${mount}assets/figma-updated/characters/${key}.svg`;
              if (!responses.has(characterUrl)) {
                await page.waitForResponse(response => response.url() === characterUrl, { timeout: 2_000 }).catch(() => {});
              }
              const actual = { route, key, ...state, characterUrl, response: responses.get(characterUrl) };
              mountEvidence.states.push(actual);
              // These expected public paths are independent of source markup.
              const expectedPath = `${mount}assets/figma-updated/characters/${key}.svg`;
              const problems = [];
              if (state.room !== key) problems.push(`Room state must be ${key}`);
              if (state.characterKey !== key || state.source !== 'figma-separato' || !state.sourcePathsMatch || !state.painted) problems.push('the supplied source character paths must be painted in the selected Room');
              if (state.maskImage !== 'none') problems.push('the source inline rig must replace the legacy CSS silhouette mask');
              if (new URL(characterUrl).origin !== fixture.origin || new URL(characterUrl).pathname !== expectedPath) problems.push(`effective source SVG URL must be ${expectedPath}`);
              if (actual.response?.status !== 200 || actual.response?.resourceType !== 'fetch' || !actual.response?.contentType?.startsWith('image/svg+xml')) problems.push('effective source SVG must have an actual successful SVG fetch response');
              if (problems.length) {
                evidence.failures.push({ mount, ...actual, problems });
                if (evidence.failures.length === 1) {
                  await character.scrollIntoViewIfNeeded();
                  await page.screenshot({ path: path.join(output, `first-failure-${phase}.png`), animations: 'disabled' });
                }
              }
            }
          } finally { await context.close(); }
        }
        const escaped = fixture.requests.filter(request => !request.pathname.startsWith(mount));
        if (escaped.length) evidence.failures.push({ mount, problem: 'asset requests escaped the fixture mount', requests: escaped });
      } finally { await fixture.close(); }
    }
    evidence.completed = new Date().toISOString();
    assert.deepEqual(evidence.failures, [], `Room mask requests must preserve each hosting mount; see ${path.relative(repository, output)}. ${JSON.stringify(evidence.failures, null, 2)}`);
  } finally {
    try { await browser.close(); }
    finally { await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(evidence, null, 2)); }
  }
});
