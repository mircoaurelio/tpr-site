import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require(process.env.TPR_PLAYWRIGHT_MODULE || 'playwright');
const phase = process.env.TPR_QA_PHASE || 'after';
const output = path.resolve(process.env.TPR_QA_OUTPUT || `.qa/public-visual-reference/company-fix/${phase}`);
const base = (process.env.TPR_BASE_URL || 'http://127.0.0.1:4173').replace(/\/?$/, '/');
const engines = (process.env.TPR_PAPER_BROWSERS || 'chromium,webkit').split(',');
const browsers = new Map();
const measurements = [];
before(async () => {
  await mkdir(output, { recursive: true });
  for (const name of engines) browsers.set(name, await playwright[name].launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2));
});

function edgeDepth({ width, height, data }, alpha = false) {
  const top = [], bottom = [];
  const painted = (x, y) => {
    const i = (y * width + x) * 4;
    return alpha ? data[i + 3] >= 128 : data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
  };
  for (let x = Math.ceil(width * .15); x < width * .85; x++) {
    for (let y = 0; y < 40; y++) if (painted(x, y)) { top.push(y); break; }
    for (let y = height - 1; y >= height - 40; y--) if (painted(x, y)) { bottom.push(height - 1 - y); break; }
  }
  return {
    top: Math.max(...top) - Math.min(...top), bottom: Math.max(...bottom) - Math.min(...bottom),
    topMax: Math.max(...top), bottomMax: Math.max(...bottom), columns: top.length, width, height,
  };
}

async function analyzeImage(page, src, alpha = false) {
  return page.evaluate(async ({ src, alpha, analyze }) => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(image.naturalWidth); canvas.height = Math.ceil(image.naturalHeight);
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const raster = context.getImageData(0, 0, canvas.width, canvas.height);
    const edge = new Function('pixels', 'alpha', `return (${analyze})(pixels,alpha)`)(raster, alpha);
    const digest = await crypto.subtle.digest('SHA-256', raster.data);
    return { edge, hash: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') };
  }, { src, alpha, analyze: String(edgeDepth) });
}

async function nominalState(card) {
  return card.evaluate(element => {
    const style = getComputedStyle(element), frame = getComputedStyle(element, '::after');
    return { rect: element.getBoundingClientRect().toJSON(), scrollY,
      mask: style.maskImage, maskSize: style.maskSize, maskPosition: style.maskPosition,
      boxMask: style.getPropertyValue('-webkit-mask-box-image-source'), frame: frame.backgroundImage,
      controls: [...element.querySelectorAll('input,select,textarea,button')].map(e => ({
        tag: e.tagName, rect: e.getBoundingClientRect().toJSON(), value: e.value,
        selectedIndex: e.selectedIndex, focused: e === document.activeElement,
      })),
    };
  });
}

