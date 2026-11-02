import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, webkit } from 'playwright';

const base = (process.env.TPR_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const browsers = new Map();
before(async () => {
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => Promise.all([...browsers.values()].map(browser => browser.close())));

async function pageAt(engine, width) {
  const page = await browsers.get(engine).newPage({ viewport: { width, height: 952 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(7000);
  // The site's contract is the supplied widget configuration and navigation.
  // Live provider rendering is verified separately, without making bookings.
  await page.route('**/*', route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
    if (new URL(request.url()).origin !== new URL(base).origin) return route.fulfill({ status: 200, body: '' });
    return route.continue();
  });
  return page;
}

for (const engine of ['chromium', 'webkit']) {
  // Catches the empty provider panel, wrong widget/account, and loader leaks to
  // unrelated pages. Expected public values come from the supplied embed code.
  test(`${engine}: Pilates schedule is mounted once on the booking page only`, async () => {
    const page = await pageAt(engine, 393);
    try {
      await page.goto(new URL('prenota/', base).href);
      const widget = page.locator('.preview-booking-panel .mindbody-widget');
      assert.equal(await widget.count(), 1, 'booking page must contain the supplied schedule');
      assert.equal(await widget.getAttribute('data-widget-type'), 'Schedules');
      assert.equal(await widget.getAttribute('data-widget-id'), '4581434fffc');
      const loader = page.locator('script[src="https://brandedweb.mindbodyonline.com/embed/widget.js"]');
      assert.equal(await loader.count(), 1, 'one provider loader initializes the schedule');
      assert.equal(await loader.evaluate(element => element.async), true);
      for (const route of ['homepage-tpr/', 'rooms/reformer/', 'vivi-tpr/']) {
        await page.goto(new URL(route, base).href);
        assert.equal(await page.locator('script[src*="brandedweb.mindbodyonline.com"]').count(), 0, `${route} loads the provider only after navigation to booking`);
      }
    } finally { await page.close(); }
  });

  // Catches Home's Move CTA falling back to the generic contact enquiry,
  // including after its room selection changes on desktop and on mobile.
  test(`${engine}: every Move Prenota action opens the Pilates schedule`, { timeout: 60_000 }, async () => {
    const failures = [];
    for (const width of [320, 393, 1512, 1920]) {
      const page = await pageAt(engine, width);
      try {
        await page.goto(new URL('homepage-tpr/#reformer', base).href);
        await page.waitForFunction(() => document.querySelector('#rooms')?.dataset.activeRoom === 'reformer');
        const book = page.locator('[data-elevator-book]:visible');
        assert.equal(await book.count(), 1);
        await book.click();
        await page.waitForLoadState('domcontentloaded');
        if (new URL(page.url()).pathname !== new URL('prenota/', base).pathname) failures.push({ width, source: 'Home Move', url: page.url() });

        await page.goto(new URL('rooms/reformer/', base).href);
        await page.getByRole('link', { name: 'Prenota', exact: true }).click();
        await page.waitForLoadState('domcontentloaded');
        if (new URL(page.url()).pathname !== new URL('prenota/', base).pathname) failures.push({ width, source: 'Move standalone', url: page.url() });
      } finally { await page.close(); }
    }
    assert.deepEqual(failures, [], 'all Move booking actions must reach the embedded Pilates schedule');
  });

  // The real provider uses iframe-resizer and reported a 694px mobile frame.
  // Exercise the parent layout with that height and a later taller schedule;
  // a fixed 500/568px masked panel must not crop either provider state.
  test(`${engine}: booking paper grows with the provider frame without horizontal overflow`, async () => {
    for (const width of [320, 393, 1512, 1920]) {
      const page = await pageAt(engine, width);
      try {
        await page.goto(new URL('prenota/', base).href);
        for (const height of [694, 1050]) {
          await page.locator('.preview-booking-panel').evaluate((panel, height) => {
            let frame = panel.querySelector('iframe');
            if (!frame) { frame = document.createElement('iframe'); panel.append(frame); }
            frame.style.height = `${height}px`;
          }, height);
          const bounds = await page.locator('.preview-booking-panel').evaluate(panel => ({
            panel: panel.getBoundingClientRect().toJSON(), frame: panel.querySelector('iframe').getBoundingClientRect().toJSON(),
            documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
          }));
          assert.ok(bounds.frame.bottom <= bounds.panel.bottom - 8, `${width}px: ${height}px provider content must fit above the paper edge: ${JSON.stringify(bounds)}`);
          assert.ok(bounds.frame.left >= bounds.panel.left + 8 && bounds.frame.right <= bounds.panel.right - 8, 'provider controls must clear the rough paper edge');
          assert.equal(bounds.documentWidth, bounds.viewport, 'provider frame must not widen the page');
        }
      } finally { await page.close(); }
    }
  });
}
