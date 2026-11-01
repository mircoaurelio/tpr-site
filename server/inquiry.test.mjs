import test from 'node:test';
import assert from 'node:assert/strict';

// Keep a missing adapter an explicit behavior assertion during the initial RED run.
const adapter = await import('./inquiry.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const invoke = (...args) => {
  assert.equal(typeof adapter.handleInquiry, 'function', 'the direct inquiry adapter must exist');
  return adapter.handleInquiry(...args);
};
const origin = 'https://thepeoplesroom.it';
const env = { BREVO_API_KEY: 'test-only-secret', NEWSLETTER_ALLOWED_ORIGINS: origin };
const valid = { kind: 'contact', user_type: 'Freelancer', name: ' Ada Example ', email: ' Ada@Example.com ', phone: '+39 02 1234567', message: 'Vorrei conoscere gli spazi.', website: '' };
const request = (body = valid, headers = {}) => new Request(`${origin}/api/inquiry`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const senders = [{ active: true, email: 'hello@thepeoplesroom.it', id: 1 }];
const provider = ({ senderList = senders, senderStatus = 200, sendStatus = 201, sent = [] } = {}) => async (url, options) => {
  sent.push({ url, ...options });
  if (url === 'https://api.brevo.com/v3/senders') return Response.json({ senders: senderList }, { status: senderStatus });
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  return Response.json({ messageId: '<test-only-message@example.test>' }, { status: sendStatus });
};
const options = fetchImpl => ({ fetchImpl, allowRequest: () => true });

test('direct inquiry selects a verified brand sender, fixes the recipient and preserves a validated reply-to', async () => {
  const sent = [];
  const response = await invoke(request({ ...valid, offer: 'day-pass', room: 'coworking', to: 'attacker@example.net', sender: 'visitor@example.net', subject: 'forged subject' }), env, options(provider({ sent })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(sent.length, 2);
  assert.equal(sent[0].method, 'GET');
  for (const call of sent) {
    assert.equal(call.headers['api-key'], 'test-only-secret');
    assert.equal(call.redirect, 'manual');
    assert.ok(call.signal instanceof AbortSignal);
  }
  const message = JSON.parse(sent[1].body);
  assert.deepEqual(message.to, [{ email: 'hello@thepeoplesroom.it' }]);
  assert.equal(message.sender.email, 'hello@thepeoplesroom.it');
  assert.deepEqual(message.replyTo, { email: 'ada@example.com', name: 'Ada Example' });
  assert.match(message.subject, /^Informazioni TPR/);
  assert.ok(message.subject.includes('Day pass'));
  assert.ok(!message.subject.includes('forged'));
  assert.match(message.textContent, /Freelancer/);
  assert.match(message.textContent, /coworking/i);
  assert.match(message.textContent, /Vorrei conoscere gli spazi\./);
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert.equal(message.headers, undefined);
});

test('inquiry sender preference is hello, then social, then another active exact brand domain', async () => {
  const candidates = [
    { active: true, email: 'outside@example.org', id: 4 },
    { active: false, email: 'hello@thepeoplesroom.it', id: 1 },
    { active: true, email: 'team@thepeoplesroom.it', id: 2 },
    { active: true, email: 'social@thepeoplesroom.it', id: 3 },
  ];
  for (const [senderList, expected] of [
    [[...candidates, { active: true, email: 'Hello@ThePeoplesRoom.it', id: 5 }], 'hello@thepeoplesroom.it'],
    [candidates, 'social@thepeoplesroom.it'],
    [candidates.filter(sender => sender.email !== 'social@thepeoplesroom.it'), 'team@thepeoplesroom.it'],
  ]) {
    const sent = [];
    assert.equal((await invoke(request(), env, options(provider({ senderList, sent })))).status, 200);
    assert.equal(JSON.parse(sent[1].body).sender.email, expected);
  }
});

test('no active verified brand sender fails closed before any email POST', async () => {
  for (const senderList of [[], [{ active: false, email: 'hello@thepeoplesroom.it' }], [{ active: true, email: 'hello@thepeoplesroom.it.attacker.net' }], [{ active: 'true', email: 'hello@thepeoplesroom.it' }], [{ active: true, email: 'hello@sub.thepeoplesroom.it' }]]) {
    const sent = [];
    const response = await invoke(request(), env, options(provider({ senderList, sent })));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false });
    assert.equal(sent.length, 1);
  }
});

test('provider authentication, rejection, redirects, malformed responses and transport failures never become success', async () => {
  for (const status of [302, 400, 401, 403, 429, 500]) for (const stage of ['senders', 'email']) {
    const sent = [];
    const response = await invoke(request(), env, options(provider({ sent, ...(stage === 'senders' ? { senderStatus: status } : { sendStatus: status }) })));
    assert.equal(response.status, status === 429 ? 429 : 503);
    assert.deepEqual(await response.json(), { success: false });
    if (status === 429) assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(sent.length, stage === 'senders' ? 1 : 2);
  }
  for (const fetchImpl of [async () => new Response('private provider detail', { status: 200 }), async () => { throw new Error('private provider detail'); }]) {
    const response = await invoke(request(), env, options(fetchImpl));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false });
  }
});

