import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium,webkit} from 'playwright';
const base=new URL(process.env.TPR_BASE_URL||'http://127.0.0.1:4175/');
const browsers=new Map();
before(async()=>{for(const [name,api] of Object.entries({chromium,webkit}))browsers.set(name,await api.launch());});
after(async()=>{await Promise.all([...browsers.values()].map(browser=>browser.close()));});
async function fixture(engine,width,reducedMotion='no-preference',route='eventi'){
 const context=await browsers.get(engine).newContext({viewport:{width,height:900},isMobile:width<721,hasTouch:width<721,reducedMotion});
 const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(20000);
 await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
 await page.goto(new URL(`${route}/`,base).href,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 return {context,page};
}
async function scroll(page,y){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
const visible=page=>page.waitForFunction(()=>{const r=document.querySelector('.preview-header').getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight&&getComputedStyle(document.querySelector('.preview-header')).position==='fixed';});
const hidden=page=>page.waitForFunction(()=>document.querySelector('.preview-header').getBoundingClientRect().bottom<=1);
for(const engine of ['chromium','webkit'])for(const width of [1512,393]){
 test(`${engine} ${width}px: header preserves source top, appears on scroll-up and ignores tiny jitter`,async()=>{
  const {context,page}=await fixture(engine,width,'no-preference','homepage-tpr');
  try{
   const original=await page.locator('.preview-header').evaluate(n=>({top:n.getBoundingClientRect().top,height:n.getBoundingClientRect().height,position:getComputedStyle(n).position}));
   const promotion=await page.evaluate(async()=>{
    scrollTo({top:150,behavior:'instant'});const frames=[];
    for(let i=0;i<16;i++){await new Promise(requestAnimationFrame);const n=document.querySelector('.preview-header'),r=n.getBoundingClientRect();if(n.hasAttribute('data-header-floating'))frames.push({x:r.x,bottom:r.bottom});}
    return frames;
   });
   assert.ok(promotion.length>0,'first crossing installs the floating header');
   assert.ok(promotion.every(r=>Math.abs(r.x)<=1&&r.bottom<=1),`first downward crossing stays offscreen without diagonal animation: ${JSON.stringify(promotion)}`);
   await scroll(page,700);await hidden(page);
   await scroll(page,560);await visible(page);
   assert.equal(await page.locator('.preview-header').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(44, 100, 232)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   await scroll(page,620);await hidden(page);
   await scroll(page,615);assert.ok((await page.locator('.preview-header').boundingBox()).y<0,'a five-pixel reversal must not flash the header');
   await scroll(page,590);await visible(page);
   await scroll(page,0);
   assert.deepEqual(await page.locator('.preview-header').evaluate(n=>({top:n.getBoundingClientRect().top,height:n.getBoundingClientRect().height,position:getComputedStyle(n).position})),original,'return to the untouched source header at the top');
  }finally{await context.close()}
 });
 test(`${engine} ${width}px: reduced-motion header keeps keyboard/menu focus and ignores carousel-only scrolling`,async()=>{
  const {context,page}=await fixture(engine,width,'reduce');
  try{
   await scroll(page,700);await hidden(page);
   const opener=page.locator('[data-menu-open]');await opener.evaluate(n=>n.focus({preventScroll:true}));await visible(page);
   await opener.click();assert.equal(await opener.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await opener.getAttribute('aria-expanded'),'false');
   assert.equal(await opener.evaluate(n=>n===document.activeElement),true);await visible(page);
   await opener.evaluate(n=>n.blur());await scroll(page,760);await hidden(page);await scroll(page,680);await visible(page);
   const position=await page.locator('.preview-header').boundingBox();
   await page.locator('[data-carousel]').evaluate(n=>n.scrollTo({left:n.scrollWidth,behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.deepEqual(await page.locator('.preview-header').boundingBox(),position,'horizontal travel must not hide or move the header');
   assert.equal(await page.locator('.preview-header').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  }finally{await context.close()}
 });
}
