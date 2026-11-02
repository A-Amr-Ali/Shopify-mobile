import { verifyPassportRequest } from '../lib/passport-core.js';
import template from '../account/profile.liquid?raw';
import css from '../account/profile.css?raw';
import script from '../account/profile.js?raw';

export async function loader({ request }) {
  const auth = verifyPassportRequest(request);
  if (!auth.ok) return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return new Response(`<style>${css}</style>${template}<script>${script}</script>`, { headers: {
    'Content-Type': 'application/liquid; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Surrogate-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'same-origin'
  } });
}
