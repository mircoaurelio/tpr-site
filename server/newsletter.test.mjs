import test from 'node:test';
import assert from 'node:assert/strict';
import { handleNewsletter, createRateLimiter } from './newsletter.mjs';

const origin = 'https://mircoaurelio.github.io';
const env = { BREVO_API_KEY: 'test-secret', NEWSLETTER_ALLOWED_ORIGINS: origin };
const valid = { email: '  Person@example.com  ', consent: true, website: '' };
const request = (body = valid, headers = {}) => new Request('https://server.example/api/newsletter', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
});

for (const status of [201, 204]) test(`Brevo ${status}: create/update goes to list 2 with FONTE=Landing`, async () => {
  let sent;
  const response = await handleNewsletter(request({ ...valid, listIds: [99], attributes: { FONTE: 'forged' } }), env, {
    fetchImpl: async (url, options) => { sent = { url, ...options }; return new Response(null, { status }); },
    allowRequest: () => true
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(sent.url, 'https://api.brevo.com/v3/contacts');
  assert.equal(sent.headers['api-key'], env.BREVO_API_KEY);
  assert.deepEqual(JSON.parse(sent.body), { email: 'person@example.com', listIds: [2], attributes: { FONTE: 'Landing' }, updateEnabled: true });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('invalid consent, email and honeypot never reach Brevo', async () => {
  for (const body of [{ ...valid, consent: false }, { ...valid, consent: 'true' }, { ...valid, email: 'bad@' }, { ...valid, email: 'a@b' }, { ...valid, email: 'a'.repeat(255) + '@example.com' }, { ...valid, website: 'spam' }, null, []]) {
    let called = false;
    const response = await handleNewsletter(request(body), env, { allowRequest: () => true, fetchImpl: () => { called = true; } });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

test('untrusted origins are rejected and receive no CORS permission', async () => {
  for (const candidate of ['https://attacker.example', 'null', '']) {
    const response = await handleNewsletter(request(valid, { Origin: candidate }), env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
});

test('preflight works only for the configured origin', async () => {
  const response = await handleNewsletter(new Request('https://server.example/api/newsletter', { method: 'OPTIONS', headers: { Origin: origin } }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

test('missing secrets, unsupported types, large bodies and rate limits fail closed', async () => {
  assert.equal((await handleNewsletter(request(), { ...env, BREVO_API_KEY: '' })).status, 503);
  assert.equal((await handleNewsletter(request(valid, { 'Content-Type': 'text/plain' }), env)).status, 415);
  assert.equal((await handleNewsletter(request(valid, { 'Content-Length': '5000' }), env)).status, 413);
  assert.equal((await handleNewsletter(request({ ...valid, extra: 'a'.repeat(5000) }), env)).status, 400);
  assert.equal((await handleNewsletter(request(), env, { allowRequest: () => false })).status, 429);
});

test('Brevo failures never become success and never expose provider details', async () => {
  for (const status of [400, 401, 429, 500]) {
    const logs = [];
    const response = await handleNewsletter(request(), env, { allowRequest: () => true, fetchImpl: async () => new Response('private data', { status }), log: (...args) => logs.push(args) });
    assert.equal(response.status, status === 429 ? 429 : 503);
    assert.deepEqual(await response.json(), { success: false });
    assert.equal(JSON.stringify(logs).includes('private data'), false);
  }
  assert.equal((await handleNewsletter(request(), env, { allowRequest: () => true, fetchImpl: async () => { throw new Error('private data'); }, log: () => {} })).status, 503);
});

test('request limiter isolates clients and expires the window', () => {
  let time = 0;
  const allow = createRateLimiter({ limit: 2, windowMs: 100, now: () => time });
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), true);
  assert.equal(allow('a'), false);
  assert.equal(allow('b'), true);
  time = 100;
  assert.equal(allow('a'), true);
});
