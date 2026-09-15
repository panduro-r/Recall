import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirements,assess,ranked,comparisonPair,comparisonLink,comparisonContext,comparisonViewLink,comparisonReturn,withComparisonReturn,withSavedOption,readSaved,brief} from '../ui/compare-model.js';
import {categoryOf,priceText,unitPrice} from '../ui/service-categories.js';
import {sha,reviewLink,selection,validateCapture,validSession,reviewSessionIssue,outcome,REVIEWS,REVIEW_VERSION,sourceCoverage} from '../ui/review-model.js';
import {buildComparisonReport,comparisonReportHTML} from '../ui/comparison-report.js';
import {readReviewIndex,matchingReview} from '../ui/review-index.js';
import {ZERO} from '../ui/wallet.js';
const catalog=JSON.parse(readFileSync('ui/service-catalog.json'));
const plan=id=>catalog.plans.find(p=>p.id===id),now=Date.parse('2026-09-14T16:00:00Z');
const stt={hours:100,budget:50,noTraining:true,speakers:false};
const tts={category:'speech',characters:1000000,budget:50,noTraining:true,streaming:true,utf8Bytes:null};
const account='0x'+'1'.repeat(40),hash='0x'+'2'.repeat(64),source='3'.repeat(64);
async function fixture({historical=false,version=5}={}){
  const p=structuredClone(plan('fish-speech')),text='The standard voice API generates English speech from text with streaming output. Customer text and output are excluded from training after account opt-out. Local test fixture only.';
  if(historical)p.sources=catalog.reviewSourceHistory[p.id][0];
  const evidence={version:1,plan:p,requirements:tts,capturedAt:'2026-09-14T15:00:00Z',documents:await Promise.all(p.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(evidence),row={id:'speech-fixture',evidence,payload,digest:await sha(payload)};
  const review={action:'deploy',account,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const entry={id:'speech-entry',requestId:row.id,hash,review,phase:'complete'};
  const results=['speech_api','speech_english','training','streaming'].map(id=>({id,verdict:'SUPPORTED',reason:'Local fixture only.',citations:[{source:p.sources[0],quote:text}]}));
  results[2]={...results[2],verdict:'CONDITIONAL',required_actions:['Disable training in your account and confirm the effective date.']};
  const session={deployment:hash,receipt,state:{version,kind:'provider-review',account,digest:row.digest,evidence_json:payload,complete:true,review_status:'completed',results}};
  return {row,entry,session};
}
test('v6 candidate keeps the actual v5 Fish source set readable but never recaptures it as current',async()=>{
  assert.equal(REVIEW_VERSION,6);
  const {row,session,entry}=await fixture({historical:true});
  const before=JSON.stringify({row,session,entry});
  await assert.rejects(validateCapture(row,catalog),/sources/);
  await validateCapture(row,catalog,{historical:true});
  assert.equal(validSession(session,row,entry),true);
  const coverage=sourceCoverage(row.evidence,catalog);
  assert.equal(coverage.changed,true);
  assert.deepEqual(coverage.added,[catalog.sources['fish-tts-product'].label]);
  assert.deepEqual(coverage.removed,[catalog.sources['fish-tts'].label]);
  const store={getItem:k=>k===REVIEWS?JSON.stringify([{...row,session}]):k==='recall.provider-review-transactions.v1'?JSON.stringify([entry]):null};
  const index=await readReviewIndex(store,catalog,now);
  assert.equal(index.unavailable,false);
  assert.equal(matchingReview(index,'fish-speech',tts).report.version,5);
  assert.equal(JSON.stringify({row,session,entry}),before);
  const current=await fixture({version:6});
  await validateCapture(current.row,catalog);
  assert.equal(validSession(current.session,current.row,current.entry),true);
  current.session.state.version=7;
  assert.equal(reviewSessionIssue(current.session,current.row,current.entry),'update');
});
test('two distinct categories and five new configurations; old requirements stay unchanged',()=>{
  assert.deepEqual(requirements(stt),stt);
  assert.equal(ranked(catalog,stt,now).length,9);
  assert.equal(ranked(catalog,tts,now).length,3);
  assert.deepEqual(new Set(ranked(catalog,tts,now).map(r=>r.plan.provider)),new Set(['elevenlabs','fish','deepgram']));
  assert.equal(assess(plan('eleven-scribe'),stt).estimate,22);
  assert.equal(assess(plan('fish-transcribe'),stt).estimate,36);
  assert.equal(assess(plan('fish-transcribe'),stt).trainingUnknown,true);
  assert.throws(()=>assess(plan('eleven-scribe'),tts));
});
test('character and byte billing are never substituted; unknown bytes retain a range',()=>{
  assert.equal(assess(plan('eleven-flash'),tts).estimate,50);
  assert.equal(assess(plan('deepgram-aura'),tts).estimate,30);
  const fish=assess(plan('fish-speech'),tts);
  assert.equal(fish.estimate,15);assert.equal(fish.upperEstimate,60);assert.equal(fish.status,'confirm');
  assert.equal(priceText(plan('fish-speech'),fish),'$15.00–$60.00');
  const exact=assess(plan('fish-speech'),{...tts,utf8Bytes:2000000});
  assert.equal(exact.estimate,30);assert.equal(exact.byteRange,false);assert.equal(exact.status,'confirm');
  assert.match(unitPrice(plan('fish-speech'),fish),/million UTF-8 bytes/);
  assert.equal(assess(plan('eleven-flash'),{...tts,noTraining:false}).status,'fit');
  assert.equal(assess(plan('deepgram-aura'),{...tts,noTraining:false,budget:29}).status,'over-budget');
});
test('strict units and boolean conditions reject malformed or cross-category inputs',()=>{
  for(const patch of [{characters:0},{characters:1.5},{characters:100000001},{utf8Bytes:999999},{utf8Bytes:4000001},{utf8Bytes:Infinity},{hours:100},{speakers:false},{streaming:'true'},{category:'llm'},{budget:NaN}])assert.throws(()=>requirements({...tts,...patch}));
  assert.deepEqual(requirements({...tts,characters:'1000000',budget:'50.00',utf8Bytes:''}),tts);
});
test('links roundtrip the complete category and byte volume, never a transcription fallback',()=>{
  for(const req of [tts,{...tts,utf8Bytes:1500000,noTraining:false,streaming:false}]){
    assert.deepEqual(selection(reviewLink('fish-speech',req).split('#')[1],catalog).requirements,req);
    const href=comparisonLink(req,'fish-speech');
    assert.deepEqual(comparisonContext(href.split('#')[1]).requirements,req);
    const back=comparisonViewLink(req,['fish-speech','eleven-flash']);
    const review=withComparisonReturn(reviewLink('fish-speech',req),back);
    assert.equal(comparisonReturn(review.split('#')[1],catalog,'fish-speech',req),back);
  }
  assert.throws(()=>selection(reviewLink('eleven-scribe',tts).split('#')[1],catalog));
  assert.throws(()=>comparisonContext(comparisonLink(tts).split('#')[1]+'&hours=100'));
  assert.throws(()=>comparisonContext(comparisonLink(tts).split('#')[1].replace('&streaming=true','')));
  assert.deepEqual(comparisonPair(catalog,tts,['assembly-pro','fish-speech'],now),['fish-speech','deepgram-aura']);
});
test('mixed shortlist retains independent workloads and blocks wrong-category saving',()=>{
  const rows=withSavedOption(null,catalog,'assembly-pro',stt,new Date(now).toISOString());
  const both=withSavedOption(JSON.stringify(rows),catalog,'fish-speech',tts,new Date(now).toISOString());
  assert.equal(readSaved(JSON.stringify(both),catalog).length,2);
  assert.deepEqual(both[1],rows[0]);
  assert.throws(()=>withSavedOption(JSON.stringify(both),catalog,'assembly-pro',tts));
  assert.throws(()=>readSaved(JSON.stringify([{...both[0],requirements:stt}]),catalog));
});
test('exports retain byte uncertainty and text scope instead of audio-hour assumptions',()=>{
  const report=buildComparisonReport(catalog,tts,['fish-speech','eleven-flash'],{entries:[]},now);
  const html=comparisonReportHTML(report);
  assert.match(html,/Text|text-to-speech/);assert.match(html,/1,000,000 characters/);
  assert.match(html,/\$15.00–\$60.00/);assert.match(html,/Streaming audio/);
  assert.doesNotMatch(html,/audio hours|Speaker labels|<script/);
  assert.throws(()=>buildComparisonReport(catalog,tts,['fish-speech','assembly-pro'],{entries:[]},now));
  const text=brief(catalog,plan('fish-speech'),tts,assess(plan('fish-speech'),tts));
  assert.match(text,/\$15.00–\$60.00/);assert.match(text,/Streaming audio required/);
});
test('v5 source-bound findings survive storage and feed matching saved comparisons',async()=>{
  const {row,session,entry}=await fixture();await validateCapture(row,catalog);
  assert.equal(validSession(session,row,entry),true);row.session=session;
  assert.equal(outcome(row,now).setupRequired,true);assert.notEqual(outcome(row,now).status,'fit');
  const store={getItem:k=>k===REVIEWS?JSON.stringify([row]):k==='recall.provider-review-transactions.v1'?JSON.stringify([entry]):null};
  const index=await readReviewIndex(store,catalog,now);
  assert.equal(index.unavailable,false);assert.equal(matchingReview(index,'fish-speech',tts).report.version,5);
  assert.equal(matchingReview(index,'fish-speech',stt),null);
});
test('speech results reject wrong check IDs, old formats, invented citations and changed evidence',async()=>{
  const {row,session,entry}=await fixture();
  for(const change of [s=>s.state.version=4,s=>s.state.results[0].id='service_api',s=>s.state.results.pop(),s=>s.state.results[0].citations[0].quote='Invented quote not in evidence.',s=>s.state.digest='wrong',s=>s.receipt.value_wei='1',s=>s.state.results[2].required_actions=[]]){
    const copy=structuredClone(session);change(copy);assert.equal(validSession(copy,row,entry),false);assert.equal(reviewSessionIssue(copy,row,entry),'mismatch');
  }
  const copy=structuredClone(row);copy.evidence.requirements=stt;copy.payload=JSON.stringify(copy.evidence);copy.digest=await sha(copy.payload);
  await assert.rejects(validateCapture(copy,catalog),/category/);
});
