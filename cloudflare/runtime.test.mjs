import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('native Workers fetch creates the contact and never follows Brevo redirects', async () => {
  const source = await readFile(new URL('../server/newsletter.mjs', import.meta.url), 'utf8');
  const root = fileURLToPath(new URL('./', import.meta.url));
  let status = 201;
  const calls = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({
    compatibilityDate: '2026-09-28',
    modulesRoot: root,
    modules: [
      { type: 'ESModule', path: path.join(root, 'test-entry.mjs'), contents: `import { handleNewsletter } from './newsletter.mjs'; export default { fetch(request, env) { return handleNewsletter(request, env, {allowRequest: () => true, log: () => {}}); } };` },
      { type: 'ESModule', path: path.join(root, 'newsletter.mjs'), contents: source },
    ],
    bindings: { BREVO_API_KEY: 'test-secret', NEWSLETTER_ALLOWED_ORIGINS: 'https://thepeoplesroom.it' },
    outboundService: async request => {
      calls.push({ url: request.url, key: request.headers.get('api-key'), body: await request.json() });
      return new Response(null, { status, headers: status === 302 ? { Location: 'https://untrusted.example/' } : {} });
    },
  }));
  try {
    const send = () => runtime.dispatchFetch('https://thepeoplesroom.it/api/newsletter', {
      method: 'POST',
      headers: { Origin: 'https://thepeoplesroom.it', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' Person@Example.com ', consent: true, website: '' }),
    });
    const created = await send();
    assert.equal(created.status, 200);
    assert.deepEqual(await created.json(), { success: true });
    assert.deepEqual(calls, [{ url: 'https://api.brevo.com/v3/contacts', key: 'test-secret', body: {
      email: 'person@example.com', listIds: [2], attributes: { FONTE: 'Landing' }, updateEnabled: true,
    } }]);
    status = 302;
    const redirected = await send();
    assert.equal(redirected.status, 503);
    assert.deepEqual(await redirected.json(), { success: false });
    assert.equal(calls.length, 2, 'A redirected host must never receive the API key');
    assert.ok(calls.every(call => call.url === 'https://api.brevo.com/v3/contacts'));
  } finally {
    await runtime.dispose();
  }
});
