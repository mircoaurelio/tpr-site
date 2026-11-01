import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TPR_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/').replace(/\/?$/, '/');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve(process.env.TPR_QA_OUTPUT || `.qa/character-colors/${phase}`);
// Literal source palettes: shared CHARACTER_COLOR and the exported Room accents.
const colors = { coworking: '#2c64e8', reformer: '#ffc100', wellness: '#3f9941', bar: '#ffc100', media: '#2c64e8' };
const measurements = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2)); });

async function pageAt(route, width = 1512, { hydration = 'normal', motion = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: width === 1512 ? 952 : 852 }, reducedMotion: motion ? 'no-preference' : 'reduce', deviceScaleFactor: 1 });
  const pending = [];
  await page.route('**/*', async request => {
    const r = request.request();
    if (!['GET', 'HEAD'].includes(r.method())) return request.abort();
    // Only delay/fail the hydration fetch; external <img> requests stay real.
    if (/\/assets\/(?:little-man|figma-updated\/characters)\/[^/]+\.svg$/.test(new URL(r.url()).pathname) && ['fetch', 'xhr'].includes(r.resourceType())) {
      if (hydration === 'abort') return request.abort('failed');
      if (hydration === 'delay') { pending.push(request); return; }
    }
    return request.continue();
  });
  await page.goto(new URL(route, base).href, { waitUntil: hydration === 'delay' ? 'domcontentloaded' : 'networkidle' });
  // Pixel fixtures deliberately load dormant photos; scheduling has its own regressions.
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => {}); })); });
  return { page, async release() { await Promise.all(pending.splice(0).map(r => r.continue().catch(() => {}))); } };
}
async function selectRoom(page, key) {
  await page.evaluate(key => { location.hash = key; }, key);
  await page.waitForFunction(key => document.querySelector('#rooms')?.dataset.activeRoom === key && !document.querySelector('#rooms')?.classList.contains('is-lifting'), key);
  await page.waitForTimeout(100);
}

// Repaint a clone with the component's real computed styles on a plain backdrop.
// This removes the photograph/background from pixel counting without changing
// fill, color, color filters, masks or image URLs. In particular, it does not repair
// the external currentColor SVG under test. White figures use a blue backdrop.
// The lift's color-neutral blur is excluded from this isolated hue specimen;
// otherwise translucent blur fringes would fail a solid-foreground assertion.
async function raster(page, selector, label, expected) {
  const background = expected === '#ffffff' ? '#2c64e8' : '#ffffff';
  const details = await page.locator(selector).first().evaluate((element, background) => {
    const rect = element.getBoundingClientRect(), clone = element.cloneNode(true);
    const from = [element, ...element.querySelectorAll('*')], to = [clone, ...clone.querySelectorAll('*')];
    from.forEach((node, index) => {
      const computed = getComputedStyle(node);
      for (const property of computed) to[index].style.setProperty(property, computed.getPropertyValue(property), 'important');
      const colorFilters = computed.filter.replace(/blur\([^)]*\)/g, '').trim();
      to[index].style.setProperty('filter', colorFilters || 'none', 'important');
      to[index].style.setProperty('animation', 'none', 'important');
      to[index].style.setProperty('transition', 'none', 'important');
    });
    const host = document.createElement('div'); host.dataset.colorIsolation = 'true';
    const width = Math.max(1, Math.ceil(rect.width)), height = Math.max(1, Math.ceil(rect.height));
    host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;background:${background};z-index:2147483647;overflow:hidden;pointer-events:none;`;
    for (const [key, value] of Object.entries({ position: 'absolute', left: '0', top: '0', right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px`, margin: '0', transform: 'none', opacity: '1', visibility: 'visible' })) clone.style.setProperty(key, value, 'important');
    host.append(clone); document.body.append(host);
    return { color: getComputedStyle(element).color, motionFilter: getComputedStyle(element).filter, child: element.firstElementChild?.tagName, image: element.querySelector('img')?.currentSrc || (element.tagName === 'IMG' ? element.currentSrc : null), width, height };
  }, background);
  const host = page.locator('[data-color-isolation]');
  try {
    await host.evaluate(async e => { await Promise.all([...e.querySelectorAll('img')].map(i => { i.loading = 'eager'; return i.decode().catch(() => {}); })); });
    const buffer = await host.screenshot({ path: path.join(output, `${label}.png`), animations: 'disabled' });
    const pixels = await page.evaluate(async ({ png, expected, background }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height), rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
      const want = rgb(expected), back = rgb(background), histogram = new Map(); let wanted = 0, blended = 0, black = 0, foreground = 0;
      const delta = want.map((v, k) => v - back[k]);
      const magnitude = delta.reduce((sum, v) => sum + v * v, 0);
      for (let i = 0; i < data.length; i += 4) {
        const c = [data[i], data[i + 1], data[i + 2]];
        if (Math.max(...c.map((v, k) => Math.abs(v - back[k]))) <= 8) continue;
        foreground++;
        if (Math.max(...c.map((v, k) => Math.abs(v - want[k]))) <= 8) wanted++;
        // Original outlined Menu icons have many antialiased edge pixels. Every
        // such pixel must still lie on the source-color/background blend line.
        const alpha = c.reduce((sum, v, k) => sum + (v - back[k]) * delta[k], 0) / magnitude;
        if (alpha >= 0 && alpha <= 1.01 && Math.max(...c.map((v, k) => Math.abs(v - (back[k] + alpha * delta[k])))) <= 3) blended++;
        if (c.every(v => v < 25)) black++;
        const hex = '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); histogram.set(hex, (histogram.get(hex) || 0) + 1);
      }
      return { width: img.width, height: img.height, foreground, wanted, black, wantedRatio: wanted / foreground, blendedRatio: blended / foreground, blackRatio: black / foreground, dominant: [...histogram].sort((a, b) => b[1] - a[1]).slice(0, 5) };
    }, { png: buffer.toString('base64'), expected, background });
    const result = { label, expected, ...details, ...pixels }; measurements.push(result); return result;
  } finally { await host.evaluate(e => e.remove()); }
}
function wrongColor(result) {
  const correctForeground = result.label.startsWith('menu-') ? result.blendedRatio >= .99 : result.wantedRatio >= .65;
  return result.foreground < 100 || !correctForeground || result.blackRatio > .01 || result.dominant[0]?.[0] !== result.expected;
}
function assertColors(values) {
  const failures = values.filter(wrongColor).map(({ label, expected, dominant, foreground, wantedRatio, blendedRatio, blackRatio }) => ({ label, expected, dominant: dominant[0], foreground, wantedRatio, blendedRatio, blackRatio }));
  assert.deepEqual(failures, [], 'actual character foreground must retain its source color, including before/without SVG hydration');
}

