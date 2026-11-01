import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const output = path.resolve('.qa/text-audit-current/standalone-card-copy-regression');
const sourceInk = { coworking: 'rgb(44, 100, 232)', reformer: 'rgb(63, 153, 65)', wellness: 'rgb(63, 153, 65)', bar: 'rgb(235, 100, 43)', media: 'rgb(44, 100, 232)' };
const sourceArt = JSON.parse(await readFile(new URL('../design/room-card-faces.json', import.meta.url), 'utf8')).rooms;
// Independent source literals, transcribed from the authenticated Figma card
// backs (31 October 2026); deliberately not imported from the content builder.
const expected = {
  coworking: [
    ['postazioni', 'Un desk fisso, tutto tuo. Sempre lì che ti aspetta quando hai bisogno di concentrarti; e la community intorno a te, appena alzi la testa.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['Sale riunioni', '4 sale insonorizzate per le call che contano. Le prenoti e nessuno ti disturba.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['eventi', 'La sera ti motiviamo a finire di lavorare a un orario che non ti fa male, così hai voglia di restare per un talk, un aperitivo, due chiacchiere con chi lavora vicino a te.', [['Eventi e Gallery', 'eventi/'], ['Organizza un evento', 'eventi/#organizza']]],
  ],
  reformer: [
    ['studio', 'Una sala ampia e luminosa, pensata per lezioni in piccoli gruppi e per il lavoro individuale.', [['Prenota la tua lezione', 'prenota/']]],
    ['classi', 'Percorsi diversi guidati da istruttori qualificati, ognuno costruito intorno a un obiettivo specifico.', [['Prenota la tua lezione', 'prenota/']]],
    ['attrezzature', 'Macchinari Technogym di ultima generazione, per un allenamento preciso e su misura.', [['Prenota la tua lezione', 'prenota/']]],
  ],
  wellness: [
    ['gym', 'Rack, multipower, panche, manubri e kettlebell in una sala raccolta e curata in ogni dettaglio. Tutto quello che serve per allenarti in libertà.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['contrast therapy', 'Caldo, freddo, caldo. Sauna, cold plunge e poi di nuovo sauna: sembra una tortura, poi non ne fai più a meno.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['longevity', "Un power nap tra una call e l'altra, e i dati del tuo corpo per prenderti cura di te nel lungo periodo.", [['Scopri come accedere', 'vivi-tpr/']]],
  ],
  bar: [
    ['servizi', 'Smoothies e bevande funzionali preparati al momento, pensati per concentrazione, energia e recupero.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['accessibilità', 'Bancone, utensili e microonde sono a disposizione di chi lavora nello spazio, in ogni momento della giornata.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['storage', 'Frigo e dispensa condivisi, per conservare le proprie cose e organizzarsi con calma.', [['Scopri come accedere', 'vivi-tpr/']]],
  ],
  media: [
    ['podcast', 'Una postazione completa per registrare episodi e interviste, con regia e supporto tecnico.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['set fotografico', 'Un ambiente pronto per shooting fotografici e riprese video, a disposizione di chi produce contenuti.', [['Scopri come accedere', 'vivi-tpr/']]],
    ['studio audio', null, []],
  ],
};
const evidence = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { try { await browser?.close(); } finally { await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(evidence, null, 2)); } });

for (const width of [1512, 393, 320]) {
  test(`Standalone Rooms ${width}px expose all 14 source card backs with keyboard close and unclipped copy`, { timeout: 60_000 }, async () => {
    const context = await browser.newContext({ viewport: { width, height: 952 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(5_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      for (const [key, cards] of Object.entries(expected)) {
        await page.goto(new URL(`rooms/${key}/`, base).href, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const panel = page.locator('[data-room-panel]');
        const art = panel.locator('.preview-room-art');
        assert.equal(await art.evaluate(image => image.src), new URL(sourceArt[key].artwork, base).href, `${key} intro must use its own definitive source artwork`);
        assert.equal(await art.evaluate(image => image.complete && image.naturalWidth === 3024 && image.naturalHeight === 1904), true, `${key} source stage must load completely`);
        assert.equal(await art.getAttribute('data-pending-figma-image'), null);
        await page.locator('[data-room-explore]').click();
        assert.equal(await page.locator('.preview-room-card').count(), cards.length);
        assert.equal(await page.locator('[data-room-card-open]').count(), cards.filter(([, description]) => description).length, `${key} must expose source card backs through native front buttons`);
        for (const [index, [title, description, ctas]] of cards.entries()) {
          const card = page.locator('.preview-room-card').nth(index);
          assert.equal((await card.locator('.preview-room-card-label h3').textContent()).trim(), title);
          assert.equal(await card.locator('.preview-room-card-label h3').evaluate(element => getComputedStyle(element).color), sourceInk[key], `${key}/${title} front ink must match the source card color`);
          assert.equal((await card.locator('.preview-room-card-label small').allTextContents()).join(''), ['longevity', 'studio audio'].includes(title) ? 'coming soon' : '');
          if (!description) {
            assert.equal(await card.locator('button,a,.preview-room-card-back').count(), 0, 'Unsourced studio audio remains noninteractive');
            continue;
          }
          const open = card.locator('[data-room-card-open]'), back = card.locator('.preview-room-card-back'), close = back.locator('[data-room-card-close]');
          const front = card.locator('.preview-room-card-front');
          assert.equal(await open.getAttribute('aria-expanded'), 'false');
          assert.equal(await back.getAttribute('aria-hidden'), 'true');
          assert.equal(await back.evaluate(element => element.inert), true);
          await open.focus(); await page.keyboard.press('Enter');
          assert.equal(await open.getAttribute('aria-expanded'), 'true');
          assert.equal(await open.getAttribute('aria-controls'), await back.getAttribute('id'));
          assert.equal(await back.getAttribute('aria-hidden'), 'false');
          assert.equal(await back.evaluate(element => element.inert), false);
          assert.equal(await front.getAttribute('aria-hidden'), 'true');
          assert.equal(await front.evaluate(element => element.inert), true);
          assert.equal(await close.evaluate(element => element === document.activeElement), true);
          assert.equal((await back.locator('h3').textContent()).trim(), title);
          assert.equal((await back.locator('p').textContent()).trim(), description);
          assert.deepEqual(await back.locator('a').allTextContents(), ctas.map(([label]) => label));
          assert.deepEqual(await back.locator('a').evaluateAll(links => links.map(link => link.href)), ctas.map(([, route]) => new URL(route, base).href));
          assert.equal(await card.locator('button button,button a,a button,a a').count(), 0);
          await page.keyboard.press('Tab');
          assert.equal(await back.locator('a').first().evaluate(element => element === document.activeElement), true, 'Hidden front must not be tabbable');
          const geometry = await back.evaluate(element => {
            const box = element.getBoundingClientRect(), card = element.closest('article').getBoundingClientRect();
            const text = [...element.querySelectorAll('h3,p,a,button')].map(node => {
              const range = document.createRange(); range.selectNodeContents(node);
              const bounds = range.getBoundingClientRect();
              const style = getComputedStyle(node);
              const clipsOwnText = style.overflowY !== 'visible' && node.scrollHeight > node.clientHeight + 1;
              return { text: node.textContent, box: bounds.toJSON(), fontSize: style.fontSize, color: style.color, clipped: bounds.left < box.left - 1 || bounds.right > box.right + 1 || bounds.top < box.top - 1 || bounds.bottom > box.bottom + 1 || clipsOwnText };
            });
            const heading = element.querySelector('h3').getBoundingClientRect(), close = element.querySelector('button').getBoundingClientRect();
            return { card: card.toJSON(), back: box.toJSON(), text, overlapsClose: heading.right > close.left && close.right > heading.left && heading.bottom > close.top && close.bottom > heading.top };
          });
          evidence.push({ width, key, title, geometry });
          assert.equal(geometry.card.width, width > 900 ? 560 : Math.min(320, width - 48));
          assert.equal(geometry.card.height, width > 900 ? 434 : 390);
          assert.equal(geometry.overlapsClose, false, `${key}/${title} heading overlaps close`);
          assert.equal(geometry.text.every(node => node.color === sourceInk[key]), true, `${key}/${title} back ink must match the source card color`);
          assert.deepEqual(geometry.text.filter(node => node.clipped).map(node => node.text), [], `${key}/${title} source copy must fit`);
          assert.equal(geometry.text[0].fontSize, width > 900 ? '48px' : '32px');
          assert.equal(geometry.text[2].fontSize, width > 900 ? '24px' : '18px');
          await page.keyboard.press('Escape');
          assert.equal(await open.getAttribute('aria-expanded'), 'false');
          assert.equal(await back.evaluate(element => element.inert), true);
          assert.equal(await open.evaluate(element => element === document.activeElement), true);
          assert.equal(await panel.evaluate(element => element.classList.contains('is-exploring')), true, 'First Escape must keep exploration open');
          await page.keyboard.press('Tab');
          assert.equal(await back.evaluate(element => element.contains(document.activeElement)), false, 'Closed back must not receive Tab focus');
          // Also exercise a pointer activation and the visible close control.
          await open.click(); await close.click();
          assert.equal(await open.evaluate(element => element === document.activeElement), true);
        }
        const lastOpen = page.locator('[data-room-card-open]').last();
        await lastOpen.focus(); await page.keyboard.press('Escape');
        assert.equal(await panel.evaluate(element => element.classList.contains('is-exploring')), false, 'Second Escape may leave exploration');
        assert.equal(await page.locator('[data-room-explore]').evaluate(element => element === document.activeElement), true);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
