import test from 'node:test';
import assert from 'node:assert/strict';
import {DECISION_SOURCE,DECISION_PROTOCOL,decisionPassages,validDecisionState,decisionView,validDecisionSession} from '../ui/review-decisions.js';
import {ZERO} from '../ui/wallet.js';
import {validSession,reviewSessionIssue,reviewResults,reviewHealth,REVIEW_VERSION,reviewConfigIssue} from '../ui/review-model.js';
function fixture(){
  const text='Aster is a hosted text-generation API. Send text and receive generated text output. API training policy and streaming capabilities are not documented.';
  const evidence={requirements:{category:'text',noTraining:true,streaming:true},documents:[{id:'source',text,status:'retrieved',complete:true}]};
  const ref={source:'source',passage:'p0',quote:text};
  const rows=['text_api','text_output','training','text_streaming'].map(id=>({id,decision:id==='training'||id==='text_streaming'?'INSUFFICIENT_EVIDENCE':'DOCUMENTED',verdict:id==='training'||id==='text_streaming'?'INCONCLUSIVE':'SUPPORTED',reason:'Scripted fixture, not a live assessment.',citations:id==='training'||id==='text_streaming'?[]:[{...ref}],documented_steps:[]}));
  const state={version:20,kind:'provider-review-decisions-candidate',release_cleared:false,protocol_sha256:DECISION_PROTOCOL,account:'test',digest:'test',evidence_json:JSON.stringify(evidence),complete:true,review_status:'completed',assessment:{kind:'local-evidence-decisions-experiment',schema_version:20,release_cleared:false,evidence_sha256:'test',results:rows}};
  return {state,evidence,ref};
}
test('new format preserves raw record and separately derives its view',()=>{
  const {state,evidence}=fixture(),before=structuredClone(state);
  assert.equal(validDecisionState(state,evidence),true);
  const view=decisionView(state); view.results[0].citations[0].quote='tamper';
  assert.deepEqual(state,before);
});
test('passages use Unicode code points and overlap exactly',()=>{
  const text='🙂'.repeat(700),parts=decisionPassages(text);
  assert.deepEqual(parts,['🙂'.repeat(480),'🙂'.repeat(300)]);
  assert.deepEqual(decisionPassages('x'.repeat(481)),['x'.repeat(480),'x'.repeat(81)]);
});
for(const change of ['quote','passage','source','decision','verdict','order','digest','format','release','setup','duplicate','extra','incomplete'])test('rejects '+change,()=>{
  const {state,evidence,ref}=fixture(),r=state.assessment.results[0];
  if(change==='quote')r.citations[0].quote+='tamper';
  if(change==='passage')r.citations[0].passage='p00';
  if(change==='source')r.citations[0].source='other';
  if(change==='decision')r.decision='UNKNOWN_ENUM';
  if(change==='verdict')r.verdict='INCONCLUSIVE';
  if(change==='order')state.assessment.results.reverse();
  if(change==='digest')state.assessment.evidence_sha256='other';
  if(change==='format')state.kind='provider-review';
  if(change==='release')state.release_cleared=true;
  if(change==='setup')r.documented_steps=[ref];
  if(change==='duplicate')r.citations.push(ref);
  if(change==='extra')r.unknown=true;
  if(change==='incomplete')evidence.documents[0].complete=false;
  assert.equal(validDecisionState(state,evidence),false);
});
test('conditional setup is exactly the documented quote, not fabricated prose',()=>{
  const {state,evidence,ref}=fixture(),r=state.assessment.results[2];
  Object.assign(r,{decision:'OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED',verdict:'CONDITIONAL',citations:[ref],documented_steps:[ref]});
  assert.equal(validDecisionState(state,evidence),true);
  assert.deepEqual(decisionView(state).results[2].required_actions,[ref.quote]);
});
function sessionFixture(){
  const {state,evidence}=fixture(),account='0x'+'1'.repeat(40),hash='0x'+'2'.repeat(64);
  state.account=account;
  const review={action:'deploy',account,contract:ZERO,recipient:'',value_wei:'0',chain_id:61997,source_sha256:DECISION_SOURCE,args:[state.evidence_json],protocol_fee_wei:'123'};
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',chain_id:61997,source_sha256:DECISION_SOURCE,args:review.args,protocol_fee_deposit_wei:'123'};
  return {session:{state,receipt,deployment:hash},row:{evidence,payload:state.evidence_json,digest:state.digest},entry:{hash,review}};
}
test('session requires pinned Next source and exact receipt identity',()=>{
  const {session,row,entry}=sessionFixture();
  assert.equal(validDecisionSession(session,row,entry),true);
  for(const mutate of [s=>s.receipt.chain_id=61999,s=>s.receipt.source_sha256='wrong',s=>s.receipt.value_wei='1',s=>s.receipt.status='ACCEPTED',s=>s.receipt.hash='other',s=>s.state.account='other',s=>s.state.evidence_json='other',s=>s.state.digest='other',s=>s.receipt.protocol_fee_deposit_wei='124',s=>s.receipt.consensus_result='MAJORITY_DISAGREE']){
    const changed=structuredClone(session);mutate(changed);assert.equal(validDecisionSession(changed,row,entry),false);
  }
});
test('main reader accepts v20 without enabling a v20 writer or altering the record',()=>{
  const {session,row,entry}=sessionFixture(),before=structuredClone(session);
  assert.equal(validSession(session,row,entry),true);
  assert.equal(reviewSessionIssue(session,row,entry),null);
  assert.deepEqual(reviewResults(session.state),session.state.assessment.results);
  assert.equal(reviewHealth(session.state).status,'completed');
  assert.deepEqual(session,before);
  assert.equal(REVIEW_VERSION,8);
  assert.equal(reviewConfigIssue({version:20,chain_id:61997,source_sha256:DECISION_SOURCE}),'update');
});
