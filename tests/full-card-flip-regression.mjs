import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { access,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium,webkit } from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),engine=process.env.TPR_ENGINE||'chromium';
const base=new URL(process.env.TPR_BASE_URL||'http://127.0.0.1:4175/');
const out=path.join(root,'.qa/feedback-reference/card-motion',process.env.TPR_QA_PHASE||engine),records=[];
let browser;
before(async()=>{await mkdir(out,{recursive:true});browser=await({chromium,webkit})[engine].launch();});
after(async()=>{await browser?.close();await writeFile(path.join(out,'measurements.json'),JSON.stringify(records,null,2));});
async function at(route,width=1512,reducedMotion='no-preference',blockedSource=null){
 const context=await browser.newContext({viewport:{width,height:952},reducedMotion,isMobile:width<=720,hasTouch:width<=720});
 await context.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&new URL(r.request().url()).origin===base.origin?r.continue():r.abort());
 let releaseFront=()=>{};
 if(typeof blockedSource==='string')await context.route(`**/${blockedSource}*`,r=>r.abort());
 else if(blockedSource?.hold){const gate=new Promise(resolve=>{releaseFront=resolve;});await context.route(`**/${blockedSource.hold}*`,async r=>{await gate;await r.continue().catch(()=>{});});}
 const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(15000);
 await page.goto(new URL(route,base).href,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'.tpr-cursor{display:none!important}'});
 for(const file of ['updated-card-motion.css','updated-card-motion.js'])if(await access(path.join(root,file)).then(()=>true,()=>false)){
  if(file.endsWith('.css'))await page.addStyleTag({url:new URL(file,base).href});else await page.addScriptTag({url:new URL(file,base).href});
 }
 return{context,page,releaseFront};
}
async function frame(card){return card.evaluate(el=>{
 const rotor=el.querySelector('.tpr-card-rotor'), front=el.querySelector('.tpr-card-front-face')||el.querySelector('.preview-room-card-front,[data-elevator-card-open]'),back=el.querySelector('.tpr-card-back-face')||el.querySelector('.preview-room-card-back,.tpr-elevator__card-back,.tpr-elevator__mobile-card-back');
 const measure=node=>{const s=getComputedStyle(node),m=new DOMMatrixReadOnly(s.transform==='none'?undefined:s.transform);return{box:node.getBoundingClientRect().toJSON(),transform:s.transform,matrix:[m.m11,m.m13,m.m43],opacity:s.opacity,backface:s.backfaceVisibility,mask:s.maskImage};};
 const photo=front.querySelector('.tpr-card-source-front,.preview-room-card-photo,.tpr-elevator__mobile-card-photo');
 return{box:el.getBoundingClientRect().toJSON(),perspective:getComputedStyle(el).perspective,rotor:rotor?measure(rotor):null,front:measure(front),back:measure(back),photo:photo?measure(photo):null,flipped:el.classList.contains('is-flipped')};
});}
const near=(a,b,label,t=.03)=>assert.ok(Math.abs(a-b)<t,`${label}: ${a} vs ${b}`);
async function normalFlip(page,card,open,close,key){
 await open.click({trial:true});
 const start=await frame(card);assert.ok(start.rotor,'both complete faces must share one rotating3D surface');await open.focus();await page.keyboard.press('Enter');
 // Freeze the first observed front-facing turn for meaningful visual evidence,
 // rather than letting font/image screenshot preparation run past the motion.
 await page.waitForFunction(el=>{const r=el.querySelector('.tpr-card-rotor'),a=r?.getAnimations()[0];if(!a)return false;const m=new DOMMatrixReadOnly(getComputedStyle(r).transform);if(Math.abs(m.m13)>.35&&m.m11>0){const t=a.currentTime;a.pause();a.currentTime=t;return true;}return false;},await card.elementHandle());
 const moving=await frame(card);
 assert.ok(moving.rotor,'both complete faces must share one rotating3D surface');
 assert.ok(start.photo&&moving.photo,'the complete photo region must belong to the rotating front');
 assert.ok(moving.photo.box.width<start.photo.box.width*.95,'the photo itself must turn with the label/paper rather than stay flat behind it');
 assert.ok(Math.abs(moving.rotor.matrix[1])>.05,'the shared rotor must visibly rotate around its vertical axis');
 near(moving.front.matrix[0],1,'front remains attached to rotor');near(moving.back.matrix[0],-1,'back remains exactly180 degrees behind front');
 assert.equal(moving.front.opacity,'1');assert.equal(moving.back.opacity,'0');assert.equal(moving.front.backface,'hidden');assert.equal(moving.back.backface,'hidden');
 assert.ok(parseFloat(moving.perspective)>0);near(moving.box.width,start.box.width,'card hit frame width is unchanged',.1);near(moving.box.height,start.box.height,'card hit frame height is unchanged',.1);
 await card.screenshot({path:path.join(out,`${key}-during.png`)});
 if(key==='home-desktop')await page.locator('.tpr-elevator__frame').screenshot({path:path.join(out,'home-desktop-whole-scene-during.png')});
 await card.locator('.tpr-card-rotor').evaluate(el=>el.getAnimations()[0].play());
 await page.waitForFunction(el=>{const r=el.querySelector('.tpr-card-rotor');return r&&Math.abs(new DOMMatrixReadOnly(getComputedStyle(r).transform).m11+1)<.001;},await card.elementHandle());
 const back=card.locator('.preview-room-card-back,.tpr-elevator__card-back,.tpr-elevator__mobile-card-back');
 assert.equal(await back.evaluate(el=>el.inert),false);assert.equal(await close.evaluate(el=>el===document.activeElement),true);
 const links=await back.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href));assert.ok(links.every(href=>href.startsWith(base.href)));
 await card.screenshot({path:path.join(out,`${key}-back.png`)});
 await page.keyboard.press('Escape');
 await page.waitForFunction(el=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(el.querySelector('.tpr-card-rotor')).transform).m11-1)<.001,await card.elementHandle());
 assert.equal(await back.evaluate(el=>el.inert),true);assert.equal(await open.evaluate(el=>el===document.activeElement),true);
 // Reversing a live turn must return to the front without queued state changes.
 await page.keyboard.press('Enter');await page.waitForTimeout(90);await page.keyboard.press('Escape');await page.waitForTimeout(750);
 assert.equal(await open.getAttribute('aria-expanded'),'false');near((await frame(card)).rotor.matrix[0],1,'rapid reversal finishes on requested face');
 records.push({key,start,moving,end:await frame(card),links});
}
for(const width of [1512,393,320])test(`${engine}: standalone ${width}px turns complete front/photo and back together with native controls`,{timeout:30000},async()=>{
 const{context,page}=await at('rooms/coworking/',width);try{
  await page.locator('[data-room-explore]').click();const card=page.locator('.preview-room-card').first();
  await normalFlip(page,card,card.locator('[data-room-card-open]'),card.locator('[data-room-card-close]'),`standalone-${width}`);
 }finally{await context.close();}
});
async function homeCard(page,width){
 await page.locator('[data-elevator-room="coworking"]').click();await page.waitForFunction(()=>document.querySelector('#rooms').dataset.activeRoom==='coworking'&&!document.querySelector('#rooms').classList.contains('is-lifting'));
 await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) '+(width<=720?'.tpr-elevator__mobile-cta':'.tpr-elevator__desktop-copy [data-elevator-explore]')).click();
 await page.waitForFunction(m=>document.querySelector('#rooms').classList.contains(m?'is-mobile-expanded':'is-explore-ready'),width<=720);
 const card=page.locator(width<=720?'.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card':'.tpr-elevator__explore-card').first();
 if(width<=720)await page.waitForFunction(el=>!el.closest('.tpr-elevator__car').getAnimations({subtree:true}).some(a=>'transitionProperty' in a&&a.playState==='running'),await card.elementHandle());
 return card;
}
test(`${engine}: Home desktop turns the source photo/paper with its back above a cardless original panorama`,{timeout:35000},async()=>{
 const{context,page}=await at('homepage-tpr/');try{
  const card=await homeCard(page,1512);
  if(await access(path.join(root,'updated-card-motion.js')).then(()=>true,()=>false))await card.locator('.tpr-card-source-front').waitFor();
  const source=await card.locator('.tpr-card-source-front').getAttribute('src');assert.match(source,/room-coworking-card-postazioni-front-2x\.webp/);
  assert.match(await page.locator('.tpr-elevator__explore-track > img').getAttribute('src'),/room-coworking-panorama-background-2x\.webp/,'no baked static card photo can remain behind the rotating front');
  assert.equal(await card.locator('.tpr-card-source-front').evaluate(img=>img.complete&&img.naturalWidth>500),true);
  const fronts=await page.locator('.tpr-elevator__explore-card').evaluateAll(cards=>cards.map(card=>{const img=card.querySelector('.tpr-card-source-front'),r=card.getBoundingClientRect(),p=img.getBoundingClientRect();return{src:img.src,owned:card.querySelector('.tpr-card-front-face').contains(img),dx:(p.left+p.width/2)-(r.left+r.width/2),dy:(p.top+p.height/2)-(r.top+r.height/2)};}));
  assert.ok(fronts.every(f=>f.owned&&Math.abs(f.dx)<15&&Math.abs(f.dy)<15),'all source fronts must align with their existing native hotspots');records.push({key:'desktop-source-fronts',fronts});
  await normalFlip(page,card,card.locator('[data-elevator-card-open]'),card.locator('[data-elevator-card-close]'),'home-desktop');
 }finally{await context.close();}
});
test(`${engine}: a failed source front keeps the complete panorama and native controls available`,{timeout:20000},async()=>{
 const{context,page}=await at('homepage-tpr/',1512,'no-preference','room-coworking-card-postazioni-front-2x.webp');try{
  const card=await homeCard(page,1512);await page.waitForTimeout(300);
  assert.doesNotMatch(await page.locator('.tpr-elevator__explore-track > img').getAttribute('src'),/panorama-background/,'the backdrop must not lose baked cards before every replacement front is ready');
  assert.equal(await card.locator('.tpr-card-source-front').count(),0);
  const open=card.locator('[data-elevator-card-open]'),back=card.locator('.tpr-elevator__card-back');await open.focus();await page.keyboard.press('Enter');
  assert.equal(await back.getAttribute('aria-hidden'),'false');assert.equal(await back.evaluate(el=>el.inert),false);assert.equal(await back.locator('a').getAttribute('href'),new URL('vivi-tpr/',base).href);
  await page.keyboard.press('Escape');assert.equal(await open.evaluate(el=>el===document.activeElement),true);
 }finally{await context.close();}
});
for(const width of [393,320])test(`${engine}: Home mobile ${width}px rotates its complete native photo face`,{timeout:30000},async()=>{
 const{context,page}=await at('homepage-tpr/',width);try{const card=await homeCard(page,width);await normalFlip(page,card,card.locator('[data-elevator-card-open]'),card.locator('[data-elevator-card-close]'),`home-${width}`);}finally{await context.close();}
});
test(`${engine}: reduced motion presents the requested native face immediately`,{timeout:20000},async()=>{
 const{context,page}=await at('rooms/coworking/',393,'reduce');try{
  await page.locator('[data-room-explore]').click();const card=page.locator('.preview-room-card').first();await card.locator('[data-room-card-open]').click();const value=await frame(card);
  assert.ok(value.rotor);near(value.rotor.matrix[0],-1,'reduced motion final face');
  assert.equal(await card.locator('[data-room-card-close]').evaluate(el=>el===document.activeElement),true);
  assert.equal(await card.locator('.tpr-card-rotor').evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0);
  await page.keyboard.press('Escape');near((await frame(card)).rotor.matrix[0],1,'reduced motion front restore');
 }finally{await context.close();}
});
test(`${engine}: all five Home Rooms use complete source faces without losing native back actions`,{timeout:60000},async()=>{
 const{context,page}=await at('homepage-tpr/',1512,'reduce');try{
  for(const key of ['coworking','reformer','wellness','bar','media']){
   await page.locator(`[data-elevator-room="${key}"]`).click();await page.waitForFunction(k=>document.querySelector('#rooms').dataset.activeRoom===k&&!document.querySelector('#rooms').classList.contains('is-lifting'),key);
   await page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__desktop-copy [data-elevator-explore]').click();await page.waitForFunction(()=>document.querySelector('#rooms').classList.contains('is-explore-ready'));
   await page.waitForFunction(k=>[...document.querySelectorAll('.tpr-elevator__explore-card .tpr-card-source-front')].length===3&&document.querySelector('.tpr-elevator__explore-track > img').src.includes(`room-${k}-panorama-background`),key);
   const cards=page.locator('.tpr-elevator__explore-card');assert.equal(await cards.count(),3);
   for(const card of await cards.all()){
    assert.equal(await card.locator('.tpr-card-front-face .tpr-card-source-front').evaluate(img=>img.complete&&img.naturalWidth>500),true);
    const open=card.locator('[data-elevator-card-open]'),back=card.locator('.tpr-elevator__card-back');await open.focus();await page.keyboard.press('Enter');
    assert.equal(await back.evaluate(el=>el.inert),false);assert.equal(await card.locator('[data-elevator-card-close]').evaluate(el=>el===document.activeElement),true);
    const hrefs=await back.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href));assert.ok(hrefs.every(url=>url.startsWith(base.href)));records.push({key:'all-room-source-face',room:key,title:await back.locator('strong').textContent(),hrefs});
    await page.keyboard.press('Escape');assert.equal(await back.evaluate(el=>el.inert),true);
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#rooms').classList.contains('is-exploring'));
  }
 }finally{await context.close();}
});
test(`${engine}: delayed source fronts preserve the already-focused native front or back control`,{timeout:30000},async()=>{
 for(const focusedFace of ['front','back']){
  const{context,page,releaseFront}=await at('homepage-tpr/',1512,'reduce',{hold:'room-coworking-card-postazioni-front-2x.webp'});
  try{
   const card=await homeCard(page,1512),open=card.locator('[data-elevator-card-open]'),close=card.locator('[data-elevator-card-close]');
   assert.equal(await card.locator('.tpr-card-rotor').count(),0,'the held source must leave native controls available during loading');
   await open.focus();if(focusedFace==='back')await page.keyboard.press('Enter');const target=focusedFace==='front'?open:close;
   assert.equal(await target.evaluate(el=>el===document.activeElement),true);
   releaseFront();await card.locator('.tpr-card-source-front').waitFor({state:'attached'});
   assert.equal(await target.evaluate(el=>el===document.activeElement),true,`installing complete faces must preserve focused native ${focusedFace} control`);
   if(focusedFace==='front'){await page.keyboard.press('Enter');assert.equal(await card.locator('.tpr-elevator__card-back').evaluate(el=>el.inert),false);assert.equal(await close.evaluate(el=>el===document.activeElement),true);}
   await page.keyboard.press('Escape');assert.equal(await open.evaluate(el=>el===document.activeElement),true);
   records.push({key:'delayed-source-focus',focusedFace,preserved:true});
  }finally{releaseFront();await context.close();}
 }
});

