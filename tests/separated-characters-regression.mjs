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
async function fixture(engine, reducedMotion = 'no-preference', route = 'homepage-tpr/', options = {}) {
  const context = await browsers.get(engine).newContext({ viewport: { width: 1512, height: 952 }, reducedMotion, ...options });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  page.setDefaultNavigationTimeout(20000);
  await page.goto(origin + '/' + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}
async function waitForGesture(page, selector) {
  await page.waitForFunction(selector => [...document.querySelector(selector).querySelectorAll('g')].some(part => part.getAnimations().some(animation => animation.playState === 'running')), selector);
}
async function waitForRest(page, selector) {
  await page.waitForFunction(selector => [...document.querySelector(selector).querySelectorAll('g')].every(part => part.getAnimations().length === 0), selector);
  assert.equal(await page.locator(selector).evaluate(node => [...node.querySelectorAll('g')].every(part => getComputedStyle(part).transform === 'none')), true, 'rest must be the exact supplied source pose');
}
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: original separated parts enter once, respond to hover/focus without restarting and return to their exact source pose`, async () => {
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
      const rig = '.people-figure:first-child .tpr-character';
      await waitForGesture(page, rig);
      assert.equal(await page.locator(rig).locator('.tpr-character__upper').evaluate(node => node.getAnimations()[0].effect.getTiming().iterations), 1, 'entry is a finite gesture');
      await waitForRest(page, rig);
      const figure = page.locator('.people-figure').first();
      await figure.hover(); await waitForGesture(page, rig);
      await page.waitForTimeout(350);
      const first = await figure.locator('.tpr-character__upper').evaluate(node => { window.__observedCharacterAnimation = node.getAnimations()[0]; return window.__observedCharacterAnimation.currentTime; });
      assert.ok(await figure.locator('.tpr-character__upper').evaluate(node => Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).b)) > .02, 'the supplied upper-body part visibly rotates during hover');
      await page.mouse.move(-20, -20); await figure.hover();
      assert.equal(await figure.locator('.tpr-character__upper').evaluate(node => node.getAnimations()[0] === window.__observedCharacterAnimation && node.getAnimations()[0].currentTime >= 300), true, 'rapid hover retains the running gesture and its phase');
      await page.waitForTimeout(2100);
      assert.ok(await figure.locator('.tpr-character__upper').evaluate(node => node.getAnimations().some(animation => animation.playState === 'running')), 'hover sustains gestures beyond the entry duration');
      await page.mouse.move(-20, -20);
      await waitForRest(page, rig);
      await figure.focus(); await waitForGesture(page, rig);
      assert.ok(first > 0, 'the first hover visibly progresses');
      await figure.evaluate(node => node.blur()); await waitForRest(page, rig);
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
      assert.equal(await page.locator('.tpr-character').evaluate(node => node.getAnimations({ subtree: true }).length), 0);
      await page.locator('.preview-room-character').hover();
      assert.equal(await page.locator('.tpr-character').evaluate(node => node.getAnimations({ subtree: true }).length), 0, 'reduced motion also suppresses hover');
      assert.equal(await page.locator('.preview-room-character').evaluate(node => getComputedStyle(node).maskImage), 'none');
      assert.equal(await page.locator('.preview-room-character .tpr-character path').first().evaluate(node => getComputedStyle(node).fill), 'rgb(255, 193, 0)');
      await page.locator('.preview-room-character').screenshot({ path: path.join(output, `${engine}-reduced-move.png`) });
    } finally { await context.close(); }
  });
  test(`${engine}: a synchronous elevator hydration callback gives the replacement rig one entry gesture`, async () => {
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
      await waitForRest(page, '.tpr-elevator__character .tpr-character');
    } finally { await context.close(); }
  });
  test(`${engine}: Home entry, each settled Room and reentry animate while incoming and offscreen rigs stay idle`, async () => {
    const {context,page}=await fixture(engine);
    try {
      await page.mouse.move(-20,-20);
      await page.evaluate(()=>{const host=document.querySelector('#rooms');scrollTo({top:host.getBoundingClientRect().top+scrollY,behavior:'instant'})});
      const rig='.tpr-elevator__character--current .tpr-character';
      await waitForGesture(page,rig); await waitForRest(page,rig);
      await page.locator('[data-elevator-room=reformer]').click();
      await page.waitForFunction(()=>document.querySelector('#rooms').classList.contains('is-lifting')&&document.querySelector('.tpr-elevator__character--incoming .tpr-character'));
      assert.equal(await page.locator('.tpr-elevator__character--incoming .tpr-character').evaluate(node=>node.getAnimations({subtree:true}).length),0,'incoming source parts have no hidden gesture');
      await page.waitForFunction(()=>document.querySelector('#rooms').dataset.activeRoom==='reformer'&&!document.querySelector('#rooms').classList.contains('is-lifting'));
      await waitForGesture(page,rig);await waitForRest(page,rig);
      await page.locator('.tpr-elevator__character--current').hover();await waitForGesture(page,rig);
      await page.mouse.move(-20,-20);await waitForRest(page,rig);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForFunction(()=>[...document.querySelectorAll('.tpr-character')].every(node=>node.getAnimations({subtree:true}).length===0));
      await page.evaluate(()=>{const host=document.querySelector('#rooms');scrollTo({top:host.getBoundingClientRect().top+scrollY,behavior:'instant'})});
      await waitForGesture(page,rig);
    }finally{await context.close()}
  });
  test(`${engine}: standalone Room enters again on reentry and touch does not start a hover loop`, async () => {
    const {context,page}=await fixture(engine,'no-preference','rooms/reformer/',{viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    try{
      const rig='.preview-room-character .tpr-character';
      await waitForGesture(page,rig);await waitForRest(page,rig);
      await page.locator('.preview-room-character').dispatchEvent('pointerenter',{pointerType:'touch'});
      await page.waitForTimeout(200);
      assert.equal(await page.locator(rig).evaluate(node=>node.getAnimations({subtree:true}).length),0,'touch has entry motion without a sticky hover gesture');
      await page.evaluate(()=>scrollTo({top:innerHeight*2,behavior:'instant'}));
      await page.waitForFunction(()=>{const r=document.querySelector('.preview-room-character').getBoundingClientRect();return r.bottom<0});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await waitForGesture(page,rig);
    }finally{await context.close()}
  });
  test(`${engine}: delayed source hydration preserves the outgoing Room until its lift settles`, async () => {
    const context=await browsers.get(engine).newContext({viewport:{width:1512,height:952},reducedMotion:'no-preference'});
    let release;const delayed=new Promise(resolve=>{release=resolve});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(!['GET','HEAD'].includes(request.method())||url.origin!==origin)return route.abort();
      if(url.pathname.includes('/assets/figma-updated/characters/')&&request.resourceType()==='fetch')await delayed;
      return route.continue();
    });
    const page=await context.newPage();page.setDefaultTimeout(6000);
    try{
      await page.goto(origin+'/homepage-tpr/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#rooms').dataset.elevatorReady==='true');
      await page.evaluate(()=>{const host=document.querySelector('#rooms');scrollTo({top:host.getBoundingClientRect().top+scrollY,behavior:'instant'})});
      await page.locator('[data-elevator-room=reformer]').click();
      await page.waitForFunction(()=>document.querySelector('#rooms').classList.contains('is-lifting'));
      release();
      await page.waitForFunction(()=>document.querySelector('.tpr-elevator__character--current .tpr-character')&&document.querySelector('.tpr-elevator__character--incoming .tpr-character'));
      const actors=await page.evaluate(()=>({
        settled:document.querySelector('#rooms').dataset.activeRoom,lifting:document.querySelector('#rooms').classList.contains('is-lifting'),
        current:document.querySelector('.tpr-elevator__character--current .tpr-character').dataset.character,
        incoming:document.querySelector('.tpr-elevator__character--incoming .tpr-character').dataset.character,
      }));
      assert.deepEqual(actors,{settled:'coworking',lifting:true,current:'coworking',incoming:'reformer'},'hydration must preserve the two Room identities while the original lift is in progress');
      await page.waitForFunction(()=>document.querySelector('#rooms').dataset.activeRoom==='reformer'&&!document.querySelector('#rooms').classList.contains('is-lifting'));
      await waitForGesture(page,'.tpr-elevator__character--current .tpr-character');
    }finally{release();await context.close()}
  });
  test(`${engine}: selecting a Room at the hover peak holds the outgoing pose through its visible fade`, async () => {
    const {context,page}=await fixture(engine,'no-preference','homepage-tpr/#coworking');
    try{
      const rig='.tpr-elevator__character--current .tpr-character';
      await page.mouse.move(-20,-20);await waitForRest(page,rig);
      await page.locator('.tpr-elevator__character--current').hover();
      const samples=await page.evaluate(()=>new Promise(resolve=>{
        const button=document.querySelector('[data-elevator-room="reformer"]');
        button.addEventListener('click',()=>{
          const actor=document.querySelector('.tpr-elevator__character--current'),rig=actor.querySelector('.tpr-character');
          window.__outgoingRig=rig;
          const snapshot=()=>({
            time:performance.now(),
            lifting:document.querySelector('#rooms').classList.contains('is-lifting'),opacity:Number(getComputedStyle(actor).opacity),
            matrices:[...rig.querySelectorAll('.tpr-character__body,.tpr-character__upper,.tpr-character__emblem,.tpr-character__detail')].map(part=>{
              const m=new DOMMatrixReadOnly(getComputedStyle(part).transform);return ['a','b','c','d','e','f'].map(key=>m[key]);
            }),animations:rig.getAnimations({subtree:true}).map(animation=>({state:animation.playState,time:animation.currentTime})),
          });
          let before=snapshot();const clicked=before,frames=[];
          const sample=()=>{const frame=snapshot();if(!frame.lifting)before=frame;else frames.push(frame);if(frames.length===5)resolve({clicked,before,frames});else requestAnimationFrame(sample)};
          requestAnimationFrame(sample);
        },{once:true,capture:true});
        // Observe the real running gesture and activate the native button in
        // this same frame. A protocol round trip plus pointer/actionability
        // work must not move the intended selection beyond the measured peak.
        const selectAtPeak=()=>{
          const part=document.querySelector('.tpr-elevator__character--current .tpr-character__upper');
          if(new DOMMatrixReadOnly(getComputedStyle(part).transform).b<-.13)button.click();
          else requestAnimationFrame(selectAtPeak);
        };
        requestAnimationFrame(selectAtPeak);
      }));
      // The in-page native click deliberately avoids automation latency. Move
      // the real pointer away before the replacement rig enters, as a locator
      // click on the navigation button did in the original fixture.
      await page.mouse.move(-20,-20);
      // Selection and the native two-frame lift arming are different moments:
      // the gesture may progress before the visible lift freezes its last pose.
      assert.ok(Math.abs(samples.clicked.matrices[1][1])>.1,'selection samples an actual upper-body peak');
      assert.ok(samples.frames[0].opacity>.95,'compare while the outgoing actor is still plainly visible');
      for(const frame of samples.frames){
        assert.equal(frame.matrices.length,samples.before.matrices.length);
        for(let i=0;i<frame.matrices.length;i++)for(let j=0;j<6;j++)assert.ok(Math.abs(frame.matrices[i][j]-samples.before.matrices[i][j])<(j<4?.015:.5),'native lift must preserve the articulated outgoing pose without a rest-pose pop');
        assert.ok(frame.animations.length>0&&frame.animations.every(animation=>animation.state==='paused'),'outgoing pose is paused, without a hidden running loop');
      }
      assert.deepEqual(samples.frames.at(-1).animations.map(animation=>animation.time),samples.frames[0].animations.map(animation=>animation.time),'held part animation times do not advance through the fade');
      await page.waitForFunction(()=>document.querySelector('#rooms').dataset.activeRoom==='reformer'&&!document.querySelector('#rooms').classList.contains('is-lifting'));
      await waitForGesture(page,rig);await waitForRest(page,rig);
      assert.equal(await page.evaluate(()=>!window.__outgoingRig.isConnected&&window.__outgoingRig.getAnimations({subtree:true}).length===0),true,'settling disposes the paused outgoing animations');
    }finally{await context.close()}
  });
}
