import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirements,assess,ranked,isStale,readSaved,brief,SAVED_KEY,reviewDate,validateCatalog} from '../ui/compare-model.js';
const catalog = JSON.parse(readFileSync('ui/service-catalog.json','utf8'));
const now = Date.parse('2026-09-09T12:00:00Z');
const base = {hours:100,budget:50,noTraining:true,speakers:false};
const plan = id => catalog.plans.find(p=>p.id===id);
test('catalog has explicit official source attribution and bounded plan scope',()=>{
  assert.equal(new Set(catalog.plans.map(p=>p.provider)).size,6);
  assert.equal(catalog.plans.length,7);
  assert.equal(validateCatalog(catalog),catalog);
  for(const p of catalog.plans){assert.ok(p.rate>0);assert.ok(['hour','minute'].includes(p.unit));assert.equal(p.sources.length,p.id==='speechmatics-standard'?4:2);for(const key of p.sources){assert.equal(catalog.sources[key].provider,p.provider);assert.equal(new URL(catalog.sources[key].url).protocol,'https:');}}
});
test('public prices do not falsely satisfy a no-training requirement',()=>{
  const rows=ranked(catalog,base,now);
  assert.deepEqual(rows.filter(r=>r.result.status==='fit').map(r=>r.plan.id),['speechmatics-standard']);
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
  assert.equal(isStale(catalog,Date.parse('2026-09-07T20:00:00Z')),true);
  assert.equal(assess(plan('assembly-pro'),{...base,noTraining:false},true).status,'confirm');
});
test('new providers use configuration-specific rates and token estimates stay conditional',()=>{
  assert.equal(assess(plan('speechmatics-standard'),base).estimate,45);
  assert.equal(assess(plan('speechmatics-standard'),{...base,speakers:true}).estimate,45);
  assert.equal(assess(plan('speechmatics-standard'),{...base,budget:44}).status,'over-budget');
  assert.equal(assess(plan('soniox-async'),base).estimate,10);
  assert.equal(assess(plan('soniox-async'),{...base,noTraining:false,budget:1000000}).status,'confirm');
  assert.equal(assess(plan('soniox-async'),{...base,speakers:true}).estimate,10);
  assert.match(assess(plan('soniox-async'),base).costLabel,/token-based/);
  assert.equal(assess(plan('aws-transcribe-batch'),base).estimate,36);
  assert.equal(assess(plan('aws-transcribe-batch'),base).status,'confirm');
  assert.equal(assess(plan('aws-transcribe-batch'),{...base,noTraining:false,speakers:true}).status,'fit');
  assert.match(plan('aws-transcribe-batch').plan,/N\. Virginia/);
});
test('each plan keeps its own review date without refreshing legacy evidence',()=>{
  assert.equal(reviewDate(catalog,plan('deepgram-nova')),'2026-09-08');
  assert.equal(reviewDate(catalog,plan('soniox-async')),'2026-09-09');
  const rows = ranked(catalog,{...base,noTraining:false},Date.parse('2026-09-15T12:00:00Z'));
  assert.equal(rows.find(r=>r.plan.id==='deepgram-nova').result.stale,true);
  assert.equal(rows.find(r=>r.plan.id==='speechmatics-standard').result.stale,false);
  const p=plan('soniox-async'),text=brief(catalog,p,base,assess(p,base));
  assert.match(text,/Catalog pricing and policy reviewed: 2026-09-09/);
  assert.match(text,/Approximate token-based cost: USD 10.00/);
});
test('catalog validation permits growth but rejects malformed or unsafe rows',()=>{
  assert.doesNotThrow(()=>validateCatalog({...catalog,plans:catalog.plans.slice(0,1)}));
  for(const patch of [{rate:-1},{rate:null},{unit:'token'},{pricing:'unknown'},{training:'unknown'},{diarization:-1},{reviewedAt:'2026-02-31'},{url:'javascript:alert(1)'},{sources:['missing']},{sources:['soniox-price']}]){
    assert.throws(()=>validateCatalog({...catalog,plans:[{...plan('assembly-pro'),...patch}]}));
  }
  assert.throws(()=>validateCatalog({...catalog,plans:[]}));
  assert.throws(()=>validateCatalog({...catalog,plans:[plan('assembly-pro'),plan('assembly-pro')]}));
  assert.throws(()=>validateCatalog({...catalog,sources:{...catalog.sources,'assembly-price':{...catalog.sources['assembly-price'],url:'https://user:secret@example.com'}}}));
});
test('existing and newly added saved options survive catalog expansion together',()=>{
  const saved=['assembly-pro','speechmatics-standard','soniox-async','aws-transcribe-batch'].map(planId=>({planId,requirements:base,savedAt:new Date(now).toISOString()}));
  assert.deepEqual(readSaved(JSON.stringify(saved),catalog),saved);
});
test('source history is a bounded provider-owned read compatibility list',()=>{
  assert.deepEqual(catalog.reviewSourceHistory['speechmatics-standard'],[['speechmatics-price','speechmatics-terms']]);
  for(const history of [null,[],{'speechmatics-standard':'any'},{'speechmatics-standard':[[]]},
    {'speechmatics-standard':[['speechmatics-price','speechmatics-price']]},
    {'speechmatics-standard':[['soniox-price']]},
    {'speechmatics-standard':[['missing']]},
    {'speechmatics-standard':Array(9).fill(['speechmatics-price'])}
  ])assert.throws(()=>validateCatalog({...catalog,reviewSourceHistory:history}));
  assert.equal(plan('speechmatics-standard').reviewedAt,'2026-09-09','adding technical sources does not revalidate the pricing date');
  assert.equal(plan('speechmatics-standard').rate,0.45);
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
