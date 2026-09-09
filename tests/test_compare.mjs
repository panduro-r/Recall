import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirements,assess,ranked,isStale,readSaved,brief,SAVED_KEY} from '../ui/compare-model.js';
const catalog = JSON.parse(readFileSync('ui/service-catalog.json','utf8'));
const now = Date.parse('2026-09-08T20:00:00Z');
const base = {hours:100,budget:50,noTraining:true,speakers:false};
const plan = id => catalog.plans.find(p=>p.id===id);
test('catalog has explicit official source attribution and bounded plan scope',()=>{
  assert.equal(new Set(catalog.plans.map(p=>p.provider)).size,3);
  for(const p of catalog.plans){assert.ok(p.rate>0);assert.ok(['hour','minute'].includes(p.unit));assert.equal(p.sources.length,2);for(const key of p.sources){assert.equal(catalog.sources[key].provider,p.provider);assert.equal(new URL(catalog.sources[key].url).protocol,'https:');}}
});
test('public prices do not falsely satisfy a no-training requirement',()=>{
  const rows=ranked(catalog,base,now);
  assert.equal(rows.filter(r=>r.result.status==='fit').length,0);
  assert.equal(assess(plan('assembly-pro'),base).uncertainPrice,true);
  assert.equal(assess(plan('deepgram-nova'),base).uncertainPrice,true);
  assert.equal(assess(plan('gladia-starter'),base).status,'not-fit');
  assert.equal(assess(plan('gladia-growth'),base).budgetLabel,'Final cost not confirmed');
});
test('normalizes hourly and minute rates and adds selected features only',()=>{
  const req={...base,noTraining:false};
  assert.equal(assess(plan('deepgram-nova'),req).estimate,25.8);
  assert.equal(assess(plan('assembly-pro'),req).estimate,21);
  assert.equal(assess(plan('assembly-pro'),{...req,speakers:true}).estimate,23);
  assert.equal(assess(plan('gladia-starter'),{...req,speakers:true}).estimate,61);
  assert.equal(assess(plan('deepgram-nova'),{...req,speakers:true}).uncertainPrice,true);
  assert.equal(assess(plan('gladia-starter'),req).status,'over-budget');
  assert.equal(assess(plan('assembly-pro'),{...req,budget:21}).status,'fit');
});
test('from rates never become confirmed quotes even under a large budget',()=>{
  assert.equal(assess(plan('gladia-growth'),{...base,budget:100000,noTraining:false}).status,'confirm');
});
test('age and invalid review dates require renewed review',()=>{
  assert.equal(isStale(catalog,now),false);
  assert.equal(isStale(catalog,now+8*86400000),true);
  assert.equal(isStale({...catalog,reviewedAt:'bad'},now),true);
  assert.equal(isStale(catalog,now-86400000),true);
  assert.equal(assess(plan('assembly-pro'),{...base,noTraining:false},true).status,'confirm');
});
test('validates user numbers without losing decimal budgets',()=>{
  assert.equal(requirements({...base,budget:'10.11'}).budget,10.11);
  for(const hours of ['',0,-1,100001,1.5,Infinity,'<script>']) assert.throws(()=>requirements({...base,hours}));
  for(const budget of ['',0,-1,1000001,1.234,NaN]) assert.throws(()=>requirements({...base,budget}));
  assert.throws(()=>requirements({...base,noTraining:'true'}));
});
test('shortlist uses a separate key and validates persisted input',()=>{
  assert.equal(SAVED_KEY,'recall.shortlist.v1');
  assert.deepEqual(readSaved(null,catalog),[]);
  const row={planId:'deepgram-nova',requirements:base,savedAt:new Date(now).toISOString()};
  assert.deepEqual(readSaved(JSON.stringify([row]),catalog),[row]);
  for(const raw of ['{}','bad',JSON.stringify([{...row,planId:'untrusted'}]),JSON.stringify([{...row,requirements:{...base,hours:Infinity}}])])assert.throws(()=>readSaved(raw,catalog));
});
test('portable brief records caveats and never implies order or consent',()=>{
  const p=plan('assembly-pro'),text=brief(catalog,p,base,assess(p,base));
  assert.match(text,/Illustrative base cost only/);assert.match(text,/not a GenLayer assessment/);
  assert.match(text,/No order, provider contact, payment, or wallet action/);
  assert.match(text,/https:\/\/www.assemblyai.com\/pricing/);assert.match(text,/Not fetched during this visit/);
});
test('comparison runtime cannot sign or access purchase journals',()=>{
  const source=readFileSync('ui/compare.js','utf8');
  assert.doesNotMatch(source,/ethereum|wallet\.js|commerce-ui|eth_sendTransaction|eth_requestAccounts|localStorage\.clear|removeItem/);
  assert.match(source,/\/api\/catalog\/check/);assert.match(source,/textContent/);assert.doesNotMatch(source,/innerHTML/);
});
