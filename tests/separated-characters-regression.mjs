import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.qa/feedback-characters');
let server, origin;
const browsers = new Map();
before(async () => {
  await mkdir(output, { recursive: true });
  server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) return response.writeHead(405).end();
    try {
      let filename = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
      if (!filename.startsWith(root + path.sep)) return response.writeHead(404).end();
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      let body = await readFile(filename);
      if (filename.endsWith('.html') && !body.includes('updated-characters.js')) body = body.toString().replace('</head>', '<link rel="stylesheet" href="/updated-characters.css"><script src="/updated-characters.js" defer></script></head>');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.jpeg': 'image/jpeg' };
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
});
async function fixture(engine, reducedMotion = 'no-preference', route = 'homepage-tpr/') {
  const context = await browsers.get(engine).newContext({ viewport: { width: 1512, height: 952 }, reducedMotion });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  await page.goto(origin + '/' + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: supplied separated parts retain exact paths and animate continuously across loop and hover boundaries`, async () => {
    const { context, page } = await fixture(engine);
    try {
      assert.equal(await page.locator('.people-figure .tpr-character').count(), 5, 'mount the supplied separated characters');
      assert.equal(await page.locator('.preview-menu-room[data-menu-icon] img').count(), 5, 'retain the original source Menu icons');
      assert.equal(await page.locator('.preview-menu-room .tpr-character').count(), 0);
      const identity = await page.evaluate(async () => {
        const source = new DOMParser().parseFromString(await (await fetch('/assets/figma-updated/characters/source-separated.svg')).text(), 'image/svg+xml');
        const paths = [...source.querySelectorAll('path')];
        return [...document.querySelectorAll('.people-figure .tpr-character path')].every(path => path.getAttribute('d') === paths[Number(path.dataset.sourcePathIndex)].getAttribute('d'));
      });
      assert.equal(identity, true, 'path commands must be original, never traced or redrawn');
      await page.locator('.people-figures').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.people-figure .tpr-character__upper').getAnimations().length > 0);
      const continuity = await page.locator('.people-figure .tpr-character__upper').first().evaluate(node => {
        const animation = node.getAnimations()[0], duration = Number(animation.effect.getTiming().duration);
        animation.pause(); animation.currentTime = duration - 10;
        const before = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        animation.currentTime = duration + 10;
        const after = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        const delta = Math.max(...['a','b','c','d','e','f'].map(key => Math.abs(before[key] - after[key])));
        animation.play();
        return { delta, iterations: animation.effect.getTiming().iterations, time: animation.currentTime };
      });
      assert.ok(continuity.delta < .15, 'no transform jump when the continuous loop wraps');
      assert.equal(continuity.iterations, Infinity);
      await page.locator('.people-figure').first().hover();
      await page.waitForTimeout(120);
      assert.ok(await page.locator('.people-figure .tpr-character__upper').first().evaluate(node => node.getAnimations()[0].currentTime) > continuity.time, 'hover must not restart the rig');
      await page.mouse.move(-20, -20);
      await page.locator('.people-figures').screenshot({ path: path.join(output, `${engine}-people.png`) });
      await page.locator('[data-elevator-room=reformer]').click();
      await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'reformer' && !document.querySelector('#rooms').classList.contains('is-lifting'));
      assert.equal(await page.locator('.tpr-elevator__character--current .tpr-character path').first().evaluate(node => getComputedStyle(node).fill), 'rgb(255, 193, 0)', 'Move keeps its source yellow');
      await page.screenshot({ path: path.join(output, `${engine}-move.png`) });
      for (const [key, color] of [['coworking','rgb(44, 100, 232)'],['wellness','rgb(63, 153, 65)'],['bar','rgb(255, 193, 0)'],['media','rgb(44, 100, 232)']]) {
        await page.evaluate(key => { location.hash = key; }, key);
        await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
        assert.equal(await page.locator('.tpr-elevator__character--current .tpr-character path').first().evaluate(node => getComputedStyle(node).fill), color, `${key} keeps its original Room hue`);
      }
      await page.setViewportSize({ width: 393, height: 852 });
      await page.evaluate(() => { location.hash = 'reformer'; });
      await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom === 'reformer' && !document.querySelector('#rooms').classList.contains('is-lifting'));
      await page.screenshot({ path: path.join(output, `${engine}-move-mobile.png`) });
    } finally { await context.close(); }
  });
  test(`${engine}: reduced motion leaves supplied articulated figures still and standalone Room color intact`, async () => {
    const { context, page } = await fixture(engine, 'reduce', 'rooms/reformer/');
    try {
      assert.equal(await page.locator('.preview-room-character .tpr-character').count(), 1);
      assert.equal(await page.locator('.tpr-character__upper').first().evaluate(node => getComputedStyle(node).animationName), 'none');
      assert.equal(await page.locator('.preview-room-character').evaluate(node => getComputedStyle(node).maskImage), 'none');
      assert.equal(await page.locator('.preview-room-character .tpr-character path').first().evaluate(node => getComputedStyle(node).fill), 'rgb(255, 193, 0)');
      await page.locator('.preview-room-character').screenshot({ path: path.join(output, `${engine}-reduced-move.png`) });
    } finally { await context.close(); }
  });
  test(`${engine}: a synchronous elevator hydration callback leaves the replacement rig playing`, async () => {
    const context = await browsers.get(engine).newContext({ viewport: { width: 500, height: 700 }, reducedMotion: 'no-preference' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/rig-fixture') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/updated-characters.css"><style>.tpr-elevator__character{width:200px;height:270px;color:#2c64e8}</style><script>document.addEventListener('tpr-little-men-ready',()=>{document.querySelector('.tpr-elevator__character').innerHTML=window.tprLittleMen.svg('coworking')})</script><script defer src="/updated-characters.js"></script></head><body class="updated-preview"><a class="preview-menu-room" data-menu-icon href="/rooms/coworking/" aria-label="TPR Coworking"><img src="/assets/elevator-icon-coworking-off.svg" alt=""></a><div class="tpr-elevator__character" data-room="coworking"></div></body></html>` });
      return ['GET','HEAD'].includes(route.request().method()) && url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    try {
      await page.goto(origin + '/rig-fixture', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.tpr-elevator__character .tpr-character')?.classList.contains('is-character-visible'), undefined, { timeout: 1200 });
      assert.equal(await page.locator('.tpr-elevator__character .tpr-character__upper').evaluate(node => node.getAnimations()[0].playState), 'running');
      assert.equal(await page.locator('[data-menu-icon] img').count(), 1, 'preserve the registered source Menu icon instead of substituting a character');
    } finally { await context.close(); }
  });
}
