import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-cloudflare');
if (path.dirname(output) !== root || path.basename(output) !== 'dist-cloudflare') throw new Error('Invalid build directory');
// The endpoint stays disabled until the actual collection notice is available.
const enabled = process.env.NEWSLETTER_ENABLED === 'true';
const privacyUrl = process.env.PRIVACY_POLICY_URL || '';
if (enabled && !privacyUrl.startsWith('https://')) throw new Error('Set PRIVACY_POLICY_URL to the approved HTTPS privacy notice before enabling signups.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const assets = new Set();
for (const name of ['index.html', 'coming-soon.css', 'coming-soon.js']) {
  let content = await readFile(path.join(root, 'coming-soon', name), 'utf8');
  content = content.replaceAll('../assets/', '/assets/');
  if (name === 'index.html') {
    content = content.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">\n    <link rel="canonical" href="https://thepeoplesroom.it/">');
    if (enabled) {
      content = content.replace('data-endpoint=""', 'data-endpoint="/api/newsletter"');
      const safeUrl = privacyUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      content = content.replaceAll(/<button([^>]*?) type="button" data-info="privacy">Privacy Policy<\/button>/g, `<a$1 href="${safeUrl}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>`);
      content = content.replace('Le iscrizioni apriranno a breve.', 'Per iscriverti attiva JavaScript.');
    }
  }
  if (name === 'coming-soon.js' && enabled) {
    content = content.replace('Questa pagina di anteprima non imposta cookie di profilazione e non usa strumenti di analisi. L’informativa completa sarà disponibile con il sito definitivo.', 'Questa pagina non usa strumenti di analisi né imposta cookie di profilazione.');
  }
  for (const match of content.matchAll(/assets\/([^"'()\s?`]+)/g)) {
    const relative = match[1];
    if (relative.includes('..') || !/\.(svg|otf|ttf|woff2?|png|webp|jpe?g)$/.test(relative)) throw new Error(`Invalid asset: ${relative}`);
    assets.add(relative);
  }
  await writeFile(path.join(output, name), content);
}
for (const asset of assets) {
  const target = path.join(output, 'assets', asset);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, 'assets', asset), target);
}
await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /api/\n');
await writeFile(path.join(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log(`Cloudflare build: ${assets.size} assets, newsletter ${enabled ? 'enabled' : 'disabled'}, no server files or credentials in public output.`);
