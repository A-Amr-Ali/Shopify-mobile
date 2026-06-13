// Pure trigger evaluation (no DB) — unit-tested in isolation. The .server.js
// sibling re-exports this and adds the Supabase freshness/cooldown checks.
import { TRIGGERS } from "../../config/brand-voice.js";

const HOUR = 3600e3, DAY = 864e5;
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * @param {object} snap  a buildSnapshot() result
 * @param {number} now   epoch ms (injectable for tests)
 * @returns {Array<{trigger:string, dedupeKey:string, context:object}>}
 * At most one candidate — the highest-intent trigger wins, so we never stack
 * messages on one person in a single run.
 */
export function evaluateTriggers(snap, now = Date.now()) {
  const out = [];
  if (!snap?.customerId) return out;
  const id = snap.customerId;

  // 1) Abandoned cart — highest intent. A checkout aged past the window that
  //    hasn't turned into a purchase.
  const ac = TRIGGERS.abandoned_cart;
  if (ac.enabled && snap.lastCheckout?.at) {
    const ageH = (now - new Date(snap.lastCheckout.at).getTime()) / HOUR;
    const converted = snap.lastPurchase &&
      new Date(snap.lastPurchase.at).getTime() >= new Date(snap.lastCheckout.at).getTime();
    if (ageH >= ac.afterHours && ageH < 14 * 24 && !converted && (snap.lastCheckout.items?.length || 0) > 0) {
      out.push({
        trigger: "abandoned_cart",
        dedupeKey: `${id}:abandoned_cart:${snap.lastCheckout.token || ymd(snap.lastCheckout.at)}`,
        context: { items: snap.lastCheckout.items, valueEgp: snap.lastCheckout.valueEgp },
      });
    }
  }

  // 2) Post-purchase pairing — a paid order that's had time to arrive.
  const pp = TRIGGERS.post_purchase;
  if (!out.length && pp.enabled && snap.lastPurchase?.at) {
    const ageD = (now - new Date(snap.lastPurchase.at).getTime()) / DAY;
    if (ageD >= pp.afterDays && ageD < pp.afterDays + 14) {
      out.push({
        trigger: "post_purchase",
        dedupeKey: `${id}:post_purchase:${snap.lastPurchase.token || ymd(snap.lastPurchase.at)}`,
        context: { items: snap.lastPurchase.items },
      });
    }
  }

  // 3) Browsed, didn't buy — repeated interest with no checkout/purchase.
  const bn = TRIGGERS.browse_no_buy;
  if (!out.length && bn.enabled && snap.viewed.length >= bn.minViews) {
    const recentBuy = snap.lastPurchase &&
      (now - new Date(snap.lastPurchase.at).getTime()) / DAY < bn.windowDays;
    const recentCheckout = snap.lastCheckout &&
      (now - new Date(snap.lastCheckout.at).getTime()) / DAY < bn.windowDays;
    if (!recentBuy && !recentCheckout) {
      out.push({
        trigger: "browse_no_buy",
        dedupeKey: `${id}:browse_no_buy:${ymd(now)}`, // once per day at most
        context: { viewed: snap.viewed.slice(0, 5) },
      });
    }
  }

  // 4) Win back — lapsed since their last purchase, none recently.
  const wb = TRIGGERS.win_back;
  if (!out.length && wb.enabled && snap.lastPurchase?.at && snap.purchaseCount === 0) {
    const ageD = (now - new Date(snap.lastPurchase.at).getTime()) / DAY;
    if (ageD >= wb.afterDays) {
      out.push({
        trigger: "win_back",
        dedupeKey: `${id}:win_back:${ymd(now).slice(0, 7)}`, // once per month
        context: { tier: snap.tier },
      });
    }
  }

  return out;
}
