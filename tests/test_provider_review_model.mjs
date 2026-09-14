import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REVIEWS,TRANSACTIONS,REVIEW_VERSION,sha,selection,reviewLink,validateCapture,sourceCoverage,readReviews,saveReview,matchesReview,validSession,outcome,reviewNextStep,reviewHealth,REVIEW_ERRORS,LEGACY_FALLBACK,evidenceChanges,SERVICE_CHECKS,findingPresentation,reviewConfigIssue,reviewSessionIssue,unresolvedReviewEntries,reviewRecovery} from '../ui/review-model.js';
import {Commerce} from '../ui/commerce-model.js';
import {ZERO} from '../ui/wallet.js';
const catalog=JSON.parse(await readFile(new URL('../ui/service-catalog.json',import.meta.url)));
const req={hours:100,budget:50,noTraining:true,speakers:false},plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
const ACCOUNT='0x'+'1'.repeat(40),HASH='0x'+'2'.repeat(64),SOURCE='3'.repeat(64),config={source_sha256:SOURCE};
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};}
async function fixture(planId='speechmatics-standard'){
  const plan=catalog.plans.find(p=>p.id===planId);
  const text='The English pre-recorded transcription API supports single-channel audio. Customer audio and transcripts are never used to train models.';
  const e={version:1,plan,requirements:req,capturedAt:'2026-09-09T15:00:00Z',documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(e),row={id:'review-1',evidence:e,payload,digest:await sha(payload)};
  const review={action:'deploy',account:ACCOUNT,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:SOURCE};
  const receipt={hash:HASH,status:'FINALIZED',execution:'SUCCESS',from:ACCOUNT,value_wei:'0',args:[payload],source_sha256:SOURCE};
  const session={deployment:HASH,receipt,state:{version:1,kind:'provider-review',account:ACCOUNT,digest:row.digest,evidence_json:payload,complete:true,results:['service','training'].map(id=>({id,verdict:'SUPPORTED',reason:'Explicit fixture.',citations:[{source:plan.sources[0],quote:'Customer audio and transcripts are never used to train models.'}]}))}};
  return {row,review,receipt,session,entry:{id:'entry',requestId:row.id,hash:HASH,review,phase:'complete'}};
}
test('review link preserves selected plan and requirements',()=>assert.deepEqual(selection(reviewLink(plan.id,req).split('#')[1],catalog),{plan,requirements:req}));
test('new submissions require the current known format; newer servers request a page update',()=>{
  const c={version:REVIEW_VERSION,chain_id:61999,source_sha256:SOURCE};
  assert.equal(reviewConfigIssue(c),null);
  assert.equal(reviewConfigIssue({...c,version:REVIEW_VERSION+1}),'update');
  for(const bad of [null,{}, {...c,version:3},{...c,version:'5'},{...c,version:Infinity},{...c,chain_id:1},{...c,source_sha256:''}])assert.equal(reviewConfigIssue(bad),'config');
});
test('unknown result format offers update without accepting it or excusing identity mismatches',async()=>{
  const {row,session,entry}=await fixture();
  assert.equal(reviewSessionIssue(session,row,entry),null);
  session.state.version=REVIEW_VERSION+1;
  const before=JSON.stringify({row,session,entry});
  assert.equal(reviewSessionIssue(session,row,entry),'update');assert.equal(validSession(session,row,entry),false);
  assert.equal(JSON.stringify({row,session,entry}),before);
  for(const mutate of [s=>s.state.digest='wrong',s=>s.state.evidence_json='changed',s=>s.receipt.source_sha256='wrong',s=>s.receipt.value_wei='1',s=>s.receipt.hash='0x'+'9'.repeat(64),s=>s.state.account='0x'+'9'.repeat(40),s=>s.receipt.consensus_result='MAJORITY_DISAGREE']){
    const copy=structuredClone(session);mutate(copy);assert.equal(reviewSessionIssue(copy,row,entry),'mismatch');
  }
  assert.equal(reviewSessionIssue(session,row,null),'mismatch');
});
test('known schema errors are verification problems, not fabricated page updates',async()=>{
  const {row,session,entry}=await fixture();session.state.results[0].citations[0].quote='Invented unsupported quote';
  assert.equal(reviewSessionIssue(session,row,entry),'mismatch');
});
test('finalized but unsaved reviews remain unresolved without rewriting journal phases',async()=>{
  const {row,session,entry}=await fixture(),pending={...entry,id:'pending',requestId:'other',phase:'pending'},failed={...entry,id:'failed',phase:'failed'},rejected={...entry,id:'rejected',phase:'rejected'};
  const entries=[entry,pending,failed,rejected],before=JSON.stringify(entries);
  assert.deepEqual(unresolvedReviewEntries([row],entries),[entry,pending]);
  assert.deepEqual(unresolvedReviewEntries([{...row,session}],entries),[pending]);
  assert.deepEqual(unresolvedReviewEntries([],entries),[entry,pending],'missing snapshots are not permission to resubmit');
  assert.equal(JSON.stringify(entries),before);
});
test('recovery distinguishes pending, retrieval, update and mismatch with explicit safe actions',()=>{
  assert.equal(reviewRecovery({phase:'pending'}).action,'Recover existing transaction');
  assert.equal(reviewRecovery({phase:'pending',hash:HASH}).kind,'pending');
  assert.equal(reviewRecovery({phase:'complete'}).kind,'retrieving');
  assert.equal(reviewRecovery({phase:'complete'},'unavailable').kind,'unavailable');
  assert.equal(reviewRecovery({phase:'complete'},'update').action,'Reload Recall');
  assert.equal(reviewRecovery({phase:'complete'},'mismatch').action,'Recheck existing result');
  assert.equal(reviewRecovery({phase:'pending',receipt:{status:'FINALIZED',execution:'SUCCESS'}}).kind,'mismatch');
});
test('completed supported review offers a provider handoff without changing the evidence',async()=>{
  const {row,session}=await fixture();row.session=session;const before=JSON.stringify(row);
  assert.equal(reviewNextStep(row,catalog,Date.parse('2026-09-09T16:00:00Z')).kind,'visit');
  assert.equal(JSON.stringify(row),before);
});
test('uncertain, refuted, unassessed and technical failures are not promoted to provider recommendations',async()=>{
  const {row,session}=await fixture(),now=Date.parse('2026-09-09T16:00:00Z');
  assert.equal(reviewNextStep(row,catalog,now).kind,'compare');row.session=session;
  for(const verdict of ['INCONCLUSIVE','REFUTED']){session.state.results[0].verdict=verdict;assert.equal(reviewNextStep(row,catalog,now).kind,'compare');}
  session.state.results[0].verdict='SUPPORTED';row.evidence.requirements={...req,budget:1};
  assert.equal(reviewNextStep(row,catalog,now).kind,'compare');row.evidence.requirements=req;
  session.state.version=3;
  for(const status of ['partial','failed']){session.state.review_status=status;assert.equal(reviewNextStep(row,catalog,now).kind,'compare');}
});
test('old evidence, new sources and changed prices retain their caveats in the next step',async()=>{
  const {row,session}=await fixture();row.session=session;const now=Date.parse('2026-09-09T16:00:00Z');
  assert.equal(reviewNextStep(row,catalog,now+8*86400000).kind,'refresh');
  const different=structuredClone(catalog);different.plans.find(p=>p.id===plan.id).rate=0.60;
  assert.equal(reviewNextStep(row,different,now).kind,'compare');
  row.evidence.documents=row.evidence.documents.slice(0,2);
  assert.equal(reviewNextStep(row,catalog,now).kind,'refresh');
});
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
async function historicalFixture(planId='speechmatics-standard'){
  const f=await fixture(planId),e=f.row.evidence;
  e.plan={...e.plan,sources:catalog.reviewSourceHistory[planId][0]};e.documents=e.documents.slice(0,2);
  f.row.payload=JSON.stringify(e);f.row.digest=await sha(f.row.payload);
  f.review.args=[f.row.payload];f.receipt.args=[f.row.payload];
  f.session.state.digest=f.row.digest;f.session.state.evidence_json=f.row.payload;
  return f;
}
test('historical sources stay readable without changing evidence, findings or receipts',async()=>{
  const {row,session,entry}=await historicalFixture();row.session=session;
  const original=JSON.stringify(row);
  await assert.rejects(validateCapture(row,catalog),/sources/);
  assert.deepEqual(await validateCapture(row,catalog,{historical:true}),row.evidence);
  assert.ok(validSession(session,row,entry));
  assert.equal(sourceCoverage(row.evidence,catalog).added.length,2);
  assert.equal(JSON.stringify(row),original);
  const current=(await fixture()).row;
  assert.deepEqual(sourceCoverage(current.evidence,catalog),{changed:false,added:[],removed:[]});
  assert.equal(validSession(session,current,entry),false,'an old receipt cannot endorse the expanded evidence');
});
test('Deepgram historical receipt stays bound to the two original sources',async()=>{
  const {row,session,entry}=await historicalFixture('deepgram-nova');row.session=session;
  const original=JSON.stringify(row);
  await validateCapture(row,catalog,{historical:true});assert.ok(validSession(session,row,entry));
  await assert.rejects(validateCapture(row,catalog),/sources/);
  const expanded=(await fixture('deepgram-nova')).row;
  await validateCapture(expanded,catalog);
  assert.equal(validSession(session,expanded,entry),false);
  assert.equal(sourceCoverage(row.evidence,catalog).added.length,2);
  assert.deepEqual(evidenceChanges(row,expanded).map(d=>d.kind),['unchanged','unchanged','added','added']);
  assert.equal(outcome(row,Date.parse('2026-09-09T16:00:00Z')).label,'Needs clarification','technical support cannot resolve no-training price uncertainty');
  assert.equal(JSON.stringify(row),original);
});
test('historical validation never accepts arbitrary subsets, ordering or source metadata',async()=>{
  for(const mutate of [
    e=>{e.documents.reverse();e.plan.sources=[...e.plan.sources].reverse();},
    e=>{e.documents.pop();e.plan.sources=e.plan.sources.slice(0,1);},
    e=>{e.documents[0].url='https://evil.test';},
    e=>{e.documents[0].label='Misleading title';},
    e=>{e.plan.provider='different-provider';},
    e=>{e.documents[1]={...e.documents[0]};e.plan.sources=[e.documents[0].id,e.documents[0].id];},
    e=>{e.documents[1].id='soniox-price';e.plan.sources=[e.plan.sources[0],'soniox-price'];},
    e=>{e.plan.sources=[...plan.sources];}
  ]){
    const {row}=await historicalFixture();mutate(row.evidence);row.payload=JSON.stringify(row.evidence);row.digest=await sha(row.payload);
    await assert.rejects(validateCapture(row,catalog,{historical:true}));
  }
});
test('AssemblyAI source expansion preserves old findings and does not remove opt-out pricing conditions',async()=>{
  const {row,session,entry}=await historicalFixture('assembly-pro');row.session=session;
  const original=JSON.stringify(row);
  await validateCapture(row,catalog,{historical:true});assert.ok(validSession(session,row,entry));
  await assert.rejects(validateCapture(row,catalog),/sources/);
  const expanded=(await fixture('assembly-pro')).row;
  await validateCapture(expanded,catalog);
  assert.deepEqual(expanded.evidence.documents.map(d=>d.id),['assembly-price','assembly-training','assembly-batch','assembly-models']);
  assert.equal(validSession(session,expanded,entry),false,'old receipt cannot attest to added documents');
  assert.deepEqual(evidenceChanges(row,expanded).map(d=>d.kind),['unchanged','unchanged','added','added']);
  assert.equal(sourceCoverage(row.evidence,catalog).added.length,2);
  assert.equal(outcome(row,Date.parse('2026-09-09T16:00:00Z')).label,'Needs clarification');
  assert.equal(expanded.evidence.plan.rate,0.21);assert.equal(expanded.evidence.plan.training,'optout');
  assert.equal(JSON.stringify(row),original);
});
test('added and removed sources are coverage changes, not unavailable or rewritten policies',async()=>{
  const before=(await historicalFixture()).row,after=(await fixture()).row;
  const diff=evidenceChanges(before,after);
  assert.deepEqual(diff.map(d=>d.kind),['unchanged','unchanged','added','added']);
  assert.equal(diff[2].unavailable,false);
  const removed=evidenceChanges(after,before);
  assert.deepEqual(removed.map(d=>d.kind),['unchanged','unchanged','removed','removed']);
  after.evidence.documents[0].complete=false;
  assert.equal(evidenceChanges(before,after)[0].kind,'changed');
  assert.equal(evidenceChanges(before,after)[0].unavailable,true);
  assert.equal(outcome(after).status,'unreviewed');
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
test('a rejected consensus cannot be accepted because the leader executed successfully',async()=>{
  const {row,session,entry}=await fixture();
  session.receipt.consensus_result='MAJORITY_DISAGREE';assert.equal(validSession(session,row,entry),false);
  session.receipt.consensus_result='UNKNOWN';assert.equal(validSession(session,row,entry),false);
  session.receipt.consensus_result='MAJORITY_AGREE';assert.equal(validSession(session,row,entry),true);
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
test('v3 preserves source-bound findings, uncertainty, and technical failure separately',async()=>{
  const {row,session,entry}=await fixture();row.session=session;session.state.version=3;session.state.review_status='completed';
  assert.ok(validSession(session,row,entry));
  session.state.results[0]={id:'service',verdict:'INCONCLUSIVE',reason:'Single-channel support is not established in the supplied text.',citations:[]};
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Needs clarification');
  session.state.results[1]=failedRow('training','INVALID_CITATION');session.state.review_status='partial';
  assert.ok(validSession(session,row,entry));assert.equal(reviewHealth(session.state).status,'partial');
  session.state.results[0]=failedRow('service','INVALID_RESPONSE');session.state.review_status='failed';
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Review couldn’t complete');
  session.state.review_status='completed';assert.equal(validSession(session,row,entry),false);
  session.state.version=4;assert.equal(validSession(session,row,entry),false);
});
test('source-passage Unicode length matches Python character bounds',async()=>{
  const {row,session,entry}=await fixture();
  const text='🎧'.repeat(480);row.evidence.documents[0].text=text;row.evidence.documents[0].textSha256=await sha(text);
  row.payload=JSON.stringify(row.evidence);row.digest=await sha(row.payload);session.state.evidence_json=row.payload;session.state.digest=row.digest;
  entry.review.args=[row.payload];session.receipt.args=[row.payload];session.state.version=3;session.state.review_status='completed';
  session.state.results[0].citations=[{source:plan.sources[0],quote:text}];
  session.state.results[1]={id:'training',verdict:'INCONCLUSIVE',reason:'No commitment established.',citations:[]};
  assert.ok(validSession(session,row,entry));
  session.state.results[0].citations[0].quote='Invented quote does not exist';assert.equal(validSession(session,row,entry),false);
});
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
  for(const mutation of [s=>s.review_status='completed',s=>s.results[0].error_code='unknown',s=>s.results[0].error_code=['INVALID_CITATION'],s=>s.results[0].reason='All good',s=>s.results[0].citations=[{source:plan.sources[0],quote:'Customer audio and transcripts are never used to train models.'}],s=>s.results[0].verdict='INCONCLUSIVE',s=>s.results[0].error_code='INCOMPLETE_EVIDENCE']){
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

async function v4Fixture(){
  const f=await fixture('assembly-pro');f.row.session=f.session;
  f.row.evidence.plan={...f.row.evidence.plan,reviewedAt:catalog.reviewedAt};
  f.row.payload=JSON.stringify(f.row.evidence);f.row.digest=await sha(f.row.payload);
  f.session.state.evidence_json=f.row.payload;f.session.state.digest=f.row.digest;f.session.receipt.args=[f.row.payload];f.entry.review.args=[f.row.payload];
  f.session.state.version=4;f.session.state.review_status='completed';
  f.session.state.results=[...SERVICE_CHECKS,'training'].map(id=>({...structuredClone(f.session.state.results[0]),id}));
  f.session.state.results[4]={...f.session.state.results[4],verdict:'CONDITIONAL',required_actions:['Request opt-out and wait for confirmation.','Confirm the resulting account price.']};
  return f;
}
test('v4 conditional setup is cited, preserved, and never promoted to a fit',async()=>{
  const {row,session,entry}=await v4Fixture(),now=Date.parse('2026-09-09T16:00:00Z');
  assert.ok(validSession(session,row,entry));
  const before=JSON.stringify(row),out=outcome(row,now);
  assert.equal(out.label,'Requires setup');assert.equal(out.status,'confirm');assert.equal(out.cost.uncertainPrice,true);
  assert.equal(reviewNextStep(row,catalog,now).title,'Resolve setup before using customer data');
  assert.deepEqual(findingPresentation(session.state.results[4],4),{label:'Requires setup',tone:'confirm'});
  assert.equal(JSON.stringify(row),before);
  session.state.results[3]={...session.state.results[3],verdict:'INCONCLUSIVE',citations:[]};
  assert.equal(outcome(row,now).label,'Some checks are still unknown');assert.equal(outcome(row,now).setupRequired,true);
  session.state.results[0].verdict='REFUTED';assert.equal(outcome(row,now).status,'not-fit');
});
test('v4 rejects collapsed or missing checks and malformed setup instead of silently accepting them',async()=>{
  const {row,session,entry}=await v4Fixture();
  const changes=[s=>s.results.shift(),s=>s.results[0].id='service',s=>s.results[0].id=s.results[1].id,s=>s.results[4].citations=[],s=>delete s.results[4].required_actions,s=>s.results[4].required_actions=[],s=>s.results[4].required_actions=[' '],s=>s.results[4].required_actions=['x'.repeat(241)],s=>s.results[4].required_actions=['same','same'],s=>s.results[4].required_actions=[{}],s=>s.results[4].verdict='SUPPORTED',s=>Object.assign(s.results[0],{verdict:'CONDITIONAL',required_actions:['Change plan']}),s=>s.version=3];
  for(const change of changes){const copy=structuredClone(session);change(copy.state);assert.equal(validSession(copy,row,entry),false);}
});
test('v4 partial diagnostics remain separate from documented setup',async()=>{
  const {row,session,entry}=await v4Fixture();session.state.results[0]=failedRow('service_api','INVALID_CITATION');session.state.review_status='partial';
  assert.ok(validSession(session,row,entry));assert.equal(outcome(row).label,'Review partially completed');
  assert.equal(reviewHealth(session.state).status,'partial');
});
