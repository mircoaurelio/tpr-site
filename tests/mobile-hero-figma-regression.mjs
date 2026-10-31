import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.hash = ''; base.search = '';
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve(process.env.TPR_QA_OUTPUT || `.qa/mobile-hero-figma/${phase}`);
const measurements = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(measurements, null, 2)); });

async function openAt(width) {
  const page = await browser.newPage({ viewport: { width, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await document.querySelector('.preview-hero-composite').decode(); });
  assert.deepEqual(errors, [], 'the source hero must render without script errors');
  return page;
}
async function measure(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const hero = document.querySelector('.hero'), title = document.querySelector('#hero-title'), image = hero.querySelector('.preview-hero-composite'), header = document.querySelector('.preview-header'), intro = document.querySelector('.preview-home-about');
    const type = getComputedStyle(title), art = getComputedStyle(image), copy = getComputedStyle(intro), first = intro.querySelector('.preview-two-columns');
    const spans = [...title.querySelectorAll('span')].map(span => { const r = document.createRange(); r.selectNodeContents(span); return { text: span.textContent.trim(), box: rect(span), glyphBox: rect(r) }; });
    const transform = art.transform === 'none' ? { a: 1, d: 1, b: 0, c: 0 } : new DOMMatrixReadOnly(art.transform);
    return {
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, hero: rect(hero), title: rect(title), header: rect(header), brand: rect(header.querySelector('.preview-brand')), headerBookingVisible: getComputedStyle(header.querySelector('.preview-button')).display !== 'none', intro: rect(intro), firstIntroContent: rect(first),
      type: { family: type.fontFamily, size: parseFloat(type.fontSize), lineHeight: parseFloat(type.lineHeight), weight: type.fontWeight, tracking: type.letterSpacing === 'normal' ? 0 : parseFloat(type.letterSpacing), transform: type.textTransform, align: type.textAlign, color: type.color },
      introStyle: { paddingTop: parseFloat(copy.paddingTop), paddingLeft: parseFloat(copy.paddingLeft), paddingRight: parseFloat(copy.paddingRight) }, spans,
      art: { source: image.currentSrc, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, box: rect(image), fit: art.objectFit, mask: art.maskImage, transform: { a: transform.a, d: transform.d, b: transform.b, c: transform.c } },
    };
  });
}
async function paintedFonts(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable'); await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#hero-title' });
    return (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts.filter(f => f.glyphCount > 0);
  } finally { await session.detach(); }
}
function sourceProblems(data, fonts) {
  const problems = [], near = (actual, expected, label, tolerance = 1) => { if (Math.abs(actual - expected) > tolerance) problems.push(`${label}: expected${expected}, painted${actual}`); };
  // Independent literals observed in the authenticated Figma UI:
  // Website Mobile560:1291 / Article560:2843 / Title560:2991.
  near(data.hero.height, 326, 'source hero height'); near(data.hero.x, 0, 'source hero left'); near(data.hero.width, 393, 'source hero width');
  near(data.title.x, 223, 'source title x'); near(data.title.y, 262, 'source title y'); near(data.title.width, 142, 'source title width'); near(data.title.height, 64, 'source title height');
  near(393 - data.title.right, 28, 'source title right inset');
  near(data.type.size, 36, 'source font size', .01); near(data.type.lineHeight, 32.4, 'source90% line height', .01);
  if (data.type.weight !== '600') problems.push(`source font weight: expected600, painted${data.type.weight}`);
  if (data.type.tracking !== 0 || data.type.transform !== 'uppercase' || data.type.align !== 'right' || data.type.color !== 'rgb(255, 255, 255)') problems.push('source title retains zero tracking, uppercase, right alignment and white foreground');
  if (!fonts.length || fonts.some(f => !f.isCustomFont || f.postScriptName !== 'PPRader-Bold')) problems.push(`title must actually paint PP Rader Bold: ${JSON.stringify(fonts)}`);
  near(data.header.width, 393, 'source header width'); near(data.header.height, 77.33, 'source header height');
  near(data.header.y, 24, 'source header top');
  near(data.brand.width, 109.47, 'source brand width', .1); near(data.brand.height, 53.33, 'source brand height', .1);
  if (data.headerBookingVisible) problems.push('source mobile header contains logo and hamburger; booking remains available through the menu');
  near(data.intro.y, 326, 'source introductory Copy starts after the hero'); near(data.firstIntroContent.y, 350, 'source first intro content y');
  near(data.introStyle.paddingTop, 24, 'source intro top padding'); near(data.introStyle.paddingLeft, 24, 'source intro left padding'); near(data.introStyle.paddingRight, 24, 'source intro right padding');
  return problems;
}
function compositionProblems(data) {
  const problems = [], { art } = data;
  // The exact907×501 mobile Vector is unavailable. The fallback deliberately
  // retains the supplied3024×1904 photo/eye unit rather than stretching a
  // separate desktop alpha mask over the raw, differently cropped photograph.
  if (art.naturalWidth !== 3024 || art.naturalHeight !== 1904) problems.push('mobile fallback must decode the original3024×1904 photo/eye composition');
  if (art.mask !== 'none') problems.push('the complete composition must not receive a second independently stretched mask');
  const ratioPreserved = Math.abs(art.box.width / art.box.height - art.naturalWidth / art.naturalHeight) < .01;
  if (!ratioPreserved && !['cover', 'contain', 'scale-down'].includes(art.fit)) problems.push('photo/eye composition must retain its intrinsic proportions');
  if (Math.abs(Math.abs(art.transform.a) - Math.abs(art.transform.d)) > .001 || Math.abs(art.transform.b) > .001 || Math.abs(art.transform.c) > .001) problems.push('artwork must not be stretched by a nonuniform transform');
  if (data.spans.length !== 2) problems.push('both native title lines must be present');
  for (const line of data.spans) if (!line.text || line.glyphBox.x < -1 || line.glyphBox.right > data.viewport + 1) problems.push(`title line must stay readable: ${line.text}`);
  if (data.title.y < -1 || data.title.bottom > data.hero.bottom + 1) problems.push('title must stay within the source hero');
  if (data.documentWidth !== data.viewport) problems.push('mobile hero must not create horizontal document overflow');
  return problems;
}

test('393px Home hero matches inspected Figma mobile title, header and326px section geometry', { timeout: 30_000 }, async () => {
  const page = await openAt(393);
  try {
    const data = await measure(page), fonts = await paintedFonts(page), problems = [...sourceProblems(data, fonts), ...compositionProblems(data)];
    measurements.push({ check: 'source-393', ...data, fonts, problems });
    await page.screenshot({ path: path.join(output, 'source-393.png'), animations: 'disabled' });
    assert.deepEqual(problems, [], 'source Mobile Article geometry and typography must replace the oversized desktop adaptation');
  } finally { await page.close(); }
});

test('320px and430px hero adaptations preserve original composition proportions and readable title lines', { timeout: 45_000 }, async () => {
  for (const width of [320, 430]) {
    const page = await openAt(width);
    try {
      const data = await measure(page), problems = compositionProblems(data);
      measurements.push({ check: 'responsive-fit', ...data, problems });
      await page.screenshot({ path: path.join(output, `responsive-${width}.png`), animations: 'disabled' });
      assert.deepEqual(problems, [], `${width}px adaptation must preserve source artwork and title readability; no unprovided frame geometry is asserted`);
    } finally { await page.close(); }
  }
});
