import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchRequest } from './worker.mjs';

const origin = 'https://thepeoplesroom.it';
const request = (options = {}) => new Request(`${origin}/api/newsletter`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...options.headers },
  body: JSON.stringify({ email: ' Person@Example.com ', consent: true, website: '' }),
});
const environment = (limiter = async () => ({ success: true })) => ({
  BREVO_API_KEY: 'test-secret',
  NEWSLETTER_ALLOWED_ORIGINS: origin,
  NEWSLETTER_RATE_LIMITER: { limit: limiter },
});

test('Cloudflare waits for the rate limit and forces the Brevo list and source', async () => {
  let checked = false;
  const env = environment(async ({ key }) => {
    await Promise.resolve();
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.ok(!key.includes('192.0.2.1'));
    checked = true;
    return { success: true };
  });
  const response = await fetchRequest(request(), env, { fetchImpl: async (url, options) => {
    assert.equal(checked, true);
    assert.equal(url, 'https://api.brevo.com/v3/contacts');
    assert.equal(options.headers['api-key'], 'test-secret');
    assert.deepEqual(JSON.parse(options.body), { email: 'person@example.com', listIds: [2], attributes: { FONTE: 'Landing' }, updateEnabled: true });
    return new Response(null, { status: 201 });
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});

test('asynchronous rate-limit denial blocks Brevo and uses a one-minute retry', async () => {
  let calls = 0;
  const response = await fetchRequest(request(), environment(async () => ({ success: false })), {
    fetchImpl: async () => { calls++; return new Response(null, { status: 201 }); }
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(calls, 0);
});

test('missing or failing platform limiter fails closed', async () => {
  for (const env of [
    { ...environment(), NEWSLETTER_RATE_LIMITER: undefined },
    environment(async () => { throw new Error('Private platform details'); })
  ]) {
    const response = await fetchRequest(request(), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false });
  }
});

test('preflight and untrusted origins never consume a rate-limit token', async () => {
  let calls = 0;
  const env = environment(async () => { calls++; return { success: true }; });
  const options = await fetchRequest(new Request(`${origin}/api/newsletter`, { method: 'OPTIONS', headers: { Origin: origin } }), env);
  assert.equal(options.status, 204);
  const forbidden = await fetchRequest(request({ headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(forbidden.status, 403);
  assert.equal(calls, 0);
});

test('unknown API routes cannot fall through to static HTML', async () => {
  const response = await fetchRequest(new Request(`${origin}/api/private`), {});
  assert.equal(response.status, 404);
});

test('static assets are served by the asset binding and the previous path redirects', async () => {
  const env = { ASSETS: { fetch: async req => new Response(new URL(req.url).pathname) } };
  const response = await fetchRequest(new Request(`${origin}/coming-soon.css`), env);
  assert.equal(await response.text(), '/coming-soon.css');
  const redirect = await fetchRequest(new Request(`${origin}/coming-soon/?utm_source=test`), env);
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('Location'), `${origin}/?utm_source=test`);
});
