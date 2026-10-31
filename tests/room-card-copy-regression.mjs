import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.qa/text-audit-current/card-copy-regression');
const phase = (process.env.TPR_QA_PHASE || 'current').replace(/[^a-z0-9_-]/gi, '-');
const base = new URL(process.env.TPR_BASE_URL || 'http://127.0.0.1:4175/');
base.pathname = base.pathname.replace(/\/$/, '') + '/'; base.search = ''; base.hash = '';
// Independent literals transcribed from authenticated Figma Card Back frames;
// provenance is recorded in .qa/text-audit-current/live-figma-card-source.json.
// Expectations deliberately do not import design/updated-content.json.
const expected = {
  coworking: [
    ['postazioni', 'Un desk fisso, tutto tuo. Sempre lì che ti aspetta quando hai bisogno di concentrarti; e la community intorno a te, appena alzi la testa.', ['Scopri come accedere']],
    ['Sale riunioni', '4 sale insonorizzate per le call che contano. Le prenoti e nessuno ti disturba.', ['Scopri come accedere']],
    ['eventi', 'La sera ti motiviamo a finire di lavorare a un orario che non ti fa male, così hai voglia di restare per un talk, un aperitivo, due chiacchiere con chi lavora vicino a te.', ['Eventi e Gallery', 'Organizza un evento']],
  ],
  reformer: [
    ['studio', 'Una sala ampia e luminosa, pensata per lezioni in piccoli gruppi e per il lavoro individuale.', ['Prenota la tua lezione']],
    ['classi', 'Percorsi diversi guidati da istruttori qualificati, ognuno costruito intorno a un obiettivo specifico.', ['Prenota la tua lezione']],
    ['attrezzature', 'Macchinari Technogym di ultima generazione, per un allenamento preciso e su misura.', ['Prenota la tua lezione']],
  ],
  wellness: [
    ['gym', 'Rack, multipower, panche, manubri e kettlebell in una sala raccolta e curata in ogni dettaglio. Tutto quello che serve per allenarti in libertà.', ['Scopri come accedere']],
    ['contrast therapy', 'Caldo, freddo, caldo. Sauna, cold plunge e poi di nuovo sauna: sembra una tortura, poi non ne fai più a meno.', ['Scopri come accedere']],
    ['longevity', "Un power nap tra una call e l'altra, e i dati del tuo corpo per prenderti cura di te nel lungo periodo.", ['Scopri come accedere']],
  ],
  bar: [
    ['servizi', 'Smoothies e bevande funzionali preparati al momento, pensati per concentrazione, energia e recupero.', ['Scopri come accedere']],
    ['accessibilità', 'Bancone, utensili e microonde sono a disposizione di chi lavora nello spazio, in ogni momento della giornata.', ['Scopri come accedere']],
    ['storage', 'Frigo e dispensa condivisi, per conservare le proprie cose e organizzarsi con calma.', ['Scopri come accedere']],
  ],
  media: [
    ['podcast', 'Una postazione completa per registrare episodi e interviste, con regia e supporto tecnico.', ['Scopri come accedere']],
    ['set fotografico', 'Un ambiente pronto per shooting fotografici e riprese video, a disposizione di chi produce contenuti.', ['Scopri come accedere']],
    ['studio audio', 'coming soon', []],
  ],
};
const roomTitles = { coworking: 'TPR COWORKING', reformer: 'TPR MOVE', wellness: 'TPR RECHARGE', bar: 'TPR FUEL', media: 'TPR MEDIA' };
const normalize = value => value.trim().replace(/\s+/g, ' ');
const evidence = [];
let browser;
before(async () => { await mkdir(output, { recursive: true }); browser = await chromium.launch({ headless: true }); });
after(async () => { try { await browser?.close(); } finally { await writeFile(path.join(output, `measurements-${phase}.json`), JSON.stringify(evidence, null, 2)); } });

async function pageAt(width, route = 'homepage-tpr/') {
  const context = await browser.newContext({ viewport: { width, height: width <= 720 ? 852 : 952 }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: width <= 720, hasTouch: width <= 720 });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) && new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(5_000); page.setDefaultNavigationTimeout(12_000);
  try {
    await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })); });
    return { context, page };
  } catch (error) { await context.close(); throw error; }
}

async function openRoom(page, width, key) {
  await page.locator(`[data-elevator-room="${key}"]`).click();
  await page.waitForFunction(key => document.querySelector('#rooms').dataset.activeRoom === key && !document.querySelector('#rooms').classList.contains('is-lifting'), key);
  const copy = '.tpr-elevator__car--current:not(.tpr-elevator__car--shade)';
  await page.locator(copy + (width <= 720 ? ' .tpr-elevator__mobile-cta' : ' .tpr-elevator__desktop-copy [data-elevator-explore]')).click();
  await page.waitForFunction(mobile => document.querySelector('#rooms').classList.contains(mobile ? 'is-mobile-expanded' : 'is-explore-ready'), width <= 720);
}

