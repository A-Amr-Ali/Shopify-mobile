import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryPilot,discoveryDecision } from '../src/discovery.mjs';
const now=Date.parse('2026-10-16T12:00:00Z');
const config={...discoveryPilot,enabled:true};
const purchase={ownerVerified:true,receiptVerified:true,variantId:config.mini.variantId,locationId:config.locationId,paid:true,handedOver:true,handedOverAt:'2026-10-15T12:00:00Z',fullSizeAvailable:1,participants:0};
test('the discovery credit is held until commercial terms are approved',()=>assert.equal(discoveryDecision(purchase).reason,'pilot_not_live'));
test('an approved pilot is limited to the exact paid local mini and available full size',()=>{
  assert.equal(discoveryDecision(purchase,{config,now}).creditEgp,250);
  for(const change of [{ownerVerified:false},{receiptVerified:false},{variantId:'other'},{locationId:'other'},{paid:false},{handedOver:false},{refunded:true},{cancelled:true},{alreadyRedeemed:true},{participants:20},{handedOverAt:'2026-08-01T12:00:00Z'},{fullSizeAvailable:0}])assert.equal(discoveryDecision({...purchase,...change},{config,now}).eligible,false);
});
