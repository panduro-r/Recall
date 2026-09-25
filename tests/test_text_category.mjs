import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirements,assess,ranked,validateCatalog,comparisonPair,comparisonLink,comparisonContext,comparisonViewLink,comparisonReturn,withComparisonReturn,withSavedOption,readSaved} from '../ui/compare-model.js';
import {assessmentAvailable,assessmentNotice,workload,extraCondition,unitPrice} from '../ui/service-categories.js';
import {sha,reviewLink,selection,validateCapture,validSession,outcome,REVIEWS,REVIEW_VERSION} from '../ui/review-model.js';
import {buildComparisonReport,comparisonReportHTML} from '../ui/comparison-report.js';
import {readReviewIndex,matchingReview} from '../ui/review-index.js';
import {ZERO} from '../ui/wallet.js';
const catalog=JSON.parse(readFileSync('ui/service-catalog.json'));
const plan=id=>catalog.plans.find(p=>p.id===id),now=Date.parse('2026-09-15T18:00:00Z');
const req={category:'text',inputTokens:1000000,outputTokens:200000,budget:50,noTraining:true,streaming:false};
const audio={hours:100,budget:50,noTraining:true,speakers:false};
const speech={category:'speech',characters:1000000,budget:50,noTraining:true,streaming:true,utf8Bytes:null};

