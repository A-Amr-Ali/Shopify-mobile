// In-memory ledger store. Mirrors the semantics of the Supabase Postgres
// function apply_ledger_entry(): idempotent, append-only, negative-guarded.
// Used by the unit tests so the ledger can be exercised without a database.

export function createMemoryStore() {
  const balances = new Map(); // customerId -> int
  const byIdem = new Map(); // idempotencyKey -> entry
  const entries = []; // append-only log

  function ensureCustomer(customerId) {
    if (!balances.has(customerId)) balances.set(customerId, 0);
  }

  function apply({ customerId, delta, reason, referenceType, referenceId, idempotencyKey, meta }) {
    ensureCustomer(customerId);

    // Idempotency: replay returns the prior result, no new row.
    const prior = byIdem.get(idempotencyKey);
    if (prior) return { applied: false, balanceAfter: prior.balanceAfter, id: prior.id };

    const next = balances.get(customerId) + delta;
    if (next < 0) throw new Error(`insufficient_points: balance would go negative (${next})`);

    const entry = {
      id: entries.length + 1,
      customerId, delta, reason, referenceType, referenceId,
      balanceAfter: next, idempotencyKey, meta: meta ?? null,
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    byIdem.set(idempotencyKey, entry);
    balances.set(customerId, next);
    return { applied: true, balanceAfter: next, id: entry.id };
  }

  function findEarnForOrder(customerId, orderId) {
    // Most recent purchase row for this order.
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.customerId === customerId && e.reason === "purchase" &&
          e.referenceType === "order" && e.referenceId === String(orderId)) {
        return e;
      }
    }
    return null;
  }

  const getBalance = (customerId) => balances.get(customerId) ?? 0;

  return { ensureCustomer, apply, findEarnForOrder, getBalance, _entries: entries };
}
