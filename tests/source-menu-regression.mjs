import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
const output = path.resolve('.qa/source-menu'), evidence = [];
const browsers = new Map();
before(async () => {
  await mkdir(output, { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, webkit })) browsers.set(name, await engine.launch({ headless: true }));
});
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()));
  await writeFile(path.join(output, 'measurements.json'), JSON.stringify(evidence, null, 2));
});
for (const engine of ['chromium','webkit']) for (const [width,height] of [[1512,952],[375,667],[412,915],[844,390]]) {
  test(`${engine} ${width}x${height}: source Menu has centered navigation, original icons and reachable native controls`, async () => {
    const context = await browsers.get(engine).newContext({ viewport: { width,height }, reducedMotion: 'reduce', hasTouch: width < 901, isMobile: width < 901 });
    await context.route('**/*', route => ['GET','HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(15000);
    try {
      await page.goto(new URL('homepage-tpr/', base).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-menu-open]').click();
      const menu = page.locator('.preview-menu');
      assert.equal(await menu.locator('.preview-menu-world-label').textContent(), 'TPR World', 'retain the actual source grouping');
      assert.equal(await menu.getByRole('link', { name: 'Eventi', exact: true }).count(), 1);
      assert.equal(await menu.getByRole('link', { name: 'Contatti', exact: true }).count(), 1);
      assert.equal(await menu.getByRole('link', { name: 'TPR World', exact: true }).count(), 0, 'do not invent a World page');
      assert.equal(await menu.getByText('Lingua', { exact: true }).count(), 0, 'do not advertise an unconfigured translation');
      assert.equal(await menu.getByRole('link', { name: 'Prenota il Pilates', exact: true }).count(), 0, 'source menu has no extra booking row');
      assert.equal(await menu.locator('[data-menu-icon] img').count(), 5);
      assert.equal(await menu.locator('.tpr-character').count(), 0, 'original Menu icons must remain icons');
      const icons = await menu.locator('[data-menu-icon] img').evaluateAll(images => images.map(image => ({ src: image.currentSrc, loaded: image.naturalWidth > 0, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height })));
      assert.ok(icons.every(icon => icon.loaded && icon.src.includes('/assets/figma-updated/menu/')));
      const data = await menu.evaluate(menu => {
        const about = menu.querySelector('nav > a'), brand = menu.querySelector('.preview-menu-brand');
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, scrollWidth: menu.scrollWidth, clientWidth: menu.clientWidth, background: getComputedStyle(menu).backgroundImage, about: about.getBoundingClientRect().toJSON(), aboutFont: getComputedStyle(about).fontSize, brand: brand.getBoundingClientRect().toJSON(), brandFilter: getComputedStyle(brand.querySelector('img')).filter };
      });
      evidence.push({ engine, ...data, icons });
      assert.ok(data.background.includes('/assets/figma-updated/menu/background.svg'));
      assert.equal(data.brandFilter, 'none', 'the source small logo is blue');
      const brand = menu.locator('.preview-menu-brand');
      const visibleLogo = await brand.screenshot();
      await brand.evaluate(node => { node.style.visibility = 'hidden'; });
      const backgroundOnly = await page.screenshot({ clip: data.brand });
      await brand.evaluate(node => { node.style.removeProperty('visibility'); });
      const logoVisibility = await page.evaluate(async ({ visible, background }) => {
        const decode = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
        const [painted, unpainted, source] = await Promise.all([decode(visible), decode(background), decode(document.querySelector('.preview-menu-brand img').src)]);
        const canvas = document.createElement('canvas'); canvas.width = painted.width; canvas.height = painted.height;
        const ctx = canvas.getContext('2d'), pixels = image => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height); return ctx.getImageData(0,0,canvas.width,canvas.height).data; };
        const a = pixels(painted), b = pixels(unpainted), original = pixels(source);
        let changed = 0, sourceInk = 0;
        for (let i=0;i<a.length;i+=4) {
          if (original[i+3] > 40) sourceInk++;
          if (Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])) > 8) changed++;
        }
        return changed / sourceInk;
      }, { visible: 'data:image/png;base64,'+visibleLogo.toString('base64'), background: 'data:image/png;base64,'+backgroundOnly.toString('base64') });
      assert.ok(logoVisibility > .85, `the complete blue logo must remain visible against the source background: ${logoVisibility}`);
      assert.equal(data.documentWidth, width);
      assert.ok(data.scrollWidth <= data.clientWidth + 1, 'menu must not create horizontal scrolling');
      assert.ok(Math.abs(data.about.x + data.about.width / 2 - width / 2) < 2, 'main navigation stays centered');
      if (width === 1512) {
        assert.equal(data.aboutFont, '80px');
        assert.ok(Math.abs(data.about.y - 165) < 2, 'source content begins30px below PDF chrome');
        assert.equal(data.brand.width, 131); assert.equal(data.brand.height, 64);
        assert.ok(Math.abs(data.brand.x - 80) < 1);
        assert.ok(icons.every(icon => icon.width === 58 && icon.height === 58), 'preserve complete54px source icons and their4px outline');
        const aboutPaint = await menu.locator('nav > a').first().screenshot();
        const inkTop = await page.evaluate(async png => {
          const image = new Image(); image.src = png; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
          const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0); const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
          for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(data[i]>245&&data[i+1]>245&&data[i+2]>245)return y;}
          return -1;
        }, 'data:image/png;base64,'+aboutPaint.toString('base64'));
        // Source PDF white ink begins at217; omit30px chrome and165px line top.
        assert.ok(Math.abs(inkTop - 22) <= 1, `source Menu glyph baseline: expected22px, painted${inkTop}px`);
      } else assert.ok(icons.every(icon => icon.width >= 44 && icon.height >= 44));
      await page.mouse.move(-20,-20);
      await page.screenshot({ path: path.join(output, `${engine}-${width}x${height}.png`) });
      await menu.locator('.preview-menu-hours').scrollIntoViewIfNeeded();
      const hours = await menu.locator('.preview-menu-hours').boundingBox();
      assert.ok(hours.y >= 0 && hours.y + hours.height <= height + 1, 'source opening hours remain reachable');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-hidden'), 'true');
      assert.equal(await page.locator('[data-menu-open]').evaluate(node => document.activeElement === node), true);
    } finally { await context.close(); }
  });
}
