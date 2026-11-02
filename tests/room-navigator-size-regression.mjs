import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const engine = process.env.TPR_NAV_BROWSER || 'chromium';
const output = path.resolve(process.env.TPR_QA_OUTPUT || `.qa/room-nav/regression-${phase}`);
const keys = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
const titles = { coworking: 'TPR COWORKING', reformer: 'TPR MOVE', wellness: 'TPR RECHARGE', bar: 'TPR FUEL', media: 'TPR MEDIA' };
const measurements = [];
let browser;
before(async () => {
  await mkdir(output, { recursive: true });
  const browserType = { chromium, webkit }[engine];
  if (!browserType) throw new Error(`Unsupported TPR_NAV_BROWSER:${engine}; choose chromium or webkit`);
  browser = await browserType.launch({ headless: true });
});
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2)); });

async function measurePaint(page, selector, label) {
  const geometry = await page.locator(selector).evaluate(image => {
    const button = image.closest('button'), box = image.getBoundingClientRect(), frame = button.getBoundingClientRect(), scene = button.closest('.tpr-elevator__frame').getBoundingClientRect();
    // Clone the entire real control, preserving image state and the button's
    // overflow/masking. A clipped irregular outline must fail this test too.
    const copy = button.cloneNode(true), originals = [button, ...button.querySelectorAll('*')], copies = [copy, ...copy.querySelectorAll('*')];
    originals.forEach((node, index) => { const computed = getComputedStyle(node); for (const property of computed) copies[index].style.setProperty(property, computed.getPropertyValue(property), 'important'); });
    for (const [key, value] of Object.entries({ position: 'absolute', left: '12px', top: '12px', right: 'auto', bottom: 'auto', margin: '0', transform: 'none', width: `${frame.width}px`, height: `${frame.height}px` })) copy.style.setProperty(key, value, 'important');
    const host = document.createElement('div'); host.dataset.navPaintProbe = 'true';
    host.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;background:#ff00ff;width:${Math.ceil(frame.width) + 24}px;height:${Math.ceil(frame.height) + 24}px;pointer-events:none;overflow:hidden;`;
    host.append(copy); document.body.append(host);
    return { key: button.dataset.elevatorRoom, pressed: button.getAttribute('aria-pressed') === 'true', ariaLabel: button.getAttribute('aria-label'), button: { x: frame.x, y: frame.y, relativeX: frame.x - scene.x, relativeY: frame.y - scene.y, width: frame.width, height: frame.height }, image: { source: image.currentSrc, width: box.width, height: box.height } };
  });
  const host = page.locator('[data-nav-paint-probe]');
  try {
    await host.evaluate(async element => { await Promise.all([...element.querySelectorAll('img')].map(image => { image.loading = 'eager'; return image.decode(); })); });
    const screenshot = await host.screenshot({ path: path.join(output, `${label}.png`), animations: 'disabled' });
    const ink = await page.evaluate(async png => {
      const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1, pixels = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        // Exclude the test backdrop and faint antialiasing; count the actual
        // original icon's painted silhouette, including its irregular outline.
        if (Math.max(Math.abs(data[i] - 255), data[i + 1], Math.abs(data[i + 2] - 255)) > 90) {
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); pixels++;
        }
      }
      return { x: left - 12, y: top - 12, width: right - left + 1, height: bottom - top + 1, pixels };
    }, screenshot.toString('base64'));
    return { ...geometry, ink };
  } finally { await host.evaluate(e => e.remove()); }
}

