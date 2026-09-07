import test from 'node:test';
import assert from 'node:assert/strict';
import {wei, request, offer, pack, unpack, sameRequest, readDrafts, MAX_LINK} from '../ui/workspace-model.js';
const req = {version:1,id:'request-1234',title:'Customer support API',budget:'0.050',conditions:['Customer inputs must not be used to train a model.']};
const reply = {request:req,seller:'0x'+'2'.repeat(40),price:'0.040',terms:'Customer inputs and outputs are never retained for model training.'};
test('amount conversion uses exact integers, never floating point', () => {
  assert.equal(wei('0.040'), '40000000000000000');
  assert.equal(wei('.000001'), '1000000000000');
  for (const bad of ['0','-1','1','0.101','0.0000001','0x1','1e-3','NaN','Infinity','0.1junk',null]) assert.throws(() => wei(bad));
});
test('request links roundtrip Unicode text and discard unexpected fields', () => {
  const input = {...req,title:'Assistance — clientèle',privateKey:'must not be serialized'};
  const decoded = unpack(pack('request',input));
  assert.equal(decoded.value.title,input.title);
  assert.equal(decoded.value.privateKey,undefined);
  assert.equal(decoded.kind,'request');
});
test('supplier replies roundtrip exact request and terms, including hostile text as data', () => {
  const input = {...reply,terms:'<script>alert("not executable")</script> '+reply.terms};
  assert.deepEqual(unpack(pack('offer',input)),{kind:'offer',value:input});
});
test('reject invalid, oversized, unsupported or malformed links', () => {
  for (const hash of ['#foo','https://evil.test','#share=???','#share=aaa','#share='+ 'a'.repeat(MAX_LINK+1), '#share='+btoa('{"kind":"execute"}')]) assert.throws(() => unpack(hash));
});
test('request matching detects changed title, budget, and conditions', () => {
  assert.ok(sameRequest(req,structuredClone(req)));
  assert.ok(!sameRequest(req,{...req,title:'A different purchase'}));
  assert.ok(!sameRequest(req,{...req,budget:'0.060'}));
  assert.ok(!sameRequest(req,{...req,conditions:['A completely different requirement.']}));
});
test('unfinished template and invalid criteria cannot be shared', () => {
  for (const conditions of [[],['short'],['Deliver by [enter a date and time zone].'],Array(9).fill('A proper condition here.'),['a'.repeat(501)],Array(3).fill('a'.repeat(500))]) assert.throws(() => request({...req,conditions}));
});
test('supplier price is bounded by budget and wallet/terms are validated', () => {
  for (const change of [{price:'0.060'},{seller:'0x'+'0'.repeat(40)},{seller:'secret'},{terms:'too short'},{terms:'a'.repeat(6001)}]) assert.throws(() => offer({...reply,...change}));
});
test('corrupt local data is not treated as an empty store', () => {
  assert.deepEqual(readDrafts({getItem:()=>null}),[]);
  for (const raw of ['broken','{}','[null]']) assert.throws(() => readDrafts({getItem:()=>raw}));
});
