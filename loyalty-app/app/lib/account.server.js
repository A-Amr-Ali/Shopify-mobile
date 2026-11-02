import { supabase } from '../db.server.js';
import { getAdmin } from './admin.server.js';
import { tierProgress } from './tier.server.js';
import { REDEMPTION_TIERS } from '../config/loyalty.js';
import { orderForCustomer } from './account-core.js';

export const ACCOUNT_ORDERS_QUERY = `query MySofieOrders($customerId: ID!, $after: String) {
  currentAppInstallation { accessScopes { handle } }
  customer(id: $customerId) {
    id firstName displayName numberOfOrders
    orders(first: 10, after: $after, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus
        currentTotalPriceSet { presentmentMoney { amount currencyCode } }
        customAttributes { key value }
        shippingLines(first: 10) { nodes { title } }
        lineItems(first: 10) {
          nodes { id title variantTitle quantity currentQuantity image { url altText } product { handle } }
          pageInfo { hasNextPage endCursor }
        }
        fulfillments(first: 5) {
          id status displayStatus createdAt estimatedDeliveryAt deliveredAt
          trackingInfo { company number url }
          events(first: 5, sortKey: HAPPENED_AT, reverse: true) { nodes { status happenedAt estimatedDeliveryAt } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export const ACCOUNT_ITEMS_QUERY = `query MySofieOrderItems($orderId: ID!, $after: String) {
  order(id: $orderId) {
    id customer { id }
    lineItems(first: 50, after: $after) {
      nodes { id title variantTitle quantity currentQuantity image { url altText } product { handle } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

export async function customerOrderItems(customerId, orderId, after, adminFactory = getAdmin) {
  const admin = await adminFactory(process.env.SHOP_DOMAIN);
  const response = await admin.graphql(ACCOUNT_ITEMS_QUERY, { variables: { orderId, after: after || null } });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error('orders_unavailable');
  const order = body.data?.order;
  if (!order || order.customer?.id !== customerId) throw new Error('order_unavailable');
  const clean = orderForCustomer(order);
  return { items: clean.items, moreItems: clean.moreItems, itemsCursor: clean.itemsCursor };
}

export async function customerOrders(customerId, after, adminFactory = getAdmin) {
  const admin = await adminFactory(process.env.SHOP_DOMAIN);
  const response = await admin.graphql(ACCOUNT_ORDERS_QUERY, { variables: { customerId, after: after || null } });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error('orders_unavailable');
  const customer = body.data?.customer;
  if (!customer || customer.id !== customerId) throw new Error('customer_unavailable');
  return {
    customer: { firstName: customer.firstName || '', displayName: customer.displayName || '', orderCount: Number(customer.numberOfOrders) || 0 },
    orders: (customer.orders?.nodes || []).map(orderForCustomer),
    pageInfo: customer.orders?.pageInfo || { hasNextPage: false, endCursor: null },
    fullHistory: Boolean(body.data.currentAppInstallation?.accessScopes?.some(s => s.handle === 'read_all_orders'))
  };
}

async function customerRows(table, selection, customerId, before, db = supabase) {
  let query = db.from(table).select(selection).eq('customer_id', customerId).order('id', { ascending: false }).limit(21);
  if (before) query = query.lt('id', before);
  const { data, error } = await query;
  if (error) throw new Error('rewards_unavailable');
  const rows = data || [];
  return { rows: rows.slice(0, 20), hasMore: rows.length > 20, before: rows.length > 20 ? String(rows[19].id) : null };
}

export const customerPoints = (customerId, before, db) => customerRows('points_ledger', 'id,delta,reason,balance_after,created_at', customerId, before, db);
export const customerRewards = (customerId, before, db) => customerRows('redemptions', 'id,points_spent,discount_code,status,created_at', customerId, before, db);

export async function customerSummary(customerId, db = supabase) {
  const results = await Promise.all([
    db.from('customers').select('points_balance,tier,rolling_spend_egp,birthday').eq('shopify_customer_id', customerId).maybeSingle(),
    db.from('profiles').select('skin_type,undertone,foundation_brand,foundation_shade,completion_pct').eq('customer_id', customerId).maybeSingle(),
    db.from('beauty_passports').select('data,version,updated_at').eq('customer_id', customerId).maybeSingle()
  ]);
  if (results.some(r => r.error)) throw new Error('rewards_unavailable');
  const [customer, profile, saved] = results.map(r => r.data);
  const p = tierProgress(customer?.rolling_spend_egp || 0);
  const passport = saved?.data || {};
  return {
    balance: customer?.points_balance ?? 0,
    tier: customer?.tier || 'insider',
    birthday: customer?.birthday ? String(customer.birthday).slice(5) : null,
    progress: { current: p.current.key, next: p.next?.key || null, remainingEgp: p.toNextEgp, pct: p.pct },
    rewards: REDEMPTION_TIERS,
    beautyProfile: profile || null,
    passport: { saved: passport.saved || [], routine: passport.routine || [], hasMatch: Boolean(passport.match), updatedAt: saved?.updated_at || null }
  };
}
