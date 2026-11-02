// Server only. Provider contract: https://developers.brevo.com/reference/send-transac-email
// Sender verification: https://developers.brevo.com/reference/get-senders
import { createRateLimiter } from './newsletter.mjs';

const SENDERS_URL = 'https://api.brevo.com/v3/senders';
const EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const RECIPIENT = 'hello@thepeoplesroom.it';
const MAX_BODY_BYTES = 16384;
const subjects = new Map([['contact', 'Informazioni TPR'], ['company', 'Offerte startup e aziende'], ['event', 'Organizza un evento']]);
const userTypes = new Map([['privato', 'Privato'], ['freelancer', 'Freelancer'], ['startup', 'Startup'], ['azienda', 'Azienda']]);
const offers = new Map([['day-pass', 'Day pass'], ['all-inclusive', 'All inclusive'], ['flex-8', 'Flex 8'], ['ufficio-virtuale', 'Ufficio virtuale']]);
const rooms = new Map([['coworking', 'TPR Coworking'], ['reformer', 'TPR Move'], ['wellness', 'TPR Recharge'], ['bar', 'TPR Fuel'], ['media', 'TPR Media']]);
const rateLimit = createRateLimiter({ limit: 5, windowMs: 600000 });
const controlCharacters = /[\u0000-\u001f\u007f]/;
const normalize = value => typeof value === 'string' ? value.trim() : '';
const validEmail = value => value.length <= 254 && /^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

async function readJson(message, limit) {
  if (!message.body) throw new SyntaxError('Missing body');
  const reader = message.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RangeError('Body too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
}

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const kind = normalize(data.kind);
  const userType = userTypes.get(normalize(data.user_type).toLowerCase());
  const name = normalize(data.name);
  const email = normalize(data.email).toLowerCase();
  const phone = normalize(data.phone);
  const message = typeof data.message === 'string' ? data.message.trim().replace(/\r\n?/g, '\n') : '';
  const offer = data.offer === undefined ? '' : normalize(data.offer);
  const room = data.room === undefined ? '' : normalize(data.room);
  if (!subjects.has(kind) || !userType || name.length < 2 || name.length > 120 || controlCharacters.test(name)
      || !validEmail(email) || !/^\+?[0-9 ().\/-]+$/.test(phone) || controlCharacters.test(phone)
      || phone.length > 40 || phone.replace(/\D/g, '').length < 5 || phone.replace(/\D/g, '').length > 20
      || (data.message !== undefined && typeof data.message !== 'string') || message.length > 4000
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)
      || (data.website !== undefined && data.website !== '')
      || (data.offer !== undefined && typeof data.offer !== 'string') || (offer && (!offers.has(offer) || kind !== 'contact'))
      || (data.room !== undefined && typeof data.room !== 'string') || (room && !rooms.has(room))) return null;
  return { kind, userType, name, email, phone, message, offer, room };
}

function selectSender(senders) {
  if (!Array.isArray(senders)) return null;
  const active = senders.filter(sender => sender?.active === true && typeof sender.email === 'string')
    .map(sender => sender.email.trim().toLowerCase())
    .filter(email => validEmail(email) && email.endsWith('@thepeoplesroom.it'));
  return active.find(email => email === RECIPIENT)
    || active.find(email => email === 'social@thepeoplesroom.it')
    || active.sort()[0] || null;
}

export async function handleInquiry(request, env, {
  fetchImpl = fetch,
  allowRequest = rateLimit,
  rateLimitRetryAfter = 600,
  clientAddress = 'unknown',
} = {}) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = new Set((env.NEWSLETTER_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  const originAllowed = origin && allowedOrigins.has(origin);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    ...(originAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
  };
  const reply = (status, success = false, extra = {}) => new Response(JSON.stringify({ success }), { status, headers: { ...headers, ...extra } });
  if (!originAllowed) return reply(403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
  } });
  if (request.method !== 'POST') return reply(405, false, { Allow: 'POST, OPTIONS' });
  if (!env.BREVO_API_KEY) return reply(503);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415);
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return reply(413);
  try {
    if (!await allowRequest(clientAddress)) return reply(429, false, { 'Retry-After': String(rateLimitRetryAfter) });
  } catch { return reply(503); }
  let data;
  try { data = await readJson(request, MAX_BODY_BYTES); }
  catch (error) { return reply(error instanceof RangeError ? 413 : 400); }
  const inquiry = validate(data);
  if (!inquiry) return reply(400);

  // The deadline covers both provider calls. Never follow a redirect with the key.
  const signal = AbortSignal.timeout(10000);
  const providerHeaders = { 'api-key': env.BREVO_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' };
  const unavailable = response => response.status === 429 ? reply(429, false, { 'Retry-After': '60' }) : reply(503);
  try {
    const verified = await fetchImpl(SENDERS_URL, { method: 'GET', headers: providerHeaders, signal, redirect: 'manual' });
    if (verified.status !== 200) return unavailable(verified);
    const sender = selectSender((await readJson(verified, 65536)).senders);
    if (!sender) return reply(503);
    const subject = subjects.get(inquiry.kind) + (inquiry.offer ? ` — ${offers.get(inquiry.offer)}` : '');
    const textContent = [
      'Nuova richiesta dal sito The People’s Room', '',
      `Richiesta: ${subjects.get(inquiry.kind)}`, `Tipologia: ${inquiry.userType}`,
      `Nome: ${inquiry.name}`, `Email: ${inquiry.email}`, `Telefono: ${inquiry.phone}`,
      ...(inquiry.offer ? [`Offerta: ${offers.get(inquiry.offer)}`] : []),
      ...(inquiry.room ? [`Stanza: ${rooms.get(inquiry.room)}`] : []),
      '', 'Messaggio:', inquiry.message || '(non specificato)',
    ].join('\n');
    const response = await fetchImpl(EMAIL_URL, {
      method: 'POST', headers: providerHeaders, signal, redirect: 'manual',
      body: JSON.stringify({
        sender: { email: sender, name: 'The People’s Room' }, to: [{ email: RECIPIENT }],
        replyTo: { email: inquiry.email, name: inquiry.name }, subject, textContent,
        htmlContent: `<html><body><pre>${escapeHtml(textContent)}</pre></body></html>`,
      }),
    });
    // 201 is the documented provider acceptance; delivery remains asynchronous.
    if (response.status !== 201) return unavailable(response);
    return reply(200, true);
  } catch { return reply(503); }
}
