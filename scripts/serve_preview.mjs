import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Async static server for browser QA, without per-request terminal output.
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4174);
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.otf':'font/otf','.ttf':'font/ttf','.woff2':'font/woff2' };
createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) return res.writeHead(405).end();
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (file !== path.resolve(root) && !file.startsWith(path.resolve(root)+path.sep)) return res.writeHead(404).end();
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404).end(); }
}).listen(port,'127.0.0.1',()=>console.log(`Preview on http://127.0.0.1:${port}/homepage-tpr/`));
