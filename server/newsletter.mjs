// Server-only module. Never include this module or BREVO_API_KEY in browser assets.
const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';
const MAX_BODY_BYTES = 4096;
export const BREVO_LIST_ID = 2;
export const BREVO_SOURCE = 'Landing';

export function createRateLimiter({ limit = 30, windowMs = 600000, now = Date.now } = {}) {
  const entries = new Map();
  return client => {
    const time = now();
    for (const [key, entry] of entries) if (entry.expires <= time) entries.delete(key);
    const entry = entries.get(client) || { count: 0, expires: time + windowMs };
    if (entry.count >= limit || (!entries.has(client) && entries.size >= 10000)) return false;
    entry.count++;
    entries.set(client, entry);
    return true;
  };
}

const rateLimit = createRateLimiter();

async function readJson(request) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(data));
}

export async function handleNewsletter(request, env, {
  fetchImpl = fetch,
  allowRequest = rateLimit,
  clientAddress = 'unknown',
  log = console.error
} = {}) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = new Set((env.NEWSLETTER_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  const originAllowed = origin && allowedOrigins.has(origin);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    ...(originAllowed ? { 'Access-Control-Allow-Origin': origin } : {})
  };
  const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });

  if (!originAllowed) return reply(403, { success: false });
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      ...headers,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600'
    } });
  }
  if (request.method !== 'POST') return reply(405, { success: false }, { Allow: 'POST, OPTIONS' });
  if (!env.BREVO_API_KEY) return reply(503, { success: false });
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return reply(415, { success: false });
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return reply(413, { success: false });
  if (!allowRequest(clientAddress)) return reply(429, { success: false }, { 'Retry-After': '600' });

  let data;
  try { data = await readJson(request); } catch { return reply(400, { success: false }); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { success: false });
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (data.consent !== true || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || (data.website !== undefined && data.website !== '')) return reply(400, { success: false });

  try {
    const response = await fetchImpl(BREVO_CONTACTS_URL, {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        listIds: [BREVO_LIST_ID],
        attributes: { FONTE: BREVO_SOURCE },
        updateEnabled: true
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'error'
    });
    // Brevo returns 201 for creation and may return 204 for an existing contact.
    if (response.status === 201 || response.status === 204 || response.status === 200) return reply(200, { success: true });
    // Log status only. API responses may contain personal information.
    log('Newsletter: Brevo returned HTTP', response.status);
    if (response.status === 429) return reply(429, { success: false }, { 'Retry-After': '60' });
    return reply(503, { success: false });
  } catch {
    log('Newsletter: Brevo request unavailable');
    return reply(503, { success: false });
  }
}
