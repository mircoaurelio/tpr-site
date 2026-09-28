// Dependency-free Node adapter. The public directory contains no server modules or secrets.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleNewsletter } from './newsletter.mjs';

const publicRoot = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.otf': 'font/otf', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://localhost');
    if (url.pathname === '/api/newsletter') {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of incoming) {
        bytes += chunk.length;
        if (bytes > 4096) { outgoing.writeHead(413); outgoing.end(); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) && body.length ? { body } : {})
      });
      const response = await handleNewsletter(request, process.env, { clientAddress: incoming.socket.remoteAddress });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const file = path.resolve(publicRoot, `.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`);
    if (!file.startsWith(publicRoot + path.sep) || !types[path.extname(file)]) { outgoing.writeHead(404); outgoing.end(); return; }
    const content = await readFile(file);
    outgoing.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    outgoing.end(incoming.method === 'HEAD' ? undefined : content);
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(404);
    outgoing.end();
  }
}).listen(port, host, () => console.log(`TPR server listening on ${host}:${port}`));
