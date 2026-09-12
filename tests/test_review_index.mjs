import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readReviewIndex,matchingReview,REVIEWS,TRANSACTIONS} from '../ui/review-index.js';
import {sha,REVIEW_ERRORS} from '../ui/review-model.js';
const catalog=JSON.parse(await readFile('ui/service-catalog.json','utf8'));
const req={hours:100,budget:50,noTraining:true,speakers:false};
const now=Date.parse('2026-09-12T18:00:00Z'),account='0x'+'7'.repeat(40),source='a'.repeat(64),hash='0x'+'8'.repeat(64);
async function fixture({id='review-1',capturedAt='2026-09-12T15:00:00Z',selected=req,planId='speechmatics-standard',historical=false}={}){
  const plan=structuredClone(catalog.plans.find(p=>p.id===planId));plan.reviewedAt??=catalog.reviewedAt;
  if(historical)plan.sources=catalog.reviewSourceHistory[planId][0];
  const text='Explicit synthetic fixture: English prerecorded single-channel transcription API. Customer audio and transcripts are never used to train models.';
  const documents=await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],text,textSha256:await sha(text),sha256:source,status:'retrieved',complete:true,checkedAt:capturedAt})));
  const evidence={version:1,plan,requirements:selected,documents,capturedAt},payload=JSON.stringify(evidence),digest=await sha(payload);
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',consensus_result:'MAJORITY_AGREE',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const row={id,evidence,payload,digest,session:{deployment:hash,receipt,state:{version:3,kind:'provider-review',account,digest,evidence_json:payload,review_status:'completed',complete:true,results:['service',...(selected.noTraining?['training']:[]),...(selected.speakers?['speakers']:[])].map(id=>({id,verdict:'SUPPORTED',reason:'Explicit synthetic fixture.',citations:[{source:plan.sources[0],quote:text}]}))}}};
  const entry={id:'tx-'+id,requestId:id,hash,phase:'complete',review:{action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source}};
  return {row,entry};
}
function store(rows=[],entries=[]){
  const values=new Map([[REVIEWS,JSON.stringify(rows)],[TRANSACTIONS,JSON.stringify(entries)],['recall.shortlist.v1','unchanged'],['recall.commerce.v2','unchanged']]),reads=[];
  return {values,reads,getItem(k){reads.push(k);return values.get(k)||null;},setItem(){throw Error('Writing is forbidden');}};
}
test('index reads only provider-review records and never writes or contacts a network',async()=>{
  const {row,entry}=await fixture(),storage=store([row],[entry]),before=JSON.stringify([...storage.values]);
  const index=await readReviewIndex(storage,catalog,now);
  assert.equal(index.unavailable,false);assert.equal(index.entries[0].tone,'fit');
  assert.deepEqual(storage.reads,[REVIEWS,TRANSACTIONS]);assert.equal(JSON.stringify([...storage.values]),before);
  const code=await readFile('ui/review-index.js','utf8');assert.doesNotMatch(code,/fetch\(|setItem\(|removeItem\(|\.request\(|new Wallet|new Commerce|reviewAPI\(/);
});
test('matches every requirement exactly and only the same plan',async()=>{
  const {row,entry}=await fixture(),index=await readReviewIndex(store([row],[entry]),catalog,now);
  assert.equal(matchingReview(index,'speechmatics-standard',req).id,row.id);
  for(const changed of [{hours:101},{budget:50.01},{noTraining:false},{speakers:true}])assert.equal(matchingReview(index,'speechmatics-standard',{...req,...changed}),null);
  assert.equal(matchingReview(index,'deepgram-nova',req),null);
});
test('latest capture wins, not the most favorable result or storage array order',async()=>{
  const old=await fixture({id:'old'}),recent=await fixture({id:'recent',capturedAt:'2026-09-12T17:00:00Z'});
  delete recent.row.session;
  const index=await readReviewIndex(store([old.row,recent.row],[old.entry]),catalog,now),match=matchingReview(index,'speechmatics-standard',req);
  assert.equal(match.id,'recent');assert.equal(match.count,2);assert.equal(match.label,'Evidence saved · Not assessed');assert.equal(match.tone,'unreviewed');
});
test('pending, failed and rejected journal phases never imply assessment success',async()=>{
  for(const [phase,label] of [['pending','Review processing'],['complete','Result ready to check'],['failed','Review couldn’t complete'],['rejected','Review not submitted']]){
    const {row,entry}=await fixture();delete row.session;entry.phase=phase;if(phase==='pending')delete entry.hash;
    const index=await readReviewIndex(store([row],[entry]),catalog,now);
    assert.equal(index.entries[0].label,label);assert.equal(index.entries[0].tone,'unreviewed');
  }
});
test('inconclusive, negative and partial assessments keep distinct neutral or caution states',async()=>{
  const {row,entry}=await fixture();
  row.session.state.results[0].verdict='INCONCLUSIVE';
  assert.equal((await readReviewIndex(store([row],[entry]),catalog,now)).entries[0].label,'Needs clarification');
  row.session.state.results[0].verdict='REFUTED';
  assert.equal((await readReviewIndex(store([row],[entry]),catalog,now)).entries[0].tone,'not-fit');
  row.session.state.results[0]={id:'service',verdict:'NOT_ASSESSED',reason:REVIEW_ERRORS.INVALID_CITATION,citations:[],error_code:'INVALID_CITATION'};
  row.session.state.review_status='partial';
  const entry1=(await readReviewIndex(store([row],[entry]),catalog,now)).entries[0];
  assert.equal(entry1.label,'Review partially completed');assert.equal(entry1.tone,'unreviewed');
});
test('old evidence, historical source sets and changed catalog cannot keep a green summary',async()=>{
  const {row,entry}=await fixture();
  assert.equal((await readReviewIndex(store([row],[entry]),catalog,now+8*86400000)).entries[0].label,'Review needs updating');
  const older=await fixture({historical:true});
  assert.equal((await readReviewIndex(store([older.row],[older.entry]),catalog,now)).entries[0].label,'Review needs updating');
  const updated=structuredClone(catalog);updated.plans.find(p=>p.id===row.evidence.plan.id).rate=0.90;
  assert.equal((await readReviewIndex(store([row],[entry]),updated,now)).entries[0].label,'Catalog changed since review');
});
test('unsafe or mismatched local evidence cannot produce a saved assessment badge',async()=>{
  for(const mutate of [
    f=>f.row.digest='b'.repeat(64),f=>f.row.session.receipt.status='ACCEPTED',f=>f.entry.review.value_wei='1',
    f=>f.row.session.state.results[0].citations[0].quote='Invented quote that is not in the evidence',
    f=>f.entry.hash='0x'+'9'.repeat(64),f=>f.entry.phase='pending',f=>f.row.session.receipt.consensus_result='MAJORITY_DISAGREE'
  ]){const f=await fixture();mutate(f);assert.deepEqual(await readReviewIndex(store([f.row],[f.entry]),catalog,now),{entries:[],unavailable:true});}
});
test('corrupt, blocked or duplicate storage is unavailable, not an empty or successful history',async()=>{
  assert.deepEqual(await readReviewIndex(store(),catalog,now),{entries:[],unavailable:false});
  assert.equal((await readReviewIndex({getItem(){throw Error('blocked');}},catalog,now)).unavailable,true);
  const {row,entry}=await fixture();
  for(const key of [REVIEWS,TRANSACTIONS]){const storage=store([row],[entry]);storage.values.set(key,'broken');assert.equal((await readReviewIndex(storage,catalog,now)).unavailable,true);assert.equal(storage.values.get(key),'broken');}
  assert.equal((await readReviewIndex(store([row,row],[entry]),catalog,now)).unavailable,true);
  assert.equal((await readReviewIndex(store([row],[entry,entry]),catalog,now)).unavailable,true);
});
test('review IDs are URL-encoded local fragments rather than external destinations',async()=>{
  const {row,entry}=await fixture({id:'https://example.test/?id=a&plan=other#evil'});
  const index=await readReviewIndex(store([row],[entry]),catalog,now),link=new URL(index.entries[0].href,'https://recall.test');
  assert.equal(link.origin,'https://recall.test');assert.equal(link.pathname,'/review');assert.equal(new URLSearchParams(link.hash.slice(1)).get('id'),row.id);
});
