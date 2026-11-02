import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const read=name=>readFile(new URL(name,root));

test('search favicon is a real192px square PNG and preserves the original upright character',async()=>{
 const png=await read('assets/favicon.png');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),192);assert.equal(png.readUInt32BE(20),192);
 const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const bounds=await page.evaluate(async data=>{
   const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=c.height=192;
   const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,192,192).data;
   let left=192,top=192,right=-1,bottom=-1;
   for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(pixels[(y*192+x)*4+3]>128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
   return {left,top,right,bottom,width:right-left+1,height:bottom-top+1};
  },'data:image/png;base64,'+png.toString('base64'));
  assert.ok(Math.abs(bounds.width/bounds.height-310/535)<.035,JSON.stringify(bounds));
  assert.ok(bounds.top>=8&&bounds.bottom<=183,'padding protects the head and feet in round search icons');
  assert.ok(Math.abs((bounds.left+bounds.right)/2-95.5)<3,'the original character is centered horizontally');
 }finally{await browser.close()}
});

test('square favicon vector keeps every supplied character path unchanged',async()=>{
 const original=(await read('assets/tpr-character.svg')).toString(),icon=(await read('assets/favicon.svg')).toString();
 const box=icon.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);assert.equal(box[2],box[3]);
 assert.match(icon,/preserveAspectRatio="xMidYMid meet"/);
 const paths=s=>[...s.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(paths(icon),paths(original),'no redrawing, stretching or replacing the brand character');
 assert.doesNotMatch(icon,/transform=/);
});

test('all public preview documents reference the square raster favicon and use hyphens',async()=>{
 const routes=['homepage-tpr','about','contatti','eventi','vivi-tpr','prenota','rooms/coworking','rooms/reformer','rooms/wellness','rooms/bar','rooms/media'];
 for(const route of routes){
  const html=(await read(route+'/index.html')).toString();
  assert.match(html,/<link rel="icon" href="(?:\.\.\/)+assets\/favicon\.png" type="image\/png" sizes="192x192">/,route);
  assert.doesNotMatch(html,/—/,route);
 }
 const manifest=JSON.parse((await read('site.webmanifest')).toString());
 assert.equal(manifest.icons[0].src,'/tpr-site/assets/favicon.png');
 assert.equal(manifest.icons[0].sizes,'192x192');assert.equal(manifest.icons[0].type,'image/png');
});