for (const engine of engines) {
  test(`${engine}: company paper retains source-scale edge depth instead of stretching with card height`, async t => {
    const browser = browsers.get(engine);
    for (const width of [360, 390, 820, 1440, 1512]) await t.test(`${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      try {
        await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
        await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; });
        await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
        const { edge: source } = await analyzeImage(page, new URL('assets/figma-updated/shapes/company-card-mask-1352x920.svg', base).href, true);
        // Independent source artwork at one source unit per CSS pixel sets the
        // limit. Two pixels allow edge antialiasing; card height must not amplify it.
        const bound = Math.max(source.top, source.bottom) + 2;
        const card = page.locator('.preview-company-card');
        const png = await card.screenshot({ path: path.join(output, `${engine}-${width}-company.png`), animations: 'disabled' });
        const raster = await analyzeImage(page, 'data:image/png;base64,' + png.toString('base64'));
        let nominalAB;
        if (width === 1512) {
          const enabled = await nominalState(card);
          // Compare this exact DOM/form state against only the two responsive
          // company rules disabled. Cross-build PNGs also include unrelated
          // contour ordering, rendering and application changes.
          const disabledCount = await page.evaluate(() => {
            const rules = [];
            function visit(list) { for (const rule of list) {
              if (rule.selectorText?.includes('.preview-company-card:not(.has-source-paper)')) rules.push(rule);
              if (rule.cssRules) visit(rule.cssRules);
            } }
            for (const sheet of document.styleSheets) if (sheet.href?.includes('figma-refinements.css')) visit(sheet.cssRules);
            window.__companyPaperAB = rules.map(rule => [rule, rule.style.cssText]);
            for (const [rule] of window.__companyPaperAB) rule.style.cssText = '';
            return rules.length;
          });
          assert.equal(disabledCount, 2, 'A/B must disable only the two new responsive company rules');
          try {
            const baseline = await card.screenshot({ path: path.join(output, `${engine}-${width}-without-responsive-company.png`), animations: 'disabled' });
            const baselineRaster = await analyzeImage(page, 'data:image/png;base64,' + baseline.toString('base64'));
            const disabled = await nominalState(card);
            nominalAB = { enabled, disabled, enabledHash: raster.hash, disabledHash: baselineRaster.hash };
            assert.match(enabled.mask, /company-card-mask-1352x920\.svg/, 'nominal company must retain its original mask');
            assert.match(enabled.frame, /company-card-frame-1352x920\.svg/, 'nominal company must retain its original brush frame');
            assert.deepEqual(enabled, disabled, 'nominal mask, geometry, scroll and existing form-control state must be unchanged');
            assert.equal(raster.hash, baselineRaster.hash, 'nominal desktop pixels must be identical with responsive company rules enabled/disabled');
          } finally {
            await page.evaluate(() => { for (const [rule, css] of window.__companyPaperAB) rule.style.cssText = css; delete window.__companyPaperAB; });
          }
        }
        // Hide contents only for the silhouette measurement: the unchanged real
        // card geometry/mask remains, while bright/dark photo pixels cannot be
        // mistaken for an edge. Keep the normal screenshot as visual evidence.
        const silhouette = await card.screenshot({ animations: 'disabled',
          style: '.preview-company-card > * { visibility: hidden !important; }' });
        await writeFile(path.join(output, `${engine}-${width}-silhouette.png`), silhouette);
        const { edge: actual } = await analyzeImage(page, 'data:image/png;base64,' + silhouette.toString('base64'));
        const content = await card.evaluate(element => {
          const r = element.getBoundingClientRect();
          const controls = [...element.querySelectorAll('input:not([type="hidden"]),select,textarea,button')].filter(e => e.getClientRects().length && !e.closest('.preview-trap'));
          return { nominal: element.classList.contains('has-source-paper'), width: element.clientWidth, height: element.clientHeight,
            controls: controls.map(e => { const b = e.getBoundingClientRect(); return { tag: e.tagName, inset: Math.min(b.left-r.left, r.right-b.right, b.top-r.top, r.bottom-b.bottom) }; }) };
        });
        measurements.push({ engine, viewport: width, source, bound, actual, content, nominalAB });
        if (width !== 1512) {
          assert.ok(actual.columns > actual.width * .65, 'company paper must paint across its central width');
          assert.ok(actual.top >= 1 && actual.bottom >= 1, 'paper must retain original irregular edges');
          assert.ok(actual.top <= bound && actual.bottom <= bound,
            `${width}px paper edge amplified beyond original SVG's CSS-pixel depth: ${JSON.stringify({ source, bound, actual })}`);
        }
        assert.ok(content.controls.every(e => e.inset >= 12), `native control/focus areas must remain inside the paper edge: ${JSON.stringify(content)}`);
        const focus = card.locator('input[type="email"]').first();
        await focus.focus();
        const focusPaint = await focus.evaluate(e => { const r=e.getBoundingClientRect();return { focused:document.activeElement===e, hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e }; });
        assert.ok(focusPaint.focused && focusPaint.hit, 'paper decoration must not intercept the native field hit area');
        if (width === 1512) {
          assert.ok(content.nominal, 'source-sized desktop must retain the exact original treatment');
        }
      } finally { await page.close(); }
    });
  });
}