async function backData(card, mobile) {
  return card.evaluate((element, mobile) => {
    const back = element.querySelector(mobile ? '.tpr-elevator__mobile-card-back' : '.tpr-elevator__card-back');
    const copy = back.querySelector(':scope > span:not(.tpr-elevator__card-close):not(.tpr-elevator__card-cta)');
    const range = document.createRange(); range.selectNodeContents(copy);
    const copyBox = copy.getBoundingClientRect(), textBox = range.getBoundingClientRect(), box = back.getBoundingClientRect();
    return {
      heading: back.querySelector('strong').textContent, description: copy.textContent,
      ctaLabels: [...back.querySelectorAll('.tpr-elevator__card-cta > span')].map(span => span.textContent),
      ctaText: back.querySelector('.tpr-elevator__card-cta')?.textContent || '',
      ctaCount: back.querySelectorAll('.tpr-elevator__card-cta').length,
      frontSoon: element.querySelector('.tpr-elevator__card-soon')?.textContent || '',
      nestedControls: element.querySelectorAll('a,button,[role="link"]').length,
      expanded: element.getAttribute('aria-expanded'), backHidden: back.getAttribute('aria-hidden'),
      geometry: { back: box.toJSON(), heading: back.querySelector('strong').getBoundingClientRect().toJSON(), cta: back.querySelector('.tpr-elevator__card-cta')?.getBoundingClientRect().toJSON(), copy: copyBox.toJSON(), text: textBox.toJSON(), copyOverflow: getComputedStyle(copy).overflowY, copyScrollHeight: copy.scrollHeight, copyClientHeight: copy.clientHeight, textClipped: textBox.bottom > box.bottom + 1 || copy.scrollHeight > copy.clientHeight + 1 },
    };
  }, mobile);
}

for (const width of [1512, 393, 320]) {
  test(`Home ${width}px card backs retain exact source headings, descriptions and distinct CTA labels`, { timeout: 40_000 }, async () => {
    const { page, context } = await pageAt(width), failures = [];
    try {
      for (const [key, cards] of Object.entries(expected)) {
        await openRoom(page, width, key);
        const locator = width <= 720 ? '.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card' : '.tpr-elevator__explore-card';
        assert.equal(await page.locator(locator).count(), cards.length);
        if (width > 720) {
          const status = await page.locator('#elevatorStatus').textContent();
          if (status !== `${roomTitles[key]}: esplorazione aperta nella homepage.`) failures.push({ key, field: 'room-status', actual: status });
        }
        for (const [index, [title, description, ctaLabels]] of cards.entries()) {
          const card = page.locator(locator).nth(index);
          const front = await card.evaluate(element => {
            const soon = element.querySelector('.tpr-elevator__card-soon');
            if (!soon) return null;
            const parent = soon.parentElement, box = soon.getBoundingClientRect(), frame = parent.getBoundingClientRect();
            return { box: box.toJSON(), frame: frame.toJSON(), fontSize: getComputedStyle(soon).fontSize, display: getComputedStyle(soon).display, overflow: box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1 };
          });
          // Native keyboard activation exercises the existing outer flip button.
          // Prevent focus scrolling so it cannot alter panorama/floor geometry.
          await card.evaluate(element => element.focus({ preventScroll: true })); await page.keyboard.press('Enter');
          await page.waitForFunction(({ selector, index }) => document.querySelectorAll(selector)[index].getAttribute('aria-expanded') === 'true', { selector: locator, index });
          const actual = await backData(card, width <= 720);
          const problems = [];
          if (normalize(actual.heading) !== title) problems.push('source heading');
          if (normalize(actual.description) !== description) problems.push('source description');
          if (JSON.stringify(actual.ctaLabels) !== JSON.stringify(ctaLabels) || actual.ctaCount !== (ctaLabels.length ? 1 : 0)) problems.push('source CTA labels in one existing span');
          const soon = key === 'wellness' && title === 'longevity' || key === 'media' && title === 'studio audio';
          if (actual.frontSoon !== (soon ? 'coming soon' : '')) problems.push('source coming-soon front label');
          if (actual.nestedControls || actual.expanded !== 'true' || actual.backHidden !== 'false') problems.push('existing outer-button flip semantics');
          evidence.push({ width, key, title, frontSoonGeometry: front, ...actual, problems });
          if (problems.length) failures.push({ key, title, actual, problems });
          await page.keyboard.press('Enter'); assert.equal(await card.getAttribute('aria-expanded'), 'false');
        }
        await page.keyboard.press('Escape');
      }
      assert.equal(failures.length, 0, `${width}px source card differences: ${JSON.stringify(failures.map(({ key, title, field, problems }) => ({ key, title, field, problems })))}`);
    } finally { await context.close(); }
  });
}

test('unconfigured legacy Home retains its generic card heading, placeholder copy and membership wording', { timeout: 15_000 }, async () => {
  const { page, context } = await pageAt(393, 'homepage/');
  try {
    assert.equal(await page.locator('[data-elevator-config]').count(), 0);
    await openRoom(page, 393, 'coworking');
    const card = page.locator('.tpr-elevator__car--current:not(.tpr-elevator__car--shade) .tpr-elevator__mobile-card').first();
    const actual = await backData(card, true);
    evidence.push({ check: 'legacy-fallback', ...actual });
    assert.equal(actual.heading, 'Cosa si fa?');
    assert.equal(actual.description, 'Approfondisci le postazioni nella Coworking Room.');
    assert.equal(actual.ctaText, 'Diventa Membro');
    assert.equal(actual.frontSoon, ''); assert.equal(actual.nestedControls, 0);
  } finally { await context.close(); }
});
