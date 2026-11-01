import { readFile, writeFile, mkdir, copyFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'dist-cloudflare');
if (path.dirname(output) !== root || path.basename(output) !== 'dist-cloudflare') throw new Error('Invalid build directory');
const origin = 'https://thepeoplesroom.it';
const maxAssetBytes = 25 * 1024 * 1024;
const publicAssetExtension = /\.(svg|otf|ttf|woff2?|png|webp|jpe?g|ico)$/i;
const enabled = process.env.NEWSLETTER_ENABLED === 'true';
const privacyUrl = process.env.PRIVACY_POLICY_URL || '';
if (enabled) {
  let approved = false;
  try { approved = new URL(privacyUrl).protocol === 'https:'; } catch { /* An unset or malformed notice is not approved. */ }
  if (!approved) throw new Error('Set PRIVACY_POLICY_URL to the approved HTTPS privacy notice before enabling signups.');
}

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const routeFile = route => {
  if (!/^\/(?:[a-z0-9-]+\/)+$/.test(route)) throw new Error(`Invalid public route: ${route}`);
  return `${route.slice(1)}index.html`;
};
const routes = JSON.parse(await readFile(path.join(root, 'routes.json'), 'utf8'));
if (!routes.pages.some(page => page.path === routes.canonical_home)) throw new Error('Canonical Home is missing from routes.json');
const files = new Map();
const dependencies = new Set();

function discoverSharedFiles(content, pathname) {
  const references = [
    ...content.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/g),
    ...content.matchAll(/url\(\s*(["']?)([^"')]*?)\1\s*\)/g),
  ];
  for (const match of references) {
    const url = new URL(match[2], `${origin}${pathname}`);
    if (url.origin !== origin || !/\.(css|js)$/.test(url.pathname)) continue;
    // Only referenced public files at the root are shared runtime code.
    if (!/^\/[a-z0-9-]+\.(css|js)$/.test(url.pathname)) throw new Error(`Invalid shared dependency: ${url.pathname}`);
    dependencies.add(url.pathname.slice(1));
  }
}

function configureNewsletter(html) {
  return html.replace(/<form\b[^>]*\bdata-newsletter-form\b[^>]*>[\s\S]*?<\/form>/g, form => {
    form = form.replace(/data-endpoint="[^"]*"/, `data-endpoint="${enabled ? '/api/newsletter' : ''}"`);
    if (enabled) {
      return form.replace(/<a\b([^>]*?)href="[^"]*"([^>]*?)>Privacy Policy<\/a>/g,
        `<a$1href="${escapeHtml(privacyUrl)}"$2>Privacy Policy</a>`);
    }
    // The shared script remains unchanged; inert prevents an unavailable form from being submitted.
    return form.replace('<form ', '<form inert ').replace(/(<p\b[^>]*\brole="status"[^>]*>)[\s\S]*?(<\/p>)/,
      '$1Le iscrizioni apriranno a breve.$2');
  });
}

for (const page of routes.pages) {
  const filename = routeFile(page.path);
  if (files.has(filename)) throw new Error(`Duplicate public route: ${page.path}`);
  let html = configureNewsletter(await readFile(path.join(root, filename), 'utf8'));
  const canonical = page.path === routes.canonical_home ? '/' : page.path;
  html = html.replace('</head>', `<link rel="canonical" href="${origin}${canonical}">\n</head>`);
  discoverSharedFiles(html, page.path);
  files.set(filename, html);
}

// Serve the current Home directly at / while retaining the canonical route.
const home = files.get(routeFile(routes.canonical_home));
files.set('index.html', home.replace(/\b(href|src)=(['"])\.\.\//g, '$1=$2/'));

// Existing aliases remain useful to bookmarks without publishing legacy page implementations.
const aliases = { ...routes.aliases };
for (const page of routes.pages) {
  if (page.path.startsWith('/rooms/')) aliases[page.path.replace('/rooms/', '/')] = page.path;
}
for (const variant of routes.variants || []) aliases[variant.path] = routes.canonical_home;
for (const [route, target] of Object.entries(aliases)) {
  const filename = routeFile(route);
  if (files.has(filename) || !target.startsWith('/') || target.startsWith('//')) throw new Error(`Invalid public alias: ${route}`);
  const destination = new URL(target, origin);
  if (!files.has(routeFile(destination.pathname))) throw new Error(`Missing alias destination: ${target}`);
  files.set(filename, `<!doctype html>\n<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${origin}${destination.pathname}"><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}"><title>The People's Room</title><script>location.replace(${JSON.stringify(target)});</script></head><body><a href="${escapeHtml(target)}">Continua verso The People's Room</a></body></html>\n`);
}

// Follow CSS imports as well as the scripts/styles referenced by the generated pages.
for (const filename of dependencies) {
  const content = await readFile(path.join(root, filename), 'utf8');
  files.set(filename, content);
  if (filename.endsWith('.css')) discoverSharedFiles(content, `/${filename}`);
}
files.set('design/updated-content.json', await readFile(path.join(root, 'design/updated-content.json'), 'utf8'));

// Keep these old asset URLs working for clients that already loaded the former landing page.
for (const filename of ['coming-soon.css', 'coming-soon.js']) {
  let content = (await readFile(path.join(root, 'coming-soon', filename), 'utf8')).replaceAll('../assets/', '/assets/');
  if (filename === 'coming-soon.js' && enabled) {
    content = content.replace('Questa pagina di anteprima non imposta cookie di profilazione e non usa strumenti di analisi. L’informativa completa sarà disponibile con il sito definitivo.', 'Questa pagina non usa strumenti di analisi né imposta cookie di profilazione.');
  }
  files.set(filename, content);
}

const manifest = JSON.parse(await readFile(path.join(root, 'site.webmanifest'), 'utf8'));
manifest.start_url = '/';
manifest.scope = '/';
manifest.icons = manifest.icons.map(icon => ({ ...icon, src: icon.src.replace(/^\/tpr-site\//, '/') }));
files.set('site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.pages.map(page => `  <url><loc>${origin}${page.path === routes.canonical_home ? '/' : page.path}</loc></url>`).join('\n')}\n</urlset>\n`);
files.set('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
files.set('_headers', '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');

// Public images/fonts are the only recursively copied inputs. Hidden folders, inspection
// artifacts, font readmes, source documents, code, configuration, and symlinks stay out.
const assets = [];
async function collectAssets(directory = 'assets') {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_inspect') continue;
    const filename = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await collectAssets(filename);
    else if (entry.isFile() && publicAssetExtension.test(filename)) {
      const { size } = await stat(path.join(root, filename));
      if (size > maxAssetBytes) throw new Error(`Public asset exceeds 25 MiB: ${filename}`);
      assets.push({ filename, size });
    }
  }
}
await collectAssets();
// Validate every input before replacing the previous artifact.
for (const [filename, content] of files) {
  if (Buffer.byteLength(content) > maxAssetBytes) throw new Error(`Public file exceeds 25 MiB: ${filename}`);
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [filename, content] of files) {
  const target = path.join(output, filename);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}
for (const { filename } of assets) {
  const target = path.join(output, filename);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, filename), target);
}
const bytes = assets.reduce((sum, asset) => sum + asset.size, 0) + [...files.values()].reduce((sum, content) => sum + Buffer.byteLength(content), 0);
console.log(`Cloudflare build: ${routes.pages.length} pages + root Home, ${Object.keys(aliases).length} aliases, ${assets.length} public assets, ${files.size + assets.length} files (${bytes} bytes), newsletter ${enabled ? 'enabled' : 'disabled'}.`);
