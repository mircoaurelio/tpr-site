import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('native Workers inquiry fetch verifies its sender and never forwards credentials through redirects', async () => {
  const root = fileURLToPath(new URL('./', import.meta.url));
  const [inquiry, newsletter] = await Promise.all([
    readFile(new URL('../server/inquiry.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/newsletter.mjs', import.meta.url), 'utf8'),
  ]);
  let senderStatus = 200, emailStatus = 201;
  const calls = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({
    compatibilityDate: '2026-09-28', modulesRoot: root,
    modules: [
      { type: 'ESModule', path: path.join(root, 'inquiry-test-entry.mjs'), contents: `import { handleInquiry } from './inquiry.mjs'; export default { fetch(request, env) { return handleInquiry(request, env, { allowRequest: () => true }); } };` },
      { type: 'ESModule', path: path.join(root, 'inquiry.mjs'), contents: inquiry },
      { type: 'ESModule', path: path.join(root, 'newsletter.mjs'), contents: newsletter },
    ],
    bindings: { BREVO_API_KEY: 'test-only-secret', NEWSLETTER_ALLOWED_ORIGINS: 'https://thepeoplesroom.it' },
    outboundService: async request => {
      const entry = { url: request.url, method: request.method, key: request.headers.get('api-key') };
      if (request.method === 'POST') entry.body = await request.json();
      calls.push(entry);
      const status = request.url.endsWith('/senders') ? senderStatus : emailStatus;
      if (status === 302) return new Response(null, { status, headers: { Location: 'https://untrusted.example/' } });
      return Response.json(request.url.endsWith('/senders')
        ? { senders: [{ active: true, email: 'hello@thepeoplesroom.it' }] }
        : { messageId: '<test-only>' }, { status });
    },
  }));
  try {
    const send = () => runtime.dispatchFetch('https://thepeoplesroom.it/api/inquiry', {
      method: 'POST', headers: { Origin: 'https://thepeoplesroom.it', 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'contact', user_type: 'Privato', name: 'Ada Example', email: 'ada@example.com', phone: '+39 02 1234567', message: 'Informazioni', website: '' }),
    });
    const accepted = await send();
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { success: true });
    assert.deepEqual(calls.map(call => [call.url, call.method]), [
      ['https://api.brevo.com/v3/senders', 'GET'], ['https://api.brevo.com/v3/smtp/email', 'POST'],
    ]);
    assert.deepEqual(calls[1].body.to, [{ email: 'hello@thepeoplesroom.it' }]);
    assert.deepEqual(calls[1].body.replyTo, { email: 'ada@example.com', name: 'Ada Example' });
    for (const stage of ['sender', 'email']) {
      calls.length = 0;
      senderStatus = stage === 'sender' ? 302 : 200;
      emailStatus = stage === 'email' ? 302 : 201;
      const redirected = await send();
      assert.equal(redirected.status, 503);
      assert.deepEqual(await redirected.json(), { success: false });
      assert.equal(calls.length, stage === 'sender' ? 1 : 2);
      assert.ok(calls.every(call => call.url.startsWith('https://api.brevo.com/v3/')));
    }
  } finally { await runtime.dispose(); }
});
