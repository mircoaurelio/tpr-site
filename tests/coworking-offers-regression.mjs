import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium,webkit} from 'playwright';
const base=new URL(process.env.TPR_BASE_URL||'http://127.0.0.1:4175/');
const browsers=new Map();
before(async()=>{for(const [name,api] of Object.entries({chromium,webkit}))browsers.set(name,await api.launch());});
after(async()=>{await Promise.all([...browsers.values()].map(browser=>browser.close()));});
for(const engine of ['chromium','webkit'])for(const width of [1512,393])test(`${engine} ${width}px: Coworking booking and standalone access open Vivi TPR offers`,async()=>{
 const context=await browsers.get(engine).newContext({viewport:{width,height:900},hasTouch:width<721,isMobile:width<721,reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(20000);
 await page.route('**/*',route=>new URL(route.request().url()).origin===base.origin&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
 const expected=new URL('vivi-tpr/#offerte',base).href;
 try{
  await page.goto(new URL('homepage-tpr/#coworking',base).href,{waitUntil:'networkidle'});
  const book=page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) '+(width<721?'.tpr-elevator__mobile-book':'.tpr-elevator__desktop-copy [data-elevator-book]'));
  assert.equal(await book.getAttribute('href'),expected);
  if(width<721)await book.tap();else{await book.focus();await page.keyboard.press('Enter');}
  await page.waitForURL(expected);assert.equal(await page.locator('#offerte').count(),1);
  await page.goto(new URL('rooms/coworking/',base).href,{waitUntil:'networkidle'});
  const access=page.locator('.preview-room-actions a');assert.equal(new URL(await access.getAttribute('href'),page.url()).href,expected);
  await access.click();await page.waitForURL(expected);
  assert.equal(await page.locator('#offerte').count(),1);
 }finally{await context.close()}
});