for (const width of [1512, 393, 320, 430]) test(`Home Room navigator preserves original icon size across all five active states at${width}px`, { timeout: 90_000 }, async () => {
  const page = await browser.newPage({ viewport: { width, height: width === 1512 ? 952 : 852 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const failures = [], samples = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  try {
    await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const active of keys) {
      await page.evaluate(active => { location.hash = active; }, active);
      await page.waitForFunction(active => document.querySelector('#rooms')?.dataset.activeRoom === active && !document.querySelector('#rooms')?.classList.contains('is-lifting'), active);
      await page.waitForTimeout(100);
      const selected = await page.locator('.tpr-elevator__button[aria-pressed="true"]').count();
      if (selected !== 1) failures.push({ active, reason: 'exactly one active navigator icon is visible', selected });
      const labels = await page.evaluate(() => ({ status: document.querySelector('#elevatorStatus').textContent.trim(), explore: [...document.querySelectorAll('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) [data-elevator-explore]')].map(e => e.getAttribute('aria-label')) }));
      if (labels.status !== `${titles[active]} selezionata.` || labels.explore.some(label => label !== `Esplora ${titles[active]}`)) failures.push({ active, reason: 'announced room and exploration controls follow the visible updated room name', labels });
      for (const key of keys) {
        const selector = `.tpr-elevator__button[data-elevator-room="${key}"] img:visible`;
        if (await page.locator(selector).count() !== 1) { failures.push({ active, key, reason: 'each icon paints exactly one state asset' }); continue; }
        const sample = { active, ...await measurePaint(page, selector, `${width}-${active}-${key}`) }; samples.push(sample);
        if (sample.ariaLabel !== `Vai a ${titles[key]}`) failures.push({ active, key, reason: 'navigator label follows the visible updated room name', ariaLabel: sample.ariaLabel });
        if (sample.ink.pixels < 100) failures.push({ active, key, reason: 'original icon silhouette must paint', ink: sample.ink });
        if (sample.button.width < 44 || sample.button.height < 44) failures.push({ active, key, reason: 'all Room controls retain accessible hit areas', button: sample.button });
        if (width === 1512) {
          // Homepage_TPR.pdf original nominal48px toolbar frames, with SVG
          // canvas51.808655×53.660400 and painted bounds51.747559×53.446289.
          if (Math.abs(sample.button.width - 48) > 1 || Math.abs(sample.button.height - 48) > 1) failures.push({ active, key, reason: 'desktop control retains source48×48 frame', button: sample.button });
          if (Math.abs(sample.button.relativeX + sample.button.width / 2 - [596, 676, 756, 836, 916][keys.indexOf(key)]) > 1 || Math.abs(sample.button.relativeY - 824) > 1) failures.push({ active, key, reason: 'desktop toolbar retains source80px center spacing and824px top', button: sample.button });
          if (Math.abs(sample.ink.width - 51.75) > 1.25 || Math.abs(sample.ink.height - 53.45) > 1.25) failures.push({ active, key, reason: 'desktop original painted silhouette retains source size', ink: sample.ink });
        }
      }
    }
    // Mobile reference frame dimensions were not supplied for this toolbar.
    // Assert state consistency and fit, not an invented mobile source size.
    for (const key of keys) {
      const states = samples.filter(s => s.key === key), widths = states.map(s => s.ink.width), heights = states.map(s => s.ink.height);
      if (Math.max(...widths) - Math.min(...widths) > 1 || Math.max(...heights) - Math.min(...heights) > 1) failures.push({ key, reason: 'active/inactive asset swap must not shrink or inflate the same icon', widths, heights });
    }
    const allWidths = samples.map(s => s.ink.width), allHeights = samples.map(s => s.ink.height);
    if (Math.max(...allWidths) - Math.min(...allWidths) > 1.5 || Math.max(...allHeights) - Math.min(...allHeights) > 1.5) failures.push({ reason: 'the five source toolbar icons have equal painted outer size', widths: [...new Set(allWidths)], heights: [...new Set(allHeights)] });
    assert.deepEqual(errors, [], 'Room rendering must complete before measuring icons');
    measurements.push({ engine, width, samples, failures });
    assert.equal(failures.length, 0, `Room navigator dimensions and names must follow source artwork and remain stable when changing rooms; first failures:${JSON.stringify(failures.slice(0, 8))}`);
  } finally { await page.close(); }
});
