import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePrepared,receiptMatches,Wallet,NEXT_CHAIN_ID,formatTestGen} from '../ui/wallet.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/studio-next-plan.json',import.meta.url)));
const plan=()=>({...structuredClone(fixture),prepared_at:Date.now()/1000});
const account=fixture.review.account;
test('fee deposit display preserves every wei without floating point',()=>{
  assert.equal(formatTestGen('20000000000033882'),'0.020000000000033882');
  assert.equal(formatTestGen('1'),'0.000000000000000001');
  assert.equal(formatTestGen('0'),'0');
  assert.throws(()=>formatTestGen('-1'));
});
test('accept SDK-encoded bounded Next review; separate protocol deposit from user value',()=>{
  const p=plan();assert.equal(validatePrepared(p,account),p.transaction);assert.equal(p.review.value_wei,'0');
});
for(const [name,change] of [
  ['network',p=>p.transaction.chainId='0xf22f'],['router',p=>p.transaction.to=account],
  ['review router',p=>p.review.router=account],['fee cap',p=>p.review.protocol_fee_wei='50000000000000001'],
  ['hidden user payment',p=>p.review.value_wei='1'],['unreviewed deposit',p=>p.transaction.value='0x1'],
  ['changed method',p=>p.transaction.data=p.transaction.data.replace('35a251fb','35a251fc')],
  ['trailing calldata',p=>p.transaction.data+='0'.repeat(64)],
  ['changed distribution',p=>p.review.fee_distribution.leaderTimeunitsAllocation='1']]){
  test(`reject Next ${name}`,()=>{const p=plan();change(p);assert.throws(()=>validatePrepared(p,account));});
}
for(const byte of [0,32,64,96,128,160,192,224,256,288,320,416,480,512,672,704]){
  test(`reject altered ABI field at byte ${byte}`,()=>{const p=plan(),at=10+byte*2;p.transaction.data=p.transaction.data.slice(0,at)+'f'.repeat(64)+p.transaction.data.slice(at+64);assert.throws(()=>validatePrepared(p,account));});
}
test('Next receipts cannot be satisfied by legacy or missing network identity',()=>{
  const r=fixture.review,row={status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',source_sha256:r.source_sha256,args:r.args,protocol_fee_deposit_wei:r.protocol_fee_wei};
  assert.equal(receiptMatches(row,r),false);row.chain_id=61997;assert.equal(receiptMatches(row,r),true);row.protocol_fee_deposit_wei='1';assert.equal(receiptMatches(row,r),false);
});
test('Next network switch uses canonical RPC and never signs',async()=>{
  const calls=[],w=new Wallet({request:async data=>{calls.push(data);if(data.method==='wallet_switchEthereumChain'&&calls.length===1)throw {code:4902};if(data.method==='eth_requestAccounts')return [account];}});
  await w.switchNetwork(NEXT_CHAIN_ID);
  assert.equal(calls.find(c=>c.method==='wallet_addEthereumChain').params[0].rpcUrls[0],'https://studio-dev.genlayer.com/api');
  assert.equal(calls.some(c=>c.method==='eth_sendTransaction'),false);
});
