export const discoveryPilot = Object.freeze({
  id:'cheirosa62-discovery-20261016', enabled:false, creditEgp:500, maxParticipants:20, redeemWithinDays:30,
  mini:{handle:'brazilian-crush-cheirosa-62-bum-bum-hair-body-fragrance-mist',variantId:'40432045654087',size:'90 mL'},
  full:{handle:'brazilian-crush-cheirosa-62-bum-bum-hair-body-fragrance-mist',variantId:'40432045621319',size:'240 mL'},
  locationId:'gid://shopify/Location/62367334471',
  terms:['One credit per signed-in customer after a paid mini has been handed over locally.','Receipt and exact mini variant must be verified by staff.','Credit applies only to the listed full-size option, subject to stock.','Single use within 30 days of mini handover; no stacking or cash value.','Returned or refunded qualifying purchases do not qualify. Statutory return rights remain unchanged.','Delivery charges are separate. No SOFIE NOW eligibility is added by this pilot.']
});

export function discoveryDecision(purchase, {config=discoveryPilot,now=Date.now()}={}) {
  if (!config.enabled) return {eligible:false,reason:'pilot_not_live'};
  if (!purchase?.ownerVerified || !purchase?.receiptVerified) return {eligible:false,reason:'verify_owner_and_receipt'};
  if (purchase.variantId !== config.mini.variantId || purchase.locationId !== config.locationId) return {eligible:false,reason:'wrong_purchase'};
  if (!purchase.paid || !purchase.handedOver || purchase.refunded || purchase.cancelled) return {eligible:false,reason:'purchase_not_eligible'};
  if (purchase.alreadyRedeemed || purchase.participants >= config.maxParticipants) return {eligible:false,reason:'limit_reached'};
  const handedOver = Date.parse(purchase.handedOverAt);
  if (!Number.isFinite(handedOver) || handedOver > now || now - handedOver > config.redeemWithinDays*86400000) return {eligible:false,reason:'outside_window'};
  if (!(purchase.fullSizeAvailable > 0)) return {eligible:false,reason:'full_size_unavailable'};
  return {eligible:true,creditEgp:config.creditEgp,fullSizeVariantId:config.full.variantId};
}
