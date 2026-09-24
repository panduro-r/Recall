// Read-only production check for the single validated v26 record. No wallet calls.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validSession} from '../ui/review-model.js';
import {ZERO} from '../ui/wallet.js';

const origin='https://recall-navy-phi.vercel.app';
const proof=JSON.parse(await readFile(new URL('../submission/studio-next-v26-speechmatics-2026-09-24.json',import.meta.url),'utf8'));
const asset=await fetch(origin+'/review-decisions.js',{signal:AbortSignal.timeout(15000),redirect:'error'});
assert.equal(asset.status,200);
assert.equal(createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex'),
  createHash('sha256').update(await readFile(new URL('../ui/review-decisions.js',import.meta.url))).digest('hex'));

async function inspect(body){
  const response=await fetch(origin+'/api/provider-review',{method:'POST',redirect:'error',
    headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),
    signal:AbortSignal.timeout(45000)});
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  return data;
}
const config=await inspect({op:'config'});
assert.deepEqual(config.assessment_categories,['transcription','speech']);
const session=await inspect({op:'inspect',deployment:proof.transaction,chain_id:61997});
assert.equal(session.state.version,26);
assert.equal(session.state.release_cleared,false);
assert.equal(session.state.protocol_sha256,proof.protocol_sha256);
assert.equal(session.state.digest,proof.evidence_sha256);
assert.equal(session.receipt.hash,proof.transaction);
assert.equal(session.receipt.source_sha256,proof.source_sha256);
assert.equal(session.receipt.consensus_result,'MAJORITY_AGREE');
assert.equal(session.receipt.value_wei,'0');
const payload=session.state.evidence_json;
assert.equal(validSession(session,{payload,digest:proof.evidence_sha256,evidence:JSON.parse(payload)},
  {hash:proof.transaction,review:{action:'deploy',account:session.receipt.from,
    contract:ZERO,recipient:'',value_wei:'0',chain_id:61997,
    protocol_fee_wei:proof.protocol_fee_deposit_wei,args:[payload],
    source_sha256:proof.source_sha256}}),true);
assert.deepEqual(Object.fromEntries(session.state.assessment.results.map(r=>[r.id,r.decision])),{
  service_api:'DOCUMENTED',service_batch:'DOCUMENTED',service_english:'DOCUMENTED',
  service_channels:'DOCUMENTED',training:'CONFLICTING_EVIDENCE'});
console.log(JSON.stringify({origin,transaction:proof.transaction,version:26,
  hosted_asset_matches:true,server_and_browser_accept:true,writer_categories:config.assessment_categories,
  checked_at:new Date().toISOString()}));
