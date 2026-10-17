import { json } from '@remix-run/node';
import { verifyPassportRequest } from '../lib/passport-core.js';
import { accountPagination } from '../lib/account-core.js';
import { customerOrders, customerOrderItems, customerPoints, customerRewards, customerSummary } from '../lib/account.server.js';

const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Surrogate-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
const reply = (data, status = 200) => json(data, { status, headers });

export async function loader({ request }) {
  const auth = verifyPassportRequest(request);
  if (!auth.ok || !auth.customerId) return reply({ error: 'not_logged_in' }, 401);
  let page;
  try { page = accountPagination(new URL(request.url)); }
  catch { return reply({ error: 'invalid_pagination' }, 400); }
  try {
    if (page.view === 'items') return reply(await customerOrderItems(auth.customerId, page.orderId, page.after));
    if (page.view === 'orders') return reply(await customerOrders(auth.customerId, page.after));
    if (page.view === 'points') return reply({ points: await customerPoints(auth.customerId, page.before) });
    if (page.view === 'rewards') return reply({ redeemed: await customerRewards(auth.customerId, page.before) });
    const [orders, summary, points, redeemed] = await Promise.allSettled([
      customerOrders(auth.customerId), customerSummary(auth.customerId), customerPoints(auth.customerId), customerRewards(auth.customerId)
    ]);
    if (orders.status === 'rejected' && summary.status === 'rejected') return reply({ error: 'temporarily_unavailable' }, 503);
    return reply({
      ...(orders.status === 'fulfilled' ? orders.value : { orders: [], ordersError: true }),
      summary: summary.status === 'fulfilled' ? summary.value : null,
      points: points.status === 'fulfilled' ? points.value : null,
      redeemed: redeemed.status === 'fulfilled' ? redeemed.value : null,
      updatedAt: new Date().toISOString()
    });
  } catch { return reply({ error: 'temporarily_unavailable' }, 503); }
}