test('text expands the catalog without mixing three distinct workloads',()=>{
  assert.equal(validateCatalog(catalog),catalog);
  assert.equal(catalog.plans.length,17);assert.equal(new Set(catalog.plans.map(p=>p.provider)).size,13);
  assert.equal(ranked(catalog,audio,now).length,9);assert.equal(ranked(catalog,speech,now).length,3);
  assert.equal(ranked(catalog,req,now).length,5);
  assert.deepEqual(new Set(ranked(catalog,req,now).map(r=>r.plan.provider)),new Set(['openai','anthropic','google','mistral','deepseek']));
  assert.throws(()=>assess(plan('openai-mini'),audio));
  assert.throws(()=>assess(plan('fish-speech'),req));
});
test('text validates both bounded token counts, exact fields and boolean conditions',()=>{
  assert.deepEqual(requirements({...req,inputTokens:'1000000',outputTokens:'200000',budget:'50.00'}),req);
  for(const field of ['inputTokens','outputTokens'])for(const value of ['',null,undefined,true,[],{},0,-1,1.5,Infinity,NaN,1000000001])assert.throws(()=>requirements({...req,[field]:value}));
  for(const patch of [{hours:100},{characters:100},{utf8Bytes:null},{speakers:false},{streaming:'true'},{noTraining:'false'},{category:'unknown'},{category:'constructor'},{budget:1.001}])assert.throws(()=>requirements({...req,...patch}));
  assert.equal(requirements({...req,inputTokens:1000000000,outputTokens:1}).inputTokens,1000000000);
  for(const outputRate of [undefined,0,-1,NaN,'0.01'])assert.throws(()=>validateCatalog({...catalog,plans:[{...plan('openai-mini'),outputRate}]}));
  for(const requiresPaidTier of [false,'true',null])assert.throws(()=>validateCatalog({...catalog,plans:[{...plan('google-flash'),requiresPaidTier}]}));
  assert.throws(()=>validateCatalog({...catalog,plans:[{...plan('deepseek-flash'),requiresPaidTier:true}]}));
});
test('monthly cost includes uncached input and billed output, with rounding only after addition',()=>{
  for(const [id,cost] of [['openai-mini',1.65],['anthropic-haiku',2],['google-flash',1.5],['mistral-small',0.27],['deepseek-flash',0.54]])assert.equal(assess(plan(id),req).estimate,cost,id);
  const result=assess(plan('openai-mini'),req);
  assert.equal(result.inputCost,0.75);assert.equal(result.outputCost,0.9);
  assert.equal(assess(plan('openai-mini'),{...req,outputTokens:1000000}).estimate,5.25);
  const tiny={...plan('openai-mini'),rate:0.004,outputRate:0.004};
  assert.equal(assess(tiny,{...req,inputTokens:1,outputTokens:1}).estimate,0.01);
  assert.match(unitPrice(plan('openai-mini'),result),/\$0.75 input.*\$4.50 output \/ million tokens/);
  assert.equal(assess(plan('openai-mini'),{...req,budget:1}).status,'over-budget');
});
test('opt-outs, unknown policy, streaming uncertainty and stale rates never become confirmed fits',()=>{
  assert.equal(assess(plan('mistral-small'),req).trainingConditional,true);
  assert.equal(assess(plan('mistral-small'),req).status,'confirm');
  assert.equal(assess(plan('mistral-small'),{...req,noTraining:false}).status,'fit');
  assert.equal(assess(plan('mistral-small'),{...req,noTraining:false,streaming:true}).status,'confirm');
  assert.equal(assess(plan('deepseek-flash'),req).trainingUnknown,true);
  assert.equal(assess(plan('deepseek-flash'),req).status,'confirm');
  for(const id of ['openai-mini','anthropic-haiku'])assert.equal(assess(plan(id),req).status,'fit');
  assert.equal(assess(plan('google-flash'),req).status,'confirm');
  assert.equal(assess(plan('google-flash'),{...req,noTraining:false}).status,'confirm');
  assert.equal(assess(plan('google-flash'),req).paidTierRequired,true);
  assert.match(plan('google-flash').trainingNote,/paid|billing/i);assert.match(plan('google-flash').priceNote,/2027/);
  assert.ok(ranked(catalog,req,now+8*86400000).every(r=>r.result.status==='confirm'));
});
test('review links, comparison state and return links preserve every text requirement',()=>{
  for(const r of [req,{...req,inputTokens:37,outputTokens:25,budget:10.13,noTraining:false,streaming:true}]){
    const href=reviewLink('openai-mini',r);assert.deepEqual(selection(href.split('#')[1],catalog).requirements,r);
    assert.deepEqual(comparisonContext(comparisonLink(r,'openai-mini').split('#')[1]).requirements,r);
    const back=comparisonViewLink(r,['openai-mini','google-flash']);
    const review=withComparisonReturn(href,back);
    assert.equal(comparisonReturn(review.split('#')[1],catalog,'openai-mini',r),back);
  }
  const hash=comparisonLink(req).split('#')[1];
  for(const bad of [hash+'&outputTokens=1',hash+'&hours=100',hash.replace('&outputTokens=200000',''),hash.replace('streaming=false','streaming=maybe')])assert.throws(()=>comparisonContext(bad));
  assert.throws(()=>selection(reviewLink('fish-speech',req).split('#')[1],catalog));
  const pair=comparisonPair(catalog,req,['fish-speech','openai-mini'],now);
  assert.equal(pair[0],'openai-mini');assert.ok(pair.every(id=>plan(id).category==='text'));
});
test('mixed-category saved options retain independent requirements across reload',()=>{
  let rows=withSavedOption(null,catalog,'assembly-pro',audio,new Date(now).toISOString());
  rows=withSavedOption(JSON.stringify(rows),catalog,'fish-speech',speech,new Date(now).toISOString());
  const before=JSON.stringify(rows);
  rows=withSavedOption(before,catalog,'openai-mini',req,new Date(now).toISOString());
  assert.equal(rows.length,3);assert.deepEqual(rows.slice(1),JSON.parse(before));
  assert.deepEqual(readSaved(JSON.stringify(rows),catalog),rows);
  assert.throws(()=>withSavedOption(JSON.stringify(rows),catalog,'openai-mini',speech));
});
test('text reports disclose costs and do not invent a saved assessment',()=>{
  const report=buildComparisonReport(catalog,req,['openai-mini','mistral-small'],{entries:[]},now);
  const html=comparisonReportHTML(report);
  assert.match(html,/1,000,000 input \+ 200,000 output tokens/);assert.match(html,/Input \+ output cost/);
  assert.match(html,/\$0.75 input \+ \$0.90 output/);assert.match(html,/Streaming text/);
  assert.match(html,/billed reasoning/);assert.ok(!html.includes(assessmentNotice));
  const unvalidated=buildComparisonReport(catalog,req,['google-flash'],{entries:[]},now);
  assert.ok(comparisonReportHTML(unvalidated).includes(assessmentNotice));
  assert.match(comparisonReportHTML(unvalidated),/active billing/);
  assert.match(html,/Resolve the open pricing/);assert.doesNotMatch(html,/audio hours|Speaker labels|<script/);
  assert.match(workload(req),/output tokens/);assert.equal(extraCondition({...req,streaming:true}),'Streaming text required');
  assert.throws(()=>buildComparisonReport(catalog,req,['openai-mini','fish-speech'],{entries:[]},now));
});
test('captured text evidence survives reload but cannot accept an audio v6 assessment',async()=>{
  const p=plan('openai-mini'),text='Synthetic text API evidence only. This fixture is not a provider assessment. It has sufficient length for capture integrity checks.';
  const evidence={version:1,plan:p,requirements:req,capturedAt:new Date(now).toISOString(),documents:await Promise.all(p.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(evidence),row={id:'text-fixture',evidence,payload,digest:await sha(payload)};
  await validateCapture(row,catalog);assert.equal(outcome(row,now).label,'Not assessed yet');
  const store={getItem:k=>k===REVIEWS?JSON.stringify([row]):null};
  const index=await readReviewIndex(store,catalog,now);
  assert.equal(index.unavailable,false);assert.equal(matchingReview(index,p.id,req).report,null);
  assert.equal(assessmentAvailable(req),false);assert.equal(assessmentAvailable(req,p),true);
  assert.equal(assessmentAvailable(req,plan('google-flash')),false);
  assert.equal(assessmentAvailable(audio),true);assert.equal(assessmentAvailable(speech),true);
  const account='0x'+'1'.repeat(40),hash='0x'+'2'.repeat(64),source='3'.repeat(64);
  const review={action:'deploy',account,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const entry={id:'entry',requestId:row.id,hash,review,phase:'complete'};
  const results=['service_api','service_batch','service_english','service_channels','training'].map(id=>({id,verdict:'SUPPORTED',reason:'Synthetic audio result.',citations:[{source:p.sources[0],quote:text}]}));
  const session={deployment:hash,receipt,state:{version:REVIEW_VERSION,kind:'provider-review',account,digest:row.digest,evidence_json:payload,complete:true,review_status:'completed',results}};
  assert.equal(validSession(session,row,entry),false);
  const bad=structuredClone(row);bad.evidence.requirements=audio;bad.payload=JSON.stringify(bad.evidence);bad.digest=await sha(bad.payload);
  await assert.rejects(validateCapture(bad,catalog),/category/);
});
test('earlier Google snapshots remain readable, but new captures require current sources',async()=>{
  const previous=catalog.reviewSourceHistory['google-flash'][0],p={...plan('google-flash'),sources:previous,reviewedAt:'2026-09-15'};
  const evidence={version:1,plan:p,requirements:req,capturedAt:new Date(now).toISOString(),documents:await Promise.all(previous.map(async id=>{
    const text=`Historical public Google evidence for ${id}. This fixture checks source identity and preservation only, not policy claims or assessment quality.`;
    return {id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)};
  }))};
  const payload=JSON.stringify(evidence),bundle={evidence,payload,digest:await sha(payload)};
  await validateCapture(bundle,catalog,{historical:true});
  await assert.rejects(validateCapture(bundle,catalog),/sources/);
});