test(`${engine}: a pointer held during delayed source installation still activates the native card`,{timeout:20000},async()=>{
 const{context,page,releaseFront}=await at('homepage-tpr/',1512,'reduce',{hold:'room-coworking-card-postazioni-front-2x.webp'});
 try{
  const card=await homeCard(page,1512),open=card.locator('[data-elevator-card-open]');
  assert.equal(await card.locator('.tpr-card-rotor').count(),0);
  const panorama=page.locator('.tpr-elevator__explore-track > img'),fallback=await panorama.getAttribute('src');
  await open.evaluate(el=>{window.__nativeCardClicks=0;el.addEventListener('click',()=>window.__nativeCardClicks++);});
  const box=await open.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  const response=page.waitForResponse(r=>r.url().includes('room-coworking-card-postazioni-front-2x.webp'));
  releaseFront();await(await response).finished();
  // Exercise a real press held while already-delivered artwork decodes. The
  // eventual source wait is after release, so deferring installation is valid.
  await page.waitForTimeout(300);
  assert.equal(await panorama.getAttribute('src'),fallback,'all source faces and backdrop must remain on their complete fallback through the press');
  assert.equal(await card.locator('.tpr-card-source-front').count(),0,'one held card defers the entire source installation');
  await page.mouse.up();await card.locator('.tpr-card-source-front').waitFor({state:'attached'});
  assert.equal(await open.getAttribute('aria-expanded'),'true','the original pointer press/release must still activate its native button');
  assert.equal(await card.locator('.tpr-elevator__card-back').evaluate(el=>el.inert),false);
  assert.equal(await card.locator('[data-elevator-card-close]').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>window.__nativeCardClicks),1,'one native click, without a synthesized replacement');
  await page.keyboard.press('Escape');assert.equal(await open.evaluate(el=>el===document.activeElement),true);
  records.push({key:'delayed-source-pointer',activated:true});
 }finally{releaseFront();await page.mouse.up().catch(()=>{});await context.close();}
});
