import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const engine = process.env.TPR_ENGINE || 'chromium';
const output = path.join(root, '.qa/feedback-reference/refinements', process.env.TPR_QA_PHASE || engine);
const records = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await ({ chromium, webkit })[engine].launch({ headless: true }); });
after(async () => { await browser?.close(); await writeFile(path.join(output, 'measurements.json'), JSON.stringify(records, null, 2)); });

async function at(route, width = 1512, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 952 }, reducedMotion, isMobile: width <= 720, hasTouch: width <= 720 });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(12000);
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  // Until the coordinator wires the new files, exercise the actual runtime
  // through a local injection. Missing files leave the original page intact
  // so the first run proves the reported defects rather than failing on I/O.
  if (process.env.TPR_REFINEMENTS_BASELINE !== '1') for (const file of ['updated-refinements.css', 'updated-refinements.js']) {
    const source = path.join(root, file);
    if (await access(source).then(() => true, () => false)) {
      if (file.endsWith('.css')) await page.addStyleTag({ path: source });
      else await page.addScriptTag({ path: source });
    }
  }
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}
const near = (actual, expected, label, tolerance = 1) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} instead of ${expected}`);

async function textFrame(button) {
  return button.evaluate(el => {
    const range = document.createRange();
    const label = el.querySelector('.preview-discover-face');
    if (label) range.selectNodeContents(label);
    else { const text = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()); range.selectNode(text); }
    return { outer: el.getBoundingClientRect().toJSON(), label: range.getBoundingClientRect().toJSON() };
  });
}

test(`${engine}: About selectors float while their native pointer targets stay fixed`, { timeout: 35_000 }, async () => {
  const { context, page } = await at('about/', 1512, 'no-preference');
  try {
    await page.locator('.preview-discover').scrollIntoViewIfNeeded();
    const button = page.locator('[data-discover="coworking"]');
    await page.mouse.move(1500, 940);
    const start = await textFrame(button);
    const samples = [start];
    for(let n=0;n<4;n++){ await page.waitForTimeout(250); samples.push(await textFrame(button)); }
    const moving=samples.reduce((f,s)=>Math.hypot(s.label.x-start.label.x,s.label.y-start.label.y)>Math.hypot(f.label.x-start.label.x,f.label.y-start.label.y)?s:f,start);
    near(moving.outer.x, start.outer.x, 'button x must remain stable', .01); near(moving.outer.y, start.outer.y, 'button y must remain stable', .01);
    assert.ok(Math.hypot(moving.label.x - start.label.x, moving.label.y - start.label.y) > .2, 'visible selector face must float');
    await button.hover(); const paused = await textFrame(button); await page.waitForTimeout(350); const held = await textFrame(button);
    near(held.label.x, paused.label.x, 'hover pauses floating x', .1); near(held.label.y, paused.label.y, 'hover pauses floating y', .1);
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await button.focus();
    const focused = await textFrame(button); await page.waitForTimeout(250); const focusHeld = await textFrame(button);
    near(focusHeld.label.y, focused.label.y, 'keyboard focus pauses floating', .1);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.mouse.move(0, 0); await page.locator('h1').focus();
    const reduced = await textFrame(button); await page.waitForTimeout(250); const still = await textFrame(button);
    near(still.label.y, reduced.label.y, 'reduced motion disables floating', .01);
    records.push({ check: 'floating', start, moving, paused, held, focused, focusHeld, reduced, still });
  } finally { await context.close(); }
});

for (const width of [1512, 393, 320]) test(`${engine}: About ${width}px keeps every detail CTA and its label centered`, { timeout: 30_000 }, async () => {
  const { context, page } = await at('about/', width);
  try {
    for (const key of ['reformer', 'community', 'coworking', 'wellness', 'bar', 'media']) {
      // This real sequential click also catches Move's formerly transparent
      // detail panel intercepting Community/Media pointer input.
      await page.locator(`[data-discover="${key}"]`).click();
      const link = page.locator('.preview-discover-content .preview-button'); await link.waitFor();
      const geometry = await link.evaluate(el => {
        const b=el.getBoundingClientRect(), p=el.parentElement.getBoundingClientRect();
        const range=document.createRange(); range.selectNode([...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim()));
        const t=range.getBoundingClientRect(), a=el.querySelector('.preview-chevron').getBoundingClientRect();
        return { button:b.toJSON(), content:p.toJSON(), text:t.toJSON(), arrow:a.toJSON(), href:el.href };
      });
      near(geometry.button.x + geometry.button.width/2, geometry.content.x + geometry.content.width/2, `${key} CTA frame is centered`);
      near((geometry.text.left + geometry.arrow.right)/2, geometry.button.x + geometry.button.width/2, `${key} CTA text and arrow are centered`, 2);
      assert.ok(geometry.button.left >= -1 && geometry.button.right <= width+1, `${key} CTA stays in viewport`);
      records.push({ check:'discovery-center', width, key, geometry });
    }
    await page.locator('.preview-discover').screenshot({ path:path.join(output, `about-${width}.png`) });
  } finally { await context.close(); }
});

test(`${engine}: plain textual actions share visible hover and keyboard focus without moving controls`, { timeout: 20_000 }, async () => {
  const { context, page } = await at('about/');
  try {
    await page.locator('[data-menu-open]').click();
    const link = page.locator('.preview-menu nav > a').first();
    const idle = await link.evaluate(el => ({ filter:getComputedStyle(el).filter, box:el.getBoundingClientRect().toJSON() }));
    await link.hover(); await page.waitForTimeout(220);
    const hovered = await link.evaluate(el => ({ filter:getComputedStyle(el).filter, box:el.getBoundingClientRect().toJSON() }));
    assert.notEqual(hovered.filter, idle.filter, 'plain menu text must visibly respond to hover');
    near(hovered.box.x, idle.box.x, 'hover keeps x stable', .01); near(hovered.box.y, idle.box.y, 'hover keeps y stable', .01);
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await link.focus(); await page.waitForTimeout(220);
    const focused = await link.evaluate(el => ({ visible:el.matches(':focus-visible'), filter:getComputedStyle(el).filter, outline:getComputedStyle(el).outlineStyle }));
    assert.equal(focused.visible, true); assert.notEqual(focused.filter, idle.filter, 'keyboard focus receives the same visual response'); assert.notEqual(focused.outline, 'none');
    await page.locator('[data-menu-close]').click();
    const disabled = page.locator('.preview-submit').first();
    await disabled.evaluate(el => { el.disabled=true; });
    const before = await disabled.evaluate(el => getComputedStyle(el).filter); await disabled.hover({ force:true }); await page.waitForTimeout(220);
    assert.equal(await disabled.evaluate(el => getComputedStyle(el).filter), before, 'disabled action receives no hover effect');
    records.push({ check:'text-actions', idle, hovered, focused });
  } finally { await context.close(); }
});

test(`${engine}: selecting Move leaves Community and Media reachable by pointer`, { timeout: 15_000 }, async () => {
  const { context, page } = await at('about/');
  try {
    for (const key of ['reformer','community','reformer','media']) {
      await page.locator(`[data-discover="${key}"]`).click();
      assert.equal(await page.locator(`[data-discover="${key}"]`).getAttribute('aria-pressed'),'true');
    }
  } finally { await context.close(); }
});

test(`${engine}: standalone back uses the source 24px padding and grouped top copy`, { timeout: 15_000 }, async () => {
  const { context, page } = await at('rooms/coworking/');
  try {
    await page.locator('[data-room-explore]').click();
    const card=page.locator('.preview-room-card').first(); await card.locator('[data-room-card-open]').click();
    const value=await card.locator('.preview-room-card-back').evaluate(el=>{const title=el.querySelector('h3'),p=el.querySelector('p'),cta=el.querySelector('.preview-room-card-ctas');return {back:el.getBoundingClientRect().toJSON(),title:title.getBoundingClientRect().toJSON(),body:p.getBoundingClientRect().toJSON(),cta:cta.getBoundingClientRect().toJSON(),weight:getComputedStyle(title).fontWeight};});
    near(value.title.x-value.back.x,24,'standalone source left padding'); near(value.title.y-value.back.y,24,'standalone source top padding');
    near(value.body.top-value.title.bottom,24,'standalone source body gap'); near(value.body.height,72,'standalone source three-line paragraph'); near(value.cta.width,512,'standalone source CTA width');near(value.cta.height,32,'standalone source CTA height');assert.equal(value.weight,'600');
    records.push({check:'standalone-source-card',value});
  } finally { await context.close(); }
});

async function openHome(page, width) {
  await page.locator('[data-elevator-room="coworking"]').click();
  await page.waitForFunction(() => document.querySelector('#rooms').dataset.activeRoom==='coworking' && !document.querySelector('#rooms').classList.contains('is-lifting'));
  await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) '+(width<=720?'.tpr-elevator__mobile-cta':'.tpr-elevator__desktop-copy [data-elevator-explore]')).click();
  await page.waitForFunction(mobile=>document.querySelector('#rooms').classList.contains(mobile?'is-mobile-expanded':'is-explore-ready'),width<=720);
  const card=page.locator(width<=720?'.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card':'.tpr-elevator__explore-card').first();
  await card.locator('[data-elevator-card-open]').focus(); await page.keyboard.press('Enter');
  return card;
}

for (const width of [1512, 1280]) test(`${engine}: Home ${width}px back paints source fonts and keeps its top copy grouped`, { timeout: 25_000 }, async () => {
  const { context, page } = await at('homepage-tpr/', width);
  try {
    const card=await openHome(page,width), back=card.locator('.tpr-elevator__card-back');
    const value=await back.evaluate(el=>{
      const title=el.querySelector('strong'), body=el.querySelector('.tpr-elevator__card-description'), cta=el.querySelector('.tpr-elevator__card-cta');
      const type=node=>{const s=getComputedStyle(node);return { size:parseFloat(s.fontSize),height:parseFloat(s.lineHeight),weight:s.fontWeight,tracking:s.letterSpacing,box:node.getBoundingClientRect().toJSON() };};
      return { box:el.getBoundingClientRect().toJSON(), title:type(title),body:type(body),cta:type(cta),href:cta.querySelector('a').href };
    });
    // Authenticated Figma CardBack_C1 616:3793:560×434, padding24.
    // 616:3796 Rader Bold60048/48, tracking0;616:3803 Haas Regular24/24.
    // Top header and paragraph gap24; bottom CTA frame512×32.
    const scale=value.box.width/560;
    near(value.title.size,48*scale,'source title scales with card width',.15); near(value.title.height,48*scale,'source title line-height',.15);
    assert.equal(value.title.weight,'600'); assert.ok(['normal','0px'].includes(value.title.tracking));
    near(value.body.size,24*scale,'source body scales with card width',.15); near(value.body.height,24*scale,'source body line-height',.15);
    near(value.body.box.height,72*scale,'source paragraph keeps its three-line wrap');
    near(value.title.box.left-value.box.left,24*scale,'source left padding'); near(value.title.box.top-value.box.top,24*scale,'source top padding');
    near(value.body.box.top-value.title.box.bottom,24*scale,'body follows header at source gap');
    near(value.cta.box.height,32*scale,'source CTA height'); near(value.cta.box.width,512*scale,'source CTA width');
    near(value.box.bottom-value.cta.box.bottom,24*scale,'source CTA bottom padding');
    assert.equal(value.href,new URL('vivi-tpr/',base).href);
    if(engine==='chromium'){
      const client=await context.newCDPSession(page); await client.send('DOM.enable');await client.send('CSS.enable');const {root:dom}=await client.send('DOM.getDocument');
      for(const [selector,face] of [['.tpr-elevator__explore-card.is-flipped .tpr-elevator__card-back strong','PPRader-Bold'],['.tpr-elevator__explore-card.is-flipped .tpr-elevator__card-description','AlteHaasGrotesk']]){
        const {nodeId}=await client.send('DOM.querySelector',{nodeId:dom.nodeId,selector}); const fonts=(await client.send('CSS.getPlatformFontsForNode',{nodeId})).fonts.filter(f=>f.glyphCount>0);
        assert.ok(fonts.length && fonts.every(f=>f.isCustomFont && f.postScriptName===face),`${selector} must paint ${face}: ${JSON.stringify(fonts)}`);
        records.push({check:'painted-font',width,selector,fonts});
      }
    }
    await card.screenshot({path:path.join(output,`home-back-${width}.png`)});
    records.push({check:'source-card',width,value});
    await page.keyboard.press('Escape'); assert.equal(await back.evaluate(el=>el.inert),true); assert.equal(await card.locator('[data-elevator-card-open]').evaluate(el=>el===document.activeElement),true);
  } finally { await context.close(); }
});

for(const width of [393,320])test(`${engine}: mobile ${width}px card text remains readable and native actions retain inert/focus state`,{timeout:25_000},async()=>{
  const {context,page}=await at('homepage-tpr/',width);
  try{
    const card=await openHome(page,width), back=card.locator('.tpr-elevator__mobile-card-back');
    const geometry=await back.evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('strong,.tpr-elevator__card-description,a')].map(node=>{const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect(),s=getComputedStyle(node);return {text:node.textContent,size:parseFloat(s.fontSize),clipped:r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1};});});
    assert.ok(geometry[0].size>=19);assert.ok(geometry[1].size>=14);assert.deepEqual(geometry.filter(r=>r.clipped),[]);
    assert.equal(await back.locator('a').getAttribute('href'),new URL('vivi-tpr/',base).href);
    await page.keyboard.press('Escape');assert.equal(await back.evaluate(el=>el.inert),true);assert.equal(await card.locator('[data-elevator-card-open]').evaluate(el=>el===document.activeElement),true);
    records.push({check:'mobile-card',width,geometry});
  }finally{await context.close();}
});
