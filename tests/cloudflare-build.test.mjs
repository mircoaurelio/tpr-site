import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright';

const execute = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://thepeoplesroom.it';
const canonicalRoutes = [
  '/homepage-tpr/', '/about/', '/contatti/', '/eventi/', '/vivi-tpr/', '/prenota/',
  '/rooms/coworking/', '/rooms/reformer/', '/rooms/wellness/', '/rooms/bar/', '/rooms/media/',
];
const expectedAliases = {
  '/gallery/': '/eventi/#gallery', '/app/': '/#community',
  '/membership/aziende-startup/': '/vivi-tpr/#aziende',
  '/membership/privati-freelancer/': '/vivi-tpr/#offerte',
  '/coworking/': '/rooms/coworking/', '/reformer/': '/rooms/reformer/',
  '/wellness/': '/rooms/wellness/', '/bar/': '/rooms/bar/', '/media/': '/rooms/media/',
  '/homepage/': '/',
};
const sharedFiles = [
  'updated-preview.css', 'figma-refinements.css', 'pdf-assets.css', 'page-layout.css',
  'shared-elevator.css', 'updated-elevator.css', 'home-layout.css', 'shared-little-man.css',
  'updated-preview.js', 'shared-elevator.js', 'updated-elevator.js', 'zigzag-controls.js',
  'updated-carousels.css', 'updated-carousels.js', 'updated-motion.css', 'updated-motion.js',
  'updated-refinements.css', 'updated-refinements.js', 'updated-inquiries.css', 'updated-inquiries.js',
  'updated-characters.css', 'updated-characters.js', 'updated-parallax.css', 'updated-parallax.js',
  'updated-menu.css',
  'updated-card-motion.css', 'updated-card-motion.js',
  'updated-header.css', 'updated-header.js',
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
    'scripts/build_cloudflare.mjs', 'scripts/seo_metadata.mjs', 'scripts/asset_loading.mjs', 'routes.json', 'assets', 'coming-soon',
    'design/updated-content.json', 'design/room-card-faces.json', 'site.webmanifest', ...sharedFiles,
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

  // Catches a generic template head being copied to every production page.
  await t.test('built pages expose unique, relevant search and sharing metadata', async () => {
    const topics = {
      '/homepage-tpr/': /TPR Milano.*The People's Room.*coworking.*Pilates/i, '/about/': /spazio.*Milano/i,
      '/contatti/': /contatti.*Milano/i, '/eventi/': /eventi.*Milano/i,
      '/vivi-tpr/': /offerte.*Milano/i, '/prenota/': /prenota.*Reformer Pilates.*Milano/i,
      '/rooms/coworking/': /coworking.*sale riunioni.*Milano/i,
      '/rooms/reformer/': /Reformer Pilates.*Milano/i,
      '/rooms/wellness/': /benessere.*Milano/i, '/rooms/bar/': /bar.*Milano/i,
      '/rooms/media/': /podcast.*set fotografico.*Milano/i,
    };
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    const descriptions = new Set();
    try {
      for (const route of canonicalRoutes) {
        await page.setContent(await readFile(path.join(build.output, route.slice(1), 'index.html'), 'utf8'));
        const metadata = await page.evaluate(() => ({
          title: document.title,
          descriptions: [...document.querySelectorAll('meta[name="description"]')].map(el => el.content),
          canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(el => el.href),
          og: Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(el => [el.getAttribute('property'), el.content])),
          robots: document.querySelector('meta[name="robots"]')?.content || '',
        }));
        assert.match(metadata.title, topics[route], route);
        assert.equal(metadata.descriptions.length, 1, route);
        assert.ok(!descriptions.has(metadata.descriptions[0]), `duplicate description: ${route}`);
        descriptions.add(metadata.descriptions[0]);
        assert.doesNotMatch(metadata.robots, /noindex/i, route);
        assert.deepEqual(metadata.canonical, [`${origin}${route === '/homepage-tpr/' ? '/' : route}`]);
        assert.equal(metadata.og['og:title'], metadata.title);
        assert.equal(metadata.og['og:description'], metadata.descriptions[0]);
        assert.equal(metadata.og['og:url'], metadata.canonical[0]);
        assert.equal(metadata.og['og:site_name'], "The People's Room");
        const socialImage = new URL(metadata.og['og:image']);
        assert.equal(socialImage.origin, origin);
        assert.ok((await stat(path.join(build.output, socialImage.pathname))).isFile());
      }
    } finally { await browser.close(); }
  });

  // Catches absent JSON-LD and the common mistake of using the legal office as the visiting address.
  await t.test('structured data describes the site and the visible public location without invented claims', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.route('**/*', route => route.abort());
    try {
      await page.setContent(await readFile(path.join(build.output, 'index.html'), 'utf8'));
      const homeSchema = await page.locator('script[type="application/ld+json"]').allTextContents();
      const website = homeSchema.map(text => JSON.parse(text)).find(item => item['@type'] === 'WebSite');
      assert.ok(website, 'Home must declare the site identity');
      assert.equal(website.url, `${origin}/`);
      assert.equal(website.name, "The People's Room");
      assert.equal(website.alternateName, 'TPR');
      const organization = homeSchema.map(text => JSON.parse(text)).find(item => item['@type'] === 'Organization');
      assert.ok(organization, 'Home must connect the brand and abbreviation');
      assert.equal(website.publisher['@id'], organization['@id']);
      assert.equal(organization.alternateName, 'TPR');
      assert.equal(organization.url, `${origin}/`);
      assert.ok((await stat(path.join(build.output, new URL(organization.logo).pathname))).isFile());
      await page.setContent(await readFile(path.join(build.output, 'contatti/index.html'), 'utf8'));
      const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
      const location = schemas.map(text => JSON.parse(text)).find(item => item['@type'] === 'LocalBusiness');
      assert.ok(location, 'Contacts must describe the public business location');
      assert.equal(location['@id'], organization['@id']);
      assert.equal(location.alternateName, 'TPR');
      assert.equal(location.address.streetAddress, 'Via Cola Montano, 36');
      assert.equal(location.address.addressLocality, 'Milano');
      assert.equal(location.address.postalCode, '20159');
      assert.equal(location.address.addressCountry, 'IT');
      assert.equal(location.openingHoursSpecification.opens, '07:00');
      assert.equal(location.openingHoursSpecification.closes, '22:00');
      assert.deepEqual(location.openingHoursSpecification.dayOfWeek, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      assert.ok((await page.locator('main').innerText()).includes(location.address.streetAddress));
      assert.doesNotMatch(JSON.stringify(location), /Olgiati|aggregateRating|review|priceRange|telephone|geo/);
    } finally { await browser.close(); }
  });

  // Exercises Cloudflare's own asset router, rather than implementing a test-only redirect parser.
  await t.test('static asset redirects permanently consolidate aliases and known URL variants', async () => {
    const entry = path.join(build.root, 'asset-test-worker.mjs');
    const config = path.join(build.root, 'asset-test-wrangler.json');
    await writeFile(entry, 'export default { fetch() { return new Response("Unknown route", { status: 404 }); } };');
    await writeFile(config, JSON.stringify({
      name: 'tpr-seo-assets-test', main: entry, compatibility_date: '2026-09-28',
      assets: { directory: build.output, binding: 'ASSETS', run_worker_first: ['/api/*'] },
    }));
    const { unstable_dev } = await import('wrangler');
    const runtime = await unstable_dev(entry, {
      config, local: true, port: 0, inspectorPort: 0, logLevel: 'none',
      experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
    });
    try {
      const cases = { '/index.html': '/' };
      const legacyDestinations = {
        ...expectedAliases, '/app/': '/#community', '/homepage/': '/', '/homepage-tpr/': '/',
      };
      for (const [route, target] of Object.entries(legacyDestinations)) {
        for (const variant of [route, route.slice(0, -1), `${route}index.html`]) cases[variant] = target;
      }
      for (const route of canonicalRoutes.filter(route => route !== '/homepage-tpr/')) {
        cases[route.slice(0, -1)] = route;
        cases[`${route}index.html`] = route;
      }
      for (const [pathname, destination] of Object.entries(cases)) {
        const response = await runtime.fetch(`${origin}${pathname}?utm_source=seo-check`, { redirect: 'manual' });
        assert.equal(response.status, 301, pathname);
        const target = new URL(response.headers.get('location'), origin);
        const wanted = new URL(destination, origin);
        assert.equal(target.pathname, wanted.pathname, pathname);
        assert.equal(target.hash, wanted.hash, pathname);
        assert.equal(target.search, '?utm_source=seo-check', pathname);
      }
      assert.equal((await runtime.fetch(`${origin}/about/`, { redirect: 'manual' })).status, 200);
      assert.equal((await runtime.fetch(`${origin}/not-a-tpr-route/`, { redirect: 'manual' })).status, 404);
    } finally { await runtime.stop(); }
  });

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
    const sourceUrls = references(source).filter(value => !value.startsWith('#')).map(value => {
      const url = new URL(value, `${origin}/homepage-tpr/`);
      if (url.origin === origin && url.pathname === '/homepage-tpr/') url.pathname = '/';
      return url.href;
    });
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
    const roomManifest = JSON.parse(await readFile(path.join(build.output, 'design/room-card-faces.json'), 'utf8'));
    assert.deepEqual(roomManifest, JSON.parse(await readFile(path.join(repository, 'design/room-card-faces.json'), 'utf8')));
    assert.deepEqual(new Set(Object.keys(roomManifest.rooms)), new Set(['coworking', 'reformer', 'wellness', 'bar', 'media']), 'publish all five definitive Room sets together');
    const publicRoomAssets = new Set();
    const visit = value => {
      if (typeof value === 'string' && value.startsWith('assets/')) publicRoomAssets.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(roomManifest);
    for (const filename of publicRoomAssets) assert.ok((await stat(path.join(build.output, filename))).size > 0, `missing runtime Room asset: ${filename}`);
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
      assert.ok((await stat(path.join(build.output, `assets/figma-updated/characters/${key}.svg`))).isFile());
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
    const allowedRootFiles = new Set(['index.html', '_headers', '_redirects', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'coming-soon.css', 'coming-soon.js', ...sharedFiles]);
    const allowedRouteFiles = new Set([...canonicalRoutes, ...Object.keys(expectedAliases)].map(route => `${route.slice(1)}index.html`));
    for (const filename of await filesUnder(build.output)) {
      const allowed = allowedRootFiles.has(filename) || allowedRouteFiles.has(filename)
        || filename === 'design/updated-content.json' || filename === 'design/room-card-faces.json'
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
