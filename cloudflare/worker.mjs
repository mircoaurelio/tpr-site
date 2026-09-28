import { handleNewsletter } from '../server/newsletter.mjs';

export async function fetchRequest(request, env, { fetchImpl = fetch } = {}) {
  const url = new URL(request.url);
  if (url.pathname === '/api/newsletter') {
    return handleNewsletter(request, env, {
      fetchImpl,
      clientAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      rateLimitRetryAfter: 60,
      allowRequest: async client => {
        if (client === 'unknown' || !env.NEWSLETTER_RATE_LIMITER) throw new Error('Rate limiting unavailable');
        const key = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tpr-newsletter:${client}`));
        const digest = Array.from(new Uint8Array(key), byte => byte.toString(16).padStart(2, '0')).join('');
        const { success } = await env.NEWSLETTER_RATE_LIMITER.limit({ key: digest });
        return success;
      }
    });
  }
  if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
  if (url.pathname === '/coming-soon' || url.pathname === '/coming-soon/') {
    url.pathname = '/';
    return Response.redirect(url.toString(), 302);
  }
  return env.ASSETS.fetch(request);
}

export default { fetch: fetchRequest };
