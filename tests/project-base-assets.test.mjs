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
    await Promise.all([...document.images].map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
  });
}

// Catches route-depth URLs in CSS custom properties resolving from the shared
// stylesheet, dropping the public /tpr-site/ prefix and hiding Room characters.
test('Room assets load at the project prefix and root preview mount', { timeout: 120_000 }, async () => {
  const evidence = { phase, started: new Date().toISOString(), mounts: [], failures: [] };
  await mkdir(output, { recursive: true });
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
            page.on('response', response => responses.set(response.url(), {
              status: response.status(), resourceType: response.request().resourceType(),
              contentType: response.headers()['content-type'],
            }));
            const documentResponse = await page.goto(`${fixture.origin}${mount}${route}`, { waitUntil: 'networkidle' });
            assert.equal(documentResponse.status(), 200, `fixture must serve real ${mount}${route}`);
            await prime(page);
            if (route === 'homepage-tpr/') {
              assert.equal(await page.locator('#rooms.tpr-elevator').count(), 1, 'Home must use the original elevator');
              const arts = new Set();
              for (const key of roomKeys) {
                await page.locator(`[data-elevator-room="${key}"]`).click();
                await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
                await page.locator('#rooms').evaluate(async host => {
                  await Promise.all([...host.querySelectorAll('.tpr-elevator__art--current,.tpr-elevator__character--current img')].map(image => image.decode().catch(() => {})));
                });
                const state = await page.locator('#rooms').evaluate(host => {
                  const image = host.querySelector('.tpr-elevator__art--current');
                  const character = host.querySelector('.tpr-elevator__character--current');
                  const characterImage = character.querySelector('img');
                  return {
                    room: host.dataset.activeRoom, art: image.src, naturalWidth: image.naturalWidth,
                    characterSvg: !!character.querySelector('svg'),
                    characterImage: characterImage ? { src: characterImage.src, naturalWidth: characterImage.naturalWidth } : null,
                    maskImage: getComputedStyle(host.querySelector('.tpr-elevator__photo-plane')).maskImage,
                  };
                });
                const maskUrl = /^url\(["']?(.+?)["']?\)$/.exec(state.maskImage)?.[1];
                const assetUrls = [state.art, maskUrl, state.characterImage?.src].filter(Boolean);
                for (const url of assetUrls) if (!responses.has(url)) await page.waitForResponse(response => response.url() === url, { timeout: 2_000 }).catch(() => {});
                const actual = { route, key, ...state, maskUrl, assets: assetUrls.map(url => ({ url, response: responses.get(url) })) };
                mountEvidence.states.push(actual); arts.add(state.art);
                const problems = [];
                if (state.room !== key || !state.naturalWidth || !(state.characterSvg || state.characterImage?.naturalWidth)) problems.push('selected room must render its real art and character');
                if (!maskUrl) problems.push('original photo-plane mask must remain present');
                for (const asset of actual.assets) {
                  if (new URL(asset.url).origin !== fixture.origin || !new URL(asset.url).pathname.startsWith(`${mount}assets/`)) problems.push(`effective asset must remain under ${mount}assets/: ${asset.url}`);
                  if (asset.response?.status !== 200 || asset.response?.resourceType !== 'image') problems.push(`effective image must have an actual successful response: ${asset.url}`);
                }
                if (problems.length) evidence.failures.push({ mount, ...actual, problems });
              }
              if (arts.size !== roomKeys.length) evidence.failures.push({ mount, route, problem: 'all five Room states must render distinct room artwork', arts: [...arts] });
              for (const [url, response] of responses) if (response.resourceType === 'image' && response.status >= 400) evidence.failures.push({ mount, route, problem: 'actual Home image request failed', url, response });
              continue;
            }
            for (const key of [route.split('/')[1]]) {
              const character = page.locator('[data-room-panel]:visible .preview-room-character');
              const state = await character.evaluate(element => ({
                maskImage: getComputedStyle(element).maskImage,
                childImageVisibility: getComputedStyle(element.querySelector('img')).visibility,
                room: element.closest('[data-room-panel]').dataset.roomPanel,
              }));
              const match = /^url\(["']?(.+?)["']?\)$/.exec(state.maskImage);
              const maskUrl = match?.[1];
              if (maskUrl && !responses.has(maskUrl)) {
                await page.waitForResponse(response => response.url() === maskUrl, { timeout: 2_000 }).catch(() => {});
              }
              const actual = { route, key, ...state, maskUrl, response: responses.get(maskUrl) };
              mountEvidence.states.push(actual);
              // These expected public paths are independent of source markup.
              const expectedPath = `${mount}assets/little-man/${key}.svg`;
              const problems = [];
              if (state.room !== key) problems.push(`Room state must be ${key}`);
              if (!maskUrl || new URL(maskUrl).origin !== fixture.origin || new URL(maskUrl).pathname !== expectedPath) problems.push(`effective mask URL must be ${expectedPath}`);
              if (actual.response?.status !== 200 || actual.response?.resourceType !== 'image' || !actual.response?.contentType?.startsWith('image/svg+xml')) problems.push('effective CSS mask must have an actual successful SVG image response');
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
