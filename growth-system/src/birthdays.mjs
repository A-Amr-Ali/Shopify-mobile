import { adminQuery } from './catalog.mjs';
import { db } from './db.mjs';
import { daysUntilBirthday, normalizeCustomerHistory } from './birthdays-core.mjs';

export { daysUntilBirthday, normalizeCustomerHistory } from './birthdays-core.mjs';

export const CUSTOMER_HISTORY_QUERY = `query BirthdayCustomerHistory($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Customer {
      id
      displayName
      numberOfOrders
      amountSpent { amount currencyCode }
      orders(first: 20, reverse: true, sortKey: PROCESSED_AT) {
        nodes {
          id name processedAt cancelledAt test displayFinancialStatus
          currentTotalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
}`;

async function shopifyHistory(rows) {
  const ids = rows.map(row => String(row.shopify_customer_id || '')).filter(id => /^\d+$/.test(id)).map(id => `gid://shopify/Customer/${id}`);
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await adminQuery(CUSTOMER_HISTORY_QUERY, { ids: ids.slice(i, i + 50) });
    for (const node of data.nodes || []) if (node?.id) out.set(node.id.replace(/^.*\//, ''), node);
  }
  return out;
}

export async function birthdayDashboard(now = new Date()) {
  const rows = await db('customers?select=shopify_customer_id,first_name,email,phone,birthday,tier,birthday_opt_in,lifetime_spend_egp&birthday=not.is.null&birthday_opt_in=eq.true&order=birthday.asc&limit=2000');
  let histories = new Map();
  let shopifyReady = true;
  try { histories = await shopifyHistory(rows); }
  catch (error) { shopifyReady = false; console.warn('birthday Shopify history:', error.message); }
  const customers = rows.map(row => {
    const node = histories.get(String(row.shopify_customer_id));
    const history = normalizeCustomerHistory(node, row.lifetime_spend_egp);
    const daysUntil = daysUntilBirthday(row.birthday, now);
    return {
      customerId: String(row.shopify_customer_id),
      name: history.name || row.first_name || 'Customer',
      firstName: row.first_name || null,
      email: row.email || null,
      phone: row.phone || null,
      birthday: row.birthday,
      tier: row.tier,
      daysUntil,
      ...history
    };
  }).filter(row => row.daysUntil !== null).sort((a, b) => a.daysUntil - b.daysUntil || String(a.name || '').localeCompare(String(b.name || '')));
  const today = customers.filter(x => x.daysUntil === 0);
  const upcoming = customers.filter(x => x.daysUntil > 0 && x.daysUntil <= 30);
  return {
    generatedAt: now.toISOString(),
    timezone: 'Africa/Cairo',
    shopifyReady,
    counts: { today: today.length, next7Days: customers.filter(x => x.daysUntil >= 0 && x.daysUntil <= 7).length, next30Days: today.length + upcoming.length, saved: customers.length },
    today,
    upcoming
  };
}
