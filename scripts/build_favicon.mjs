// Rasterize the supplied brand character inside a square search-icon canvas.
// The original path geometry is preserved; only its surrounding viewport changes.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=new URL('../',import.meta.url);
const original=await readFile(new URL('assets/tpr-character.svg',root),'utf8');
const box=original.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const [x,y,width,height]=box;
const canvas=600,pixels=192;
if(width>canvas||height>canvas)throw new Error('Review the favicon padding after changing the original character');
const square=[x+(width-canvas)/2,y+(height-canvas)/2,canvas,canvas].join(' ');
const svg=original.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${square}" width="${pixels}" height="${pixels}" preserveAspectRatio="xMidYMid meet"><title>The People's Room</title>`);
const browser=await chromium.launch();
let png;
try{
 const page=await browser.newPage({viewport:{width:pixels,height:pixels},deviceScaleFactor:1});
 await page.setContent(`<html><head><style>html,body{margin:0;padding:0}img{display:block;width:${pixels}px;height:${pixels}px}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
 await page.locator('img').evaluate(image=>image.decode());
 png=await page.screenshot({type:'png',omitBackground:true});
}finally{await browser.close()}
await writeFile(new URL('assets/favicon.svg',root),svg);
await writeFile(new URL('assets/favicon.png',root),png);
console.log(`Built ${pixels}x${pixels}px favicon with the unmodified source paths: ${fileURLToPath(new URL('assets/favicon.png',root))}`);
