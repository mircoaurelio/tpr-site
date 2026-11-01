import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { configureImageLoading } from '../scripts/asset_loading.mjs';
const home = await readFile(new URL('../homepage-tpr/index.html', import.meta.url), 'utf8');
const imageTags = html => [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
const imageSources = html => imageTags(html).map(tag => tag.match(/\bsrc="([^"]*)"/)?.[1]);

test('Home defers only its original belowfold event/offer images and preserves every original src', () => {
  const transformed = configureImageLoading(home, '/homepage-tpr/');
  assert.deepEqual(imageSources(transformed), imageSources(home));
  const targets = imageTags(transformed).filter(tag => /home-events-photo-eye-2x\.webp|photos\/(?:day-pass|all-inclusive|flex-8|ufficio-virtuale|company)\.jpeg/.test(tag));
  assert.equal(targets.length, 6);
  for (const tag of targets) assert.match(tag, /\bloading="lazy"/, tag);
  assert.match(transformed.match(/<section\b[^>]*\bid="rooms"[^>]*>/)?.[0] || '', /\bclass="tpr-elevator"/, 'reserve the controller\'s exact final Room height before deferred scripts run');
  const hero = imageTags(transformed).find(tag => /preview-hero-composite/.test(tag));
  assert.equal(hero, imageTags(home).find(tag => /preview-hero-composite/.test(tag)), 'hero source and fetch priority remain exact');
  assert.equal(configureImageLoading(transformed, '/homepage-tpr/'), transformed, 'build decoration is idempotent');
});

test('unconfigured and standalone routes retain their established loading behavior', () => {
  for (const route of ['/homepage/', '/rooms/coworking/', '/eventi/', '/vivi-tpr/']) assert.equal(configureImageLoading(home, route), home);
});
