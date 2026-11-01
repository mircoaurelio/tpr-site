import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const execute = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://thepeoplesroom.it';
const canonicalRoutes = [
  '/homepage-tpr/', '/about/', '/contatti/', '/eventi/', '/vivi-tpr/', '/prenota/',
  '/rooms/coworking/', '/rooms/reformer/', '/rooms/wellness/', '/rooms/bar/', '/rooms/media/',
];
const expectedAliases = {
  '/gallery/': '/eventi/#gallery', '/app/': '/homepage-tpr/#community',
  '/membership/aziende-startup/': '/vivi-tpr/#aziende',
  '/membership/privati-freelancer/': '/vivi-tpr/#offerte',
  '/coworking/': '/rooms/coworking/', '/reformer/': '/rooms/reformer/',
  '/wellness/': '/rooms/wellness/', '/bar/': '/rooms/bar/', '/media/': '/rooms/media/',
  '/homepage/': '/homepage-tpr/',
};
const sharedFiles = [
  'updated-preview.css', 'figma-refinements.css', 'pdf-assets.css', 'page-layout.css',
  'shared-elevator.css', 'updated-elevator.css', 'home-layout.css', 'shared-little-man.css',
  'updated-preview.js', 'shared-elevator.js', 'updated-elevator.js', 'zigzag-controls.js',
];
const references = html => [...html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/g)].map(match => match[2]);

async function filesUnder(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tpr-cloudflare-build-'));
  t.after(async () => {
    // Delete only the exact temporary fixture created above, never a computed repository path.
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('tpr-cloudflare-build-'));
    await rm(root, { recursive: true, force: true });
  });
  const inputs = [
    'scripts/build_cloudflare.mjs', 'routes.json', 'assets', 'coming-soon',
    'design/updated-content.json', 'site.webmanifest', ...sharedFiles,
    ...canonicalRoutes.map(route => `${route.slice(1)}index.html`),
  ];
  for (const input of inputs) {
    const target = path.join(root, input);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(repository, input), target, { recursive: true });
  }
  // These sentinels catch a broad checkout copy, a broad design copy, or asset-folder leakage.
  for (const input of [
    '.env', '.git/credentials', '.qa/private.png', 'server/config.php', 'config/secrets.json',
    'design/source.pdf', 'design/private.json', 'assets/_inspect/private.png',
    'assets/.private/secret.svg', 'assets/credentials.json', 'unreferenced-secret.js',
  ]) {
    await mkdir(path.dirname(path.join(root, input)), { recursive: true });
    await writeFile(path.join(root, input), 'PRIVATE_BUILD_SENTINEL');
  }
  return {
    root,
    output: path.join(root, 'dist-cloudflare'),
    build: (environment = {}) => execute(process.execPath, ['scripts/build_cloudflare.mjs'], {
      cwd: root,
      env: { ...process.env, NEWSLETTER_ENABLED: 'false', PRIVACY_POLICY_URL: '', ...environment },
    }),
  };
}

