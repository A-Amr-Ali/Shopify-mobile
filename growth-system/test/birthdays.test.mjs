import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntilBirthday, normalizeCustomerHistory } from '../src/birthdays-core.mjs';

test('daysUntilBirthday uses the Cairo calendar and rolls into next year', () => {
  assert.equal(daysUntilBirthday('1990-10-24', new Date('2026-10-24T06:00:00Z')), 0);
  assert.equal(daysUntilBirthday('1990-10-25', new Date('2026-10-24T06:00:00Z')), 1);
  assert.equal(daysUntilBirthday('1990-01-01', new Date('2026-10-24T06:00:00Z')), 69);
});

test('normalizeCustomerHistory excludes cancelled and test orders', () => {
  const history=normalizeCustomerHistory({numberOfOrders:3,amountSpent:{amount:'1400',currencyCode:'EGP'},orders:{nodes:[
    {name:'#3',test:true,processedAt:'2026-03-01',currentTotalPriceSet:{shopMoney:{amount:'100',currencyCode:'EGP'}}},
    {name:'#2',cancelledAt:'2026-02-01',processedAt:'2026-02-01',currentTotalPriceSet:{shopMoney:{amount:'200',currencyCode:'EGP'}}},
    {name:'#1',processedAt:'2026-01-01',displayFinancialStatus:'PAID',currentTotalPriceSet:{shopMoney:{amount:'1400',currencyCode:'EGP'}}}
  ]}});
  assert.equal(history.hasOrdered,true); assert.equal(history.orderCount,3); assert.equal(history.lastOrder.name,'#1'); assert.equal(history.lifetimeSpend.amount,1400);
});
