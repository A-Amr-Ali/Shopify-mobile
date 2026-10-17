import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBirthday,cairoDate,birthdayWindow,purchaseMultiplier,estimatePoints,staffReceipt} from '../app/lib/rewards-core.js';

test('birthday saves only month/day, validates calendar dates, permits leap birthdays',()=>{
 assert.equal(normalizeBirthday({month:2,day:29}),'2000-02-29');
 assert.equal(normalizeBirthday({birthday:'1985-12-31'}),'2000-12-31');
 for(const value of [{month:2,day:30},{month:4,day:31},{month:0,day:3},{month:1.5,day:2},{month:13,day:1},{month:1,day:0},{birthday:'2020-99-99'},{}])assert.throws(()=>normalizeBirthday(value));
});
test('Cairo birthday clock follows local date at the UTC boundary',()=>{
 const d=cairoDate(new Date('2026-10-16T22:30:00Z'));assert.equal(d.day,17);assert.equal(d.month,10);assert.equal(d.year,2026);
});
test('birthday credits require opt in and last exactly 45 calendar days',()=>{
 const c={birthday:'2000-10-17',birthday_opt_in:true};
 assert.equal(birthdayWindow(c,new Date('2026-10-16T12:00Z')).eligible,false);
 assert.equal(birthdayWindow(c,new Date('2026-10-17T12:00Z')).eligible,true);
 assert.equal(birthdayWindow(c,new Date('2026-11-30T12:00Z')).eligible,true);
 assert.equal(birthdayWindow(c,new Date('2026-12-01T12:00Z')).eligible,false);
 assert.equal(birthdayWindow({...c,birthday_opt_in:false},new Date('2026-10-17T12:00Z')).eligible,false);
});
test('birthday window handles December gifts in January and February 29 in nonleap years',()=>{
 const d=birthdayWindow({birthday:'2000-12-25',birthday_opt_in:true},new Date('2027-01-05T12:00Z'));assert.equal(d.eligible,true);assert.equal(d.year,2026);
 assert.equal(birthdayWindow({birthday:'2000-02-29',birthday_opt_in:true},new Date('2027-02-28T12:00Z')).eligible,true);
 assert.equal(birthdayWindow({birthday:'2000-02-29',birthday_opt_in:true},new Date('2028-02-28T12:00Z')).eligible,false);
});
test('VIP and Icon earn double their usual points only in opted-in birthday month',()=>{
 const now=new Date('2026-10-17T12:00Z'),c={birthday:'2000-10-01',birthday_opt_in:true};
 assert.equal(purchaseMultiplier({...c,tier:'insider'},now),1);
 assert.equal(purchaseMultiplier({...c,tier:'vip'},now),2.5);
 assert.equal(purchaseMultiplier({...c,tier:'icon'},now),3);
 assert.equal(purchaseMultiplier({...c,tier:'vip',birthday_opt_in:false},now),1.25);
 assert.equal(purchaseMultiplier({...c,tier:'icon'},new Date('2026-11-01T12:00Z')),1.5);
});
test('product points follow order rounding, quantity and multiplier rules',()=>{
 const now=new Date('2026-01-01T12:00Z');
 assert.equal(estimatePoints(750000,1,{tier:'insider'},now),750);
 assert.equal(estimatePoints(750000,2,{tier:'vip'},now),1875);
 assert.equal(estimatePoints(999,1,{tier:'insider'},now),1);
 assert.equal(estimatePoints(10000,0,{tier:'insider'},now),0);
 assert.equal(estimatePoints(10000,1.5,{tier:'insider'},now),0);
});
test('store transactions require a branch and safe receipt reference',()=>{
 assert.deepEqual(staffReceipt({branch:' Mivida ',receipt:' MIV-123/1 '}),{branch:'Mivida',receipt:'MIV-123/1'});
 for(const body of [{},{branch:'Mivida'},{branch:'Mivida',receipt:'<script>'},{branch:'x'.repeat(61),receipt:'123'}])assert.throws(()=>staffReceipt(body));
});
