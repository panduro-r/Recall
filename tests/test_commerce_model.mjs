import test from 'node:test';
import assert from 'node:assert/strict';
import {Commerce,JOURNAL,nextSteps,paymentVerified,matchesIntent} from '../ui/commerce-model.js';
const buyer='0x'+'1'.repeat(40),seller='0x'+'2'.repeat(40),contract='0x'+'3'.repeat(40),txhash='0x'+'a'.repeat(64);
const config={source_sha256:'b'.repeat(64)};
const session=()=>({contract,state:{buyer,seller,expires_at:2000,accepted:true,paid:false,offers:[{id:'offer-1',status:'VALID',permit:'RESERVED',amount_wei:'40000000000000000',review_until:1000,counter_terms:''}]}});
function fixture(){
  const data=new Map(),s=session();
  const request={account:buyer,action:'execute_purchase',deployment:'0x'+'d'.repeat(64),fields:{offer_id:'offer-1'}};
  const plan={review:{action:request.action,account:buyer,contract,recipient:seller,value_wei:'40000000000000000',args:['offer-1'],chain_id:61999,source_sha256:config.source_sha256}};
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const calls=[];let response=plan;
  const c=new Commerce({storage,call:async r=>{calls.push(r);return response;},locks:{request:async(_,__,fn)=>fn({})},now:()=>0,id:()=>String(data.size+1)});
  return {c,storage,request,plan,s,calls,setResponse:r=>response=r};
}
test('buyer alone sees payment after review; supplier never sees pay',()=>{
  const s=session();
  assert.ok(!nextSteps(s,buyer,1004).actions.some(a=>a.action==='execute_purchase'));
  assert.ok(nextSteps(s,buyer,1005).actions.some(a=>a.action==='execute_purchase'));
  assert.ok(!nextSteps(s,seller,1005).actions.some(a=>a.action==='execute_purchase'));
  assert.ok(!nextSteps(s,buyer,1995).actions.some(a=>a.action==='execute_purchase'));
});
test('disputed, invalid, unknown, canceled and consumed offers cannot pay',()=>{
  for(const status of ['DISPUTED','INVALID','UNKNOWN']){const s=session();s.state.offers[0].status=status;assert.ok(!nextSteps(s,buyer,1100).actions.some(a=>a.action==='execute_purchase'));}
  for(const permit of ['CANCELLED','SCHEDULED']){const s=session();s.state.offers[0].permit=permit;assert.ok(!nextSteps(s,buyer,1100).actions.some(a=>a.action==='execute_purchase'));}
});
test('review must match action, account, source, recipient, amount and selected offer',()=>{
  const f=fixture();assert.ok(matchesIntent(f.plan,f.request,config,f.s));
  for(const [key,value] of [['recipient',buyer],['value_wei','1'],['account',seller],['source_sha256','x'],['args',['offer-2']],['action','cancel_purchase']]){
    const p=structuredClone(f.plan);p.review[key]=value;assert.ok(!matchesIntent(p,f.request,config,f.s));
  }
});
test('persist recovery record before sending, then save returned hash',async()=>{
  const f=fixture();let count=0;
  const wallet={approve:async(_,refresh,before)=>{await refresh();before();assert.equal(f.c.pending().length,1);count++;return txhash;}};
  await f.c.send({wallet,plan:f.plan,request:f.request,config,session:f.s});
  assert.equal(count,1);assert.equal(f.c.pending()[0].hash,txhash);
  await assert.rejects(()=>f.c.send({wallet,plan:f.plan,request:f.request,config,session:f.s}),/active/);
  assert.equal(count,1);
});
test('uncertain wallet outcome blocks retries and survives reload',async()=>{
  const f=fixture();const wallet={approve:async(_,__,before)=>{before();throw new Error('disconnected');}};
  await assert.rejects(()=>f.c.send({wallet,plan:f.plan,request:f.request,config,session:f.s}),/disconnected/);
  assert.equal(f.c.pending().length,1);assert.equal(f.c.pending()[0].hash,undefined);
  const other=new Commerce({storage:f.storage});assert.equal(other.pending().length,1);
});
test('explicit wallet rejection is recorded without an automatic retry',async()=>{
  const f=fixture();const wallet={approve:async(_,__,before)=>{before();throw Object.assign(new Error('rejected'),{code:4001});}};
  await assert.rejects(()=>f.c.send({wallet,plan:f.plan,request:f.request,config,session:f.s}));
  assert.equal(f.c.pending().length,0);assert.equal(f.c.entries()[0].phase,'rejected');
});
test('failed persistence stops submission',async()=>{
  const f=fixture();let sent=false;f.storage.setItem=()=>{throw new Error('quota');};
  const wallet={approve:async(_,__,before)=>{before();sent=true;return txhash;}};
  await assert.rejects(()=>f.c.send({wallet,plan:f.plan,request:f.request,config,session:f.s}),/quota/);assert.equal(sent,false);
});
test('another tab holding signing lock prevents wallet call',async()=>{
  const f=fixture();f.c.locks={request:async(_,__,fn)=>fn(null)};
  await assert.rejects(()=>f.c.send({wallet:{approve:()=>assert.fail('must not sign')},plan:f.plan,request:f.request,config,session:f.s}),/active/);
});
test('recovery refuses a hash unrelated to the exact reviewed payment',async()=>{
  const f=fixture();f.c.persist({id:'1',review:f.plan.review,phase:'pending'});
  f.setResponse({hash:txhash,status:'FINALIZED',execution:'SUCCESS',from:seller,value_wei:'0'});
  await assert.rejects(()=>f.c.check('1',txhash),/not yet/);assert.equal(f.c.pending()[0].hash,undefined);
});
test('scheduled state alone cannot claim payment; linked transfer can',()=>{
  const f=fixture(),o=f.s.state.offers[0];o.permit='SCHEDULED';
  assert.equal(paymentVerified(f.s,o,[]),false);
  const receipt={hash:txhash,status:'FINALIZED',execution:'SUCCESS',from:buyer,to:contract,value_wei:o.amount_wei,method:'execute_purchase',args:['offer-1'],settlement:'child-finalized',child:{triggered_by:txhash,status:'FINALIZED',from_address:contract,to_address:seller,value:o.amount_wei}};
  const entry={hash:txhash,review:f.plan.review,receipt};assert.ok(paymentVerified(f.s,o,[entry]));
  receipt.child.triggered_by='0x'+'c'.repeat(64);assert.equal(paymentVerified(f.s,o,[entry]),false);
});
test('corrupt journal never silently enables signing',()=>{
  const f=fixture();f.storage.setItem(JOURNAL,'broken');assert.throws(()=>f.c.pending(),/cannot be read/);
});