// Catches the former coming-soon-only build and missing dependencies without using a mock filesystem.
test('Cloudflare build packages the complete public site from the real project', async t => {
  const build = await fixture(t);
  await build.build();

  await t.test('serves all eleven canonical pages and the current Home at the domain root', async () => {
    const home = await readFile(path.join(build.output, 'index.html'), 'utf8');
    assert.match(home, /preview-page--home/);
    assert.doesNotMatch(home, /http-equiv=["']refresh/);
    for (const route of canonicalRoutes) {
      const html = await readFile(path.join(build.output, route.slice(1), 'index.html'), 'utf8');
      assert.match(html, /<main\b/, route);
    }
    // Document-relative skip links stay on their current copy of Home; other URLs retain their destinations.
    const source = await readFile(path.join(repository, 'homepage-tpr/index.html'), 'utf8');
    const sourceUrls = references(source).filter(value => !value.startsWith('#')).map(value => new URL(value, `${origin}/homepage-tpr/`).href);
    const rootUrls = references(home).filter(value => !value.startsWith('#') && value !== `${origin}/`).map(value => new URL(value, `${origin}/`).href);
    assert.deepEqual(rootUrls, sourceUrls);
  });

  await t.test('includes shared scripts, imported styles, runtime content, and each local page dependency', async () => {
    for (const filename of sharedFiles) {
      assert.equal(await readFile(path.join(build.output, filename), 'utf8'), await readFile(path.join(repository, filename), 'utf8'), filename);
    }
    assert.deepEqual(
      JSON.parse(await readFile(path.join(build.output, 'design/updated-content.json'), 'utf8')),
      JSON.parse(await readFile(path.join(repository, 'design/updated-content.json'), 'utf8')),
    );
    for (const filename of await filesUnder(build.output)) {
      if (!/\.(html|css)$/.test(filename)) continue;
      const text = await readFile(path.join(build.output, filename), 'utf8');
      const values = filename.endsWith('.html') ? references(text)
        : [...text.matchAll(/url\(\s*["']?([^"')]*?)["']?\s*\)/g)].map(match => match[1]);
      const pathname = `/${filename.replace(/index\.html$/, '')}`;
      for (const value of values) {
        if (!value || value.startsWith('#')) continue;
        const url = new URL(value.replaceAll('&amp;', '&'), `${origin}${pathname}`);
        if (url.origin !== origin || url.pathname.startsWith('/api/')) continue;
        const target = path.join(build.output, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
        assert.ok((await stat(target)).isFile(), `${filename}: ${value}`);
      }
    }
    for (const key of ['coworking', 'reformer', 'wellness', 'bar', 'media']) {
      assert.ok((await stat(path.join(build.output, `assets/little-man/${key}.svg`))).isFile());
    }
    assert.match(await readFile(path.join(build.output, 'coming-soon.css'), 'utf8'), /url\(['"]?\/assets\//);
    assert.ok((await stat(path.join(build.output, 'coming-soon.js'))).isFile());
  });

  await t.test('publishes only intentional aliases and production discovery metadata', async () => {
    for (const [route, target] of Object.entries(expectedAliases)) {
      const html = await readFile(path.join(build.output, route.slice(1), 'index.html'), 'utf8');
      assert.match(html, /http-equiv="refresh"/);
      assert.ok(html.includes(`href="${target}"`), route);
      assert.doesNotMatch(html, /github\.io/);
    }
    const sitemap = await readFile(path.join(build.output, 'sitemap.xml'), 'utf8');
    for (const route of ['/', ...canonicalRoutes.filter(route => route !== '/homepage-tpr/')]) {
      assert.ok(sitemap.includes(`<loc>${origin}${route}</loc>`), route);
    }
    assert.doesNotMatch(sitemap, /github\.io|coming-soon|2026-08-19/);
    assert.match(await readFile(path.join(build.output, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/thepeoplesroom\.it\/sitemap\.xml/);
    const manifest = JSON.parse(await readFile(path.join(build.output, 'site.webmanifest'), 'utf8'));
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.icons[0].src, '/assets/tpr-logo.svg');
    const allowedRootFiles = new Set(['index.html', '_headers', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'coming-soon.css', 'coming-soon.js', ...sharedFiles]);
    const allowedRouteFiles = new Set([...canonicalRoutes, ...Object.keys(expectedAliases)].map(route => `${route.slice(1)}index.html`));
    for (const filename of await filesUnder(build.output)) {
      const allowed = allowedRootFiles.has(filename) || allowedRouteFiles.has(filename)
        || filename === 'design/updated-content.json'
        || (filename.startsWith('assets/') && !filename.split('/').some(part => part.startsWith('.') || part === '_inspect') && /\.(?:svg|otf|ttf|woff2?|png|webp|jpe?g|ico)$/i.test(filename));
      assert.ok(allowed, `Unexpected public file: ${filename}`);
      assert.ok((await stat(path.join(build.output, filename))).size <= 25 * 1024 * 1024, filename);
    }
  });

  await t.test('keeps signups disabled unless the existing enable switch and approved HTTPS notice are provided', async () => {
    for (const filename of ['index.html', 'homepage-tpr/index.html', 'vivi-tpr/index.html']) {
      const disabled = await readFile(path.join(build.output, filename), 'utf8');
      assert.match(disabled, /<form\b[^>]*\binert\b[^>]*data-endpoint=""/);
    }
    const privacy = 'https://www.iubenda.com/privacy-policy/70616678';
    await build.build({ NEWSLETTER_ENABLED: 'true', PRIVACY_POLICY_URL: privacy });
    for (const filename of ['index.html', 'homepage-tpr/index.html', 'vivi-tpr/index.html']) {
      const enabled = await readFile(path.join(build.output, filename), 'utf8');
      assert.match(enabled, /<form\b[^>]*data-newsletter-form[^>]*data-endpoint="\/api\/newsletter"/);
      assert.doesNotMatch(enabled, /<form\b[^>]*\binert\b/);
      assert.ok(enabled.includes(`href="${privacy}"`));
    }
    await assert.rejects(build.build({ NEWSLETTER_ENABLED: 'true', PRIVACY_POLICY_URL: 'http://example.com/privacy' }), /approved HTTPS privacy notice/);
  });

  await t.test('rejects an oversized public asset before replacing the previous valid build', async () => {
    const previousHome = await readFile(path.join(build.output, 'index.html'), 'utf8');
    const oversized = path.join(build.root, 'assets/oversized.png');
    await writeFile(oversized, '');
    await truncate(oversized, 25 * 1024 * 1024 + 1);
    await assert.rejects(build.build(), /25 MiB.*oversized\.png|oversized\.png.*25 MiB/);
    assert.equal(await readFile(path.join(build.output, 'index.html'), 'utf8'), previousHome);
  });
});