test('all inquiry subjects are server controlled and unsafe HTML is escaped from the plain text', async () => {
  for (const [kind, expectedSubject] of [['contact', 'Informazioni TPR'], ['company', 'Offerte startup e aziende'], ['event', 'Organizza un evento']]) {
    const sent = [];
    const response = await invoke(request({ ...valid, kind, name: 'Ada <img src=x>', message: '<script>alert("x")</script>\nA & B' }), env, options(provider({ sent })));
    assert.equal(response.status, 200);
    const message = JSON.parse(sent[1].body);
    assert.equal(message.subject, expectedSubject);
    assert.ok(message.textContent.includes('<script>'));
    assert.ok(message.htmlContent.includes('&lt;script&gt;'));
    assert.ok(message.htmlContent.includes('&lt;img src=x&gt;'));
    assert.ok(message.htmlContent.includes('A &amp; B'));
    assert.ok(!message.htmlContent.includes('<script>'));
    assert.ok(!message.htmlContent.includes('<img'));
  }
});

test('invalid inquiry fields, unapproved metadata, control characters and honeypots never reach Brevo', async () => {
  const cases = [null, [], {}, { ...valid, kind: 'arbitrary' }, { ...valid, user_type: 'unknown' }, { ...valid, name: '' }, { ...valid, name: 'Ada\r\nBcc: attacker@example.net' }, { ...valid, name: 'a'.repeat(121) }, { ...valid, email: 'bad@' }, { ...valid, email: 'a@example.com\r\nBcc:x@example.org' }, { ...valid, phone: '' }, { ...valid, phone: 'call me' }, { ...valid, message: 'x'.repeat(4001) }, { ...valid, message: 'bad\u0000data' }, { ...valid, website: 'spam' }, { ...valid, offer: 'made-up' }, { ...valid, offer: ['day-pass'] }, { ...valid, room: 'arbitrary-room' }, { ...valid, kind: 'event', offer: 'day-pass' }];
  for (const body of cases) {
    let called = false;
    const response = await invoke(request(body), env, options(async () => { called = true; }));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(await response.json(), { success: false });
    assert.equal(called, false);
  }
});

test('inquiry origins, method, secret, content type and bounded streams fail closed', async () => {
  let called = false;
  const config = options(async () => { called = true; });
  for (const candidate of ['', 'null', 'https://attacker.example']) {
    const response = await invoke(request(valid, { Origin: candidate }), env, config);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const preflight = await invoke(new Request(`${origin}/api/inquiry`, { method: 'OPTIONS', headers: { Origin: origin } }), env, config);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal((await invoke(new Request(`${origin}/api/inquiry`, { headers: { Origin: origin } }), env, config)).status, 405);
  assert.equal((await invoke(request(), { ...env, BREVO_API_KEY: '' }, config)).status, 503);
  assert.equal((await invoke(request(valid, { 'Content-Type': 'text/plain' }), env, config)).status, 415);
  assert.equal((await invoke(request(valid, { 'Content-Length': '20000' }), env, config)).status, 413);
  assert.equal((await invoke(request({ ...valid, extra: 'x'.repeat(20000) }), env, config)).status, 413);
  assert.equal((await invoke(new Request(`${origin}/api/inquiry`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{bad' }), env, config)).status, 400);
  assert.equal(called, false);
});

test('inquiry rate limiting completes before provider calls and fails closed', async () => {
  let called = false;
  for (const [allowRequest, expected] of [[async () => false, 429], [async () => { throw new Error('private platform data'); }, 503]]) {
    const response = await invoke(request(), env, { allowRequest, rateLimitRetryAfter: 60, fetchImpl: async () => { called = true; } });
    assert.equal(response.status, expected);
    if (expected === 429) assert.equal(response.headers.get('Retry-After'), '60');
    assert.deepEqual(await response.json(), { success: false });
  }
  assert.equal(called, false);
});
