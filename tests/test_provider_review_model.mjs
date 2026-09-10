import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REVIEWS,TRANSACTIONS,sha,selection,reviewLink,validateCapture,readReviews,saveReview,matchesReview,validSession,outcome,reviewHealth,REVIEW_ERRORS,LEGACY_FALLBACK,evidenceChanges} from '../ui/review-model.js';
import {Commerce} from '../ui/commerce-model.js';
import {ZERO} from '../ui/wallet.js';
const catalog=JSON.parse(await readFile(new URL('../ui/service-catalog.json',import.meta.url)));
const req={hours:100,budget:50,noTraining:true,speakers:false},plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
const ACCOUNT='0x'+'1'.repeat(40),HASH='0x'+'2'.repeat(64),SOURCE='3'.repeat(64),config={source_sha256:SOURCE};
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};}
async function fixture(){
  const text='The English pre-recorded transcription API supports single-channel audio. Customer audio and transcripts are never used to train models.';
  const e={version:1,plan,requirements:req,capturedAt:'2026-09-09T15:00:00Z',documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(e),row={id:'review-1',evidence:e,payload,digest:await sha(payload)};
  const review={action:'deploy',account:ACCOUNT,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:SOURCE};
  const receipt={hash:HASH,status:'FINALIZED',execution:'SUCCESS',from:ACCOUNT,value_wei:'0',args:[payload],source_sha256:SOURCE};
  const session={deployment:HASH,receipt,state:{version:1,kind:'provider-review',account:ACCOUNT,digest:row.digest,evidence_json:payload,complete:true,results:['service','training'].map(id=>({id,verdict:'SUPPORTED',reason:'Explicit fixture.',citations:[{source:plan.sources[0],quote:'Customer audio and transcripts are never used to train models.'}]}))}};
  return {row,review,receipt,session,entry:{id:'entry',requestId:row.id,hash:HASH,review,phase:'complete'}};
}
test('review link preserves selected plan and requirements',()=>assert.deepEqual(selection(reviewLink(plan.id,req).split('#')[1],catalog),{plan,requirements:req}));
test('capture validates fingerprints and exact catalog URLs',async()=>{
  const {row}=await fixture();assert.deepEqual(await validateCapture(row,catalog),row.evidence);
  row.evidence.documents[0].url='https://evil.test';row.payload=JSON.stringify(row.evidence);row.digest=await sha(row.payload);
  await assert.rejects(validateCapture(row,catalog),/source URL/);
});
test('saved snapshots use separate storage and cannot be overwritten',async()=>{
  const s=storage(),{row}=await fixture();s.setItem('recall.shortlist.v1','unchanged');s.setItem('recall.commerce.v2','unchanged');
  saveReview(s,row);assert.equal(readReviews(s)[0].payload,row.payload);
  assert.throws(()=>saveReview(s,{...row,payload:'changed'}),/overwritten/);
  assert.equal(s.getItem('recall.commerce.v2'),'unchanged');assert.equal(s.getItem('recall.shortlist.v1'),'unchanged');
});
test('submission intent must match evidence, source, zero value and account',async()=>{
  const {row,review}=await fixture(),request={account:ACCOUNT,payload:row.payload};
  assert.ok(matchesReview({review},request,config));
  for(const change of [{value_wei:'1'},{recipient:ACCOUNT},{source_sha256:'9'.repeat(64)},{args:['modified']},{account:'0x'+'9'.repeat(40)},{action:'execute_purchase'}])assert.equal(matchesReview({review:{...review,...change}},request,config),false);
});
test('finalized result needs exact receipt, evidence and literal quotes',async()=>{
  const {row,session,entry}=await fixture();assert.ok(validSession(session,row,entry));
  const bad=structuredClone(session);bad.state.results[0].citations[0].quote='An invented statement that does not exist';assert.equal(validSession(bad,row,entry),false);
  session.receipt.status='ACCEPTED';assert.equal(validSession(session,row,entry),false);
});
test('cost uncertainty, stale evidence and negative terms cannot become a fit',async()=>{
  const {row,session}=await fixture();row.session=session;
  const now=Date.parse('2026-09-09T16:00:00Z');assert.equal(outcome(row,now).status,'fit');
  row.evidence.requirements={...req,budget:1};assert.equal(outcome(row,now).status,'not-fit');
  row.evidence.requirements=req;row.evidence.plan={...plan,pricing:'estimated'};assert.equal(outcome(row,now).status,'confirm');
  row.evidence.plan=plan;assert.equal(outcome(row,now+8*86400000).status,'confirm');
  row.session.state.results[1].verdict='REFUTED';assert.equal(outcome(row,now).status,'not-fit');
});
test('legacy fallback is ambiguous, never reinterpreted as a provider rejection',async()=>{
  const {row,session,entry}=await fixture();row.session=session;
  session.state.results=session.state.results.map(r=>({id:r.id,verdict:'INCONCLUSIVE',reason:LEGACY_FALLBACK,citations:[]}));
  const before=JSON.stringify(row);assert.ok(validSession(session,row,entry));
  assert.equal(outcome(row).label,'Review result unavailable');
  assert.equal(reviewHealth(session.state).status,'legacy_unknown');
  assert.equal(JSON.stringify(row),before,'presentation does not rewrite historical state');
});
test('genuine uncertainty remains distinct from technical failure',async()=>{
  const {row,session,entry}=await fixture();row.session=session;session.state.version=2;session.state.review_status='completed';
  session.state.results[1]={id:'training',verdict:'INCONCLUSIVE',reason:'The plan-specific account configuration is not established.',citations:[]};
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Needs clarification');
  assert.equal(reviewHealth(session.state).status,'completed');
});
const failedRow=(id,code)=>({id,verdict:'NOT_ASSESSED',reason:REVIEW_ERRORS[code],citations:[],error_code:code});
test('v2 failures and partial reviews preserve diagnostic codes without becoming fit',async()=>{
  const {row,session,entry}=await fixture();row.session=session;session.state.version=2;
  for(const code of ['MODEL_CALL_FAILED','INVALID_JSON','INVALID_RESPONSE','INVALID_CITATION']){
    session.state.results=['service','training'].map(id=>failedRow(id,code));session.state.review_status='failed';
    assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Review couldn’t complete');
    const before=JSON.stringify(row);saveReview(storage(),row);assert.equal(JSON.stringify(row),before);
  }
  session.state.results[0]=(await fixture()).session.state.results[0];session.state.review_status='partial';
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Review partially completed');
});
test('malformed diagnostics and mismatched completed status are rejected',async()=>{
  const {row,session,entry}=await fixture();session.state.version=2;session.state.review_status='failed';
  session.state.results=['service','training'].map(id=>failedRow(id,'INVALID_CITATION'));
  for(const mutation of [s=>s.review_status='completed',s=>s.results[0].error_code='unknown',s=>s.results[0].reason='All good',s=>s.results[0].citations=[{source:plan.sources[0],quote:'Customer audio and transcripts are never used to train models.'}],s=>s.results[0].verdict='INCONCLUSIVE',s=>s.results[0].error_code='INCOMPLETE_EVIDENCE']){
    const copy=structuredClone(session);mutation(copy.state);assert.equal(validSession(copy,row,entry),false);
  }
});
test('incomplete capture cannot claim a completed model assessment in either version',async()=>{
  const {row,session,entry}=await fixture();row.session=session;row.evidence.documents[0].complete=false;
  row.payload=JSON.stringify(row.evidence);row.digest=await sha(row.payload);session.state.evidence_json=row.payload;session.state.digest=row.digest;entry.review.args=[row.payload];session.receipt.args=[row.payload];session.state.complete=false;
  session.state.results=['service','training'].map(id=>({id,verdict:'INCONCLUSIVE',reason:LEGACY_FALLBACK,citations:[]}));
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Evidence capture incomplete');
  session.state.version=2;session.state.review_status='evidence_incomplete';session.state.results=['service','training'].map(id=>failedRow(id,'INCOMPLETE_EVIDENCE'));
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Evidence capture incomplete');
  session.state.results[0]=failedRow('service','MODEL_CALL_FAILED');assert.equal(validSession(session,row,entry),false);
});
test('text comparison detects changes but does not manufacture a new verdict',async()=>{
  const {row}=await fixture(),next=structuredClone(row);next.evidence.documents[0].text='Changed terms allow model training.';next.evidence.documents[0].textSha256=await sha(next.evidence.documents[0].text);
  const diff=evidenceChanges(row,next);assert.ok(diff[0].changed);assert.equal(diff[1].changed,false);assert.ok(diff[0].added[0].includes('allow'));assert.equal(outcome(next).status,'unreviewed');
});
test('review journal shares safe submission logic but never uses purchase history',async()=>{
  const {row,review}=await fixture(),s=storage(),request={account:ACCOUNT,payload:row.payload};let sends=0;
  const engine=new Commerce({storage:s,journal:TRANSACTIONS,match:matchesReview,locks:{request:async(n,o,fn)=>fn({})},id:()=> 'tx-1',call:async()=>({review})});
  const wallet={approve:async(p,refresh,before)=>{await refresh();before();sends++;return HASH;}};
  await engine.send({wallet,plan:{review},request,config,requestId:row.id});
  assert.equal(sends,1);assert.equal(s.getItem('recall.commerce.v2'),null);assert.ok(s.getItem(TRANSACTIONS));
  await assert.rejects(engine.send({wallet,plan:{review},request,config}),/active/);assert.equal(sends,1);
});
test('uncertain wallet failure remains recoverable and does not submit again',async()=>{
  const {row,review,receipt}=await fixture(),s=storage();
  const engine=new Commerce({storage:s,journal:TRANSACTIONS,match:matchesReview,locks:{request:async(n,o,fn)=>fn({})},id:()=> 'tx-1',call:async d=>d.op==='receipt'?receipt:{review}});
  await assert.rejects(engine.send({wallet:{approve:async(p,r,b)=>{b();throw Error('lost response');}},plan:{review},request:{account:ACCOUNT,payload:row.payload},config,requestId:row.id}),/lost response/);
  assert.equal(engine.pending().length,1);const recovered=await engine.check('tx-1',HASH);assert.equal(recovered.phase,'complete');assert.equal(engine.pending().length,0);
});
test('frontend script parses and uses no HTML injection or storage clearing',async()=>{
  const js=await readFile(new URL('../ui/review.js',import.meta.url),'utf8');assert.doesNotMatch(js,/innerHTML|localStorage\.clear|removeItem/);
  const {spawnSync}=await import('node:child_process');assert.equal(spawnSync(process.execPath,['--check','ui/review.js']).status,0);
});