test('Home Room fallback colors survive delayed or failed SVG hydration', { timeout: 120_000 }, async () => {
  const values = [];
  for (const hydration of ['abort', 'delay']) for (const width of [1512, 393]) {
    const { page, release } = await pageAt('homepage-tpr/', width, { hydration });
    try {
      for (const key of Object.keys(colors)) {
        await selectRoom(page, key);
        values.push(await raster(page, '.tpr-elevator__character--current', `fallback-${hydration}-${key}-${width}`, colors[key]));
      }
    } finally { await release(); await page.close(); }
  }
  assertColors(values);
});

test('hydrated Home and incoming Room figures retain each source hue during a lift', { timeout: 60_000 }, async () => {
  const values = [];
  const { page } = await pageAt('homepage-tpr/', 1512, { motion: true });
  try {
    for (const key of Object.keys(colors)) {
      await selectRoom(page, key);
      await page.waitForFunction(() => !!document.querySelector('.tpr-elevator__character--current svg'));
      values.push(await raster(page, '.tpr-elevator__character--current', `hydrated-${key}`, colors[key]));
      const next = Object.keys(colors)[(Object.keys(colors).indexOf(key) + 1) % 5];
      await page.evaluate(next => { document.querySelector(`[data-elevator-room="${next}"]`).click(); }, next);
      await page.waitForFunction(next => document.querySelector('#rooms')?.classList.contains('is-lifting') && document.querySelector('.tpr-elevator__character--incoming')?.dataset.room === next, next);
      values.push(await raster(page, '.tpr-elevator__character--incoming', `incoming-${next}`, colors[next]));
      await page.waitForFunction(() => !document.querySelector('#rooms')?.classList.contains('is-lifting'));
    }
  } finally { await page.close(); }
  assertColors(values);
});

test('standalone Room masks, white intro/menu and About discovery figures keep source colors', { timeout: 120_000 }, async () => {
  const values = [];
  for (const key of Object.keys(colors)) {
    const { page } = await pageAt(`rooms/${key}/`);
    try { values.push(await raster(page, '.preview-room-character', `standalone-${key}`, colors[key])); } finally { await page.close(); }
  }
  const { page } = await pageAt('homepage-tpr/');
  try {
    for (const key of Object.keys(colors)) values.push(await raster(page, `.preview-home-about .people-figure[data-room-link="${key}"] .little-man`, `intro-${key}`, '#ffffff'));
    await page.locator('[data-menu-open]').click();
    for (const key of Object.keys(colors)) values.push(await raster(page, `.preview-menu-room[href*="/rooms/${key}/"] :is(img, svg.tpr-character)`, `menu-${key}`, '#ffffff'));
  } finally { await page.close(); }
  const about = (await pageAt('about/')).page;
  try {
    for (const key of ['community', ...Object.keys(colors)]) {
      await about.locator(`[data-discover="${key}"]`).click();
      await about.waitForFunction(key => document.querySelector('.preview-discover-content')?.dataset.selectedKey === key, key);
      values.push(await raster(about, '.preview-discover-character', `about-${key}`, '#ffffff'));
    }
  } finally { await about.close(); }
  assertColors(values);
});
