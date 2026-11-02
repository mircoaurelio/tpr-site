import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { access,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium,webkit } from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),engine=process.env.TPR_ENGINE||'chromium';
const base=new URL(process.env.TPR_BASE_URL||'http://127.0.0.1:4175/');
const out=path.join(root,'.qa/feedback-reference/parallax',process.env.TPR_QA_PHASE||engine),records=[];
let browser;
before(async()=>{await mkdir(out,{recursive:true});browser=await({chromium,webkit})[engine].launch();});
after(async()=>{await browser?.close();await writeFile(path.join(out,'measurements.json'),JSON.stringify(records,null,2));});
const roles=[{key:'hero',source:'.preview-hero-composite',capture:'.hero',photo:'home-hero-room.jpeg',mask:'home-hero-photo-eye-2x.webp'},{key:'events',source:'.preview-event-composite',capture:'.preview-home-event-photo',photo:'shamans-ritual.jpeg',mask:'home-events-photo-eye-2x.webp'}];
async function pageAt(width,reducedMotion='no-preference',failPhoto=false){
 const context=await browser.newContext({viewport:{width,height:952},reducedMotion,isMobile:width<=720,hasTouch:width<=720});
 await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())&&new URL(route.request().url()).origin===base.origin?route.continue():route.abort());
 if(failPhoto)await context.route('**/home-hero-room.jpeg*',route=>route.abort());
 const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(15000);
 // Establish the actual shipped composite before loading the enhancement,
 // including after the coordinator has wired these files into generated HTML.
 await page.route('**/updated-parallax.js*',route=>route.abort());
 await page.goto(new URL('homepage-tpr/',base).href,{waitUntil:'networkidle'});
 await page.addStyleTag({content:'.tpr-cursor{display:none!important}'});
 await page.evaluate(()=>document.fonts.ready);
 return {context,page};
}
async function enhance(page){
 await page.unroute('**/updated-parallax.js*');
 for(const file of ['updated-parallax.css','updated-parallax.js'])if(await access(path.join(root,file)).then(()=>true,()=>false)){
  if(file.endsWith('.css'))await page.addStyleTag({url:new URL(file,base).href});
  else await page.addScriptTag({url:new URL(file,base).href});
 }
 await page.waitForTimeout(100);
}
async function geometry(page,role){return page.locator(role.source).evaluate(el=>{
 const plane=el.parentElement.querySelector(`[data-photo-parallax="${el.classList.contains('preview-hero-composite')?'hero':'events'}"]`),photo=plane?.querySelector('img');
 const box=node=>node?.getBoundingClientRect().toJSON();
 return {scroll:scrollY,source:box(el),sourceTranslate:getComputedStyle(el).translate,sourceOpacity:getComputedStyle(el).opacity,plane:box(plane),mask:plane?getComputedStyle(plane).maskImage:null,planeTranslate:plane?getComputedStyle(plane).translate:null,photo:box(photo),photoSrc:photo?.src,photoTranslate:photo?getComputedStyle(photo).translate:null};
});}
for(const width of [1512,393,320])test(`${engine} ${width}px: fixed source alpha masks contain moving raw photos and preserve exact zero-motion pixels`,{timeout:45000},async()=>{
 for(const role of roles){const{context,page}=await pageAt(width);try{
  await page.locator(role.source).evaluate(img=>img.decode());await page.locator(role.capture).scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  const before=await page.locator(role.capture).screenshot({path:path.join(out,`${role.key}-${width}-zero-before.png`)});
  await enhance(page);
  if(await access(path.join(root,'updated-parallax.js')).then(()=>true,()=>false))await page.waitForFunction(key=>!!document.querySelector(`[data-photo-parallax="${key}"]`),role.key);
  assert.equal(await page.locator(`[data-photo-parallax="${role.key}"]`).count(),1,'the visible proven source-photo window must be enhanced');
  const plane=page.locator(`[data-photo-parallax="${role.key}"]`);await plane.waitFor({state:'attached'});
  const zero=await geometry(page,role);
  assert.match(zero.photoSrc,new RegExp(role.photo.replaceAll('.','\\.')));assert.match(zero.mask,new RegExp(role.mask.replaceAll('.','\\.')));
  assert.equal(zero.sourceOpacity,'1','the original composite preserves its exact rest-state pixels');
  const after=await page.locator(role.capture).screenshot({path:path.join(out,`${role.key}-${width}-zero-after.png`)});
  assert.deepEqual(after,before,'zero-motion A/B must be pixel-identical, including original raster antialiasing');
  await page.evaluate(()=>scrollBy(0,80));
  await page.waitForFunction(key=>Math.abs(parseFloat(document.querySelector(`[data-photo-parallax="${key}"] img`)?.style.translate.split(' ')[1]||'0'))>.1,role.key);
  const moving=await geometry(page,role);
  assert.equal(moving.sourceTranslate,'none','the baked composite must never be translated');assert.equal(moving.planeTranslate,'none','the alpha-mask frame must never move');
  assert.equal(moving.mask,zero.mask);assert.notEqual(moving.photoTranslate,zero.photoTranslate,'only the inner raw photo moves');assert.equal(moving.sourceOpacity,'0');
  assert.ok(Math.abs((moving.plane.top+moving.scroll)-(zero.plane.top+zero.scroll))<1,'source mask stays fixed in document space');
  assert.equal(await page.locator('#rooms [data-photo-parallax]').count(),0,'the original elevator panorama is outside this enhancement');
  await page.locator(role.capture).screenshot({path:path.join(out,`${role.key}-${width}-moving.png`)});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).opacity==='1',role.source);
  const reduced=await geometry(page,role);assert.equal(reduced.sourceOpacity,'1');assert.equal(await plane.evaluate(el=>getComputedStyle(el).opacity),'0');
  records.push({width,role:role.key,zero,moving,reduced});
 }finally{await context.close();}}
});
test(`${engine}: failed raw-photo loading retains the source composite during scroll`,{timeout:20000},async()=>{
 const{context,page}=await pageAt(1512,'no-preference',true);try{await enhance(page);await page.evaluate(()=>scrollBy(0,120));await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-photo-parallax="hero"]').count(),0);assert.equal(await page.locator('.preview-hero-composite').evaluate(el=>getComputedStyle(el).opacity),'1');
 }finally{await context.close();}
});
