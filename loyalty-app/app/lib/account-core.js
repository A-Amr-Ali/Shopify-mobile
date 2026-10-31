const attributes = values => Object.fromEntries((values || []).map(a => [String(a.key).toLowerCase(), String(a.value || '')]));
const nodes = connection => connection?.nodes || [];

export function safeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function deliveryFromOrder(order) {
  const attrs = attributes(order.customAttributes);
  const lines = nodes(order.lineItems);
  const fee = lines.find(l => l.product?.handle === 'sofie-now-express-delivery' || /^sofie now (express|delivery)/i.test(l.title));
  const shipping = nodes(order.shippingLines).map(s => s.title || '').join(' ');
  const selected = attrs['sofie now requested'] === 'Yes';
  const pickup = /store pickup|store collection|استلام/i.test([fee?.variantTitle, attrs['sofie now fee'], shipping].filter(Boolean).join(' '));
  const confirmed = Boolean(fee || /sofie now/i.test(shipping));
  return {
    mode: confirmed ? (pickup ? 'pickup' : 'now') : 'standard',
    requested: selected && !confirmed,
    mixed: confirmed && /standard|mixed/i.test([attrs['sofie now fee'], fee?.variantTitle, shipping].join(' ')),
    area: confirmed ? (attrs['sofie now area'] || '').slice(0, 160) : '',
    service: confirmed ? (attrs['sofie now fee'] || shipping || fee?.variantTitle || '').slice(0, 300) : '',
    items: confirmed ? (attrs['sofie now items'] || '').slice(0, 1500) : ''
  };
}

export function orderForCustomer(order) {
  const active = (order.fulfillments || []).filter(f => !['CANCELLED', 'ERROR', 'FAILURE'].includes(f.status));
  const shipments = active.map(f => ({
    id: f.id,
    status: f.displayStatus || f.status,
    createdAt: f.createdAt,
    deliveredAt: f.deliveredAt || null,
    estimatedDeliveryAt: f.estimatedDeliveryAt || null,
    tracking: (f.trackingInfo || []).map(t => ({ company: t.company, number: t.number, url: safeHttps(t.url) })),
    events: nodes(f.events).map(e => ({ status: e.status, happenedAt: e.happenedAt, estimatedDeliveryAt: e.estimatedDeliveryAt || null }))
  }));
  let stage = 'confirmed';
  if (order.displayFinancialStatus === 'PENDING') stage = 'payment_pending';
  if (shipments.length) stage = 'dispatched';
  if (shipments.some(f => f.status === 'OUT_FOR_DELIVERY' || f.events.some(e => e.status === 'OUT_FOR_DELIVERY'))) stage = 'out_for_delivery';
  if (order.displayFulfillmentStatus === 'PARTIALLY_FULFILLED') stage = 'partially_dispatched';
  if (order.displayFulfillmentStatus === 'FULFILLED' && shipments.length && shipments.every(f => f.deliveredAt || f.status === 'DELIVERED' || f.events.some(e => e.status === 'DELIVERED'))) stage = 'delivered';
  if (order.cancelledAt) stage = 'cancelled';
  return {
    id: order.id, name: order.name, createdAt: order.createdAt,
    cancelledAt: order.cancelledAt, payment: order.displayFinancialStatus,
    fulfillment: order.displayFulfillmentStatus, stage,
    total: order.currentTotalPriceSet?.presentmentMoney,
    delivery: deliveryFromOrder(order), shipments,
    items: nodes(order.lineItems).filter(l => l.product?.handle !== 'sofie-now-express-delivery' && !/^sofie now (express|delivery)/i.test(l.title)).map(l => ({
      id: l.id, title: l.title, variant: l.variantTitle, quantity: l.quantity,
      currentQuantity: l.currentQuantity, image: safeHttps(l.image?.url), imageAlt: l.image?.altText || l.title
    })),
    moreItems: Boolean(order.lineItems?.pageInfo?.hasNextPage),
    itemsCursor: order.lineItems?.pageInfo?.hasNextPage ? order.lineItems.pageInfo.endCursor : null
  };
}

export function accountPagination(url) {
  for (const key of ['view', 'after', 'before', 'orderId']) if (url.searchParams.getAll(key).length > 1) throw new Error('invalid_pagination');
  const view = url.searchParams.get('view') || 'summary';
  if (!['summary', 'orders', 'points', 'rewards', 'items'].includes(view)) throw new Error('invalid_pagination');
  const after = url.searchParams.get('after');
  const before = url.searchParams.get('before');
  if (after && (after.length > 2048 || !/^[A-Za-z0-9+/=_-]+$/.test(after))) throw new Error('invalid_pagination');
  if (before && !/^\d{1,19}$/.test(before)) throw new Error('invalid_pagination');
  const orderId = url.searchParams.get('orderId');
  if (view === 'items' && !/^gid:\/\/shopify\/Order\/\d{1,20}$/.test(orderId || '')) throw new Error('invalid_pagination');
  return { view, after, before, orderId };
}
