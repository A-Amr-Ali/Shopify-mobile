function cairoDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
}

export function daysUntilBirthday(birthday, now = new Date()) {
  const match = String(birthday || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const today = cairoDateParts(now);
  const start = Date.UTC(today.year, today.month - 1, today.day);
  let target = Date.UTC(today.year, Number(match[1]) - 1, Number(match[2]));
  if (target < start) target = Date.UTC(today.year + 1, Number(match[1]) - 1, Number(match[2]));
  return Math.round((target - start) / 86400000);
}

function money(value, fallbackCurrency = 'EGP') {
  const amount = Number(value?.amount);
  return Number.isFinite(amount) ? { amount, currency: value.currencyCode || fallbackCurrency } : null;
}

export function normalizeCustomerHistory(node, fallbackSpend = 0) {
  const orders = (node?.orders?.nodes || []).filter(order => !order.test && !order.cancelledAt && order.displayFinancialStatus !== 'VOIDED');
  const last = orders[0] || null;
  const lifetime = money(node?.amountSpent) || (Number(fallbackSpend) > 0 ? { amount: Number(fallbackSpend), currency: 'EGP' } : null);
  return {
    name: node?.displayName || null,
    hasOrdered: Number(node?.numberOfOrders || 0) > 0,
    orderCount: Number(node?.numberOfOrders || 0),
    lifetimeSpend: lifetime,
    lastOrder: last ? {
      name: last.name,
      processedAt: last.processedAt,
      value: money(last.currentTotalPriceSet?.shopMoney),
      financialStatus: last.displayFinancialStatus
    } : null
  };
}
