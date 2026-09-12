// Public HTTPS reads only. POST endpoints below inspect state/receipts; no preparation or signing.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {recordedPayment} from "../ui/proof-model.js";
const origin="https://recall-navy-phi.vercel.app";
const saved=JSON.parse(await readFile(new URL("../live/wallet-run-2026-09-07.json",import.meta.url),"utf8"));
const checks=[];
for(const path of ["/", "/compare"]){
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(15000),redirect:"error"});
  assert.equal(response.status,200);
  assert.match(await response.text(),/Find a service that fits/);
  checks.push({path,status:200});
}
async function request(path,status,body,foreign=false){
  const started=Date.now();
  const options={signal:AbortSignal.timeout(45000),redirect:"error"};
  if(body!==undefined)Object.assign(options,{method:"POST",headers:{"Content-Type":"application/json",Origin:foreign?"https://foreign.invalid":origin},body:JSON.stringify(body)});
  const response=await fetch(origin+path,options);
  const raw=await response.text();
  let data;
  try { data=JSON.parse(raw); } catch { data={error:raw.slice(0,300)}; }
  assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);
  checks.push({path,status:response.status,ms:Date.now()-started,foreign_origin:foreign});
  return data;
}
const proof=await request("/api/proof",200);
const reviewPage=await fetch(origin+'/review',{signal:AbortSignal.timeout(15000),redirect:'error'});
assert.equal(reviewPage.status,200);
assert.match(await reviewPage.text(),/Provider review/);
checks.push({path:'/review',status:200});
for(const file of ['review.html','review.js','review.css','review-model.js','compare.html','compare.css','wallet-connect.js','wallet-connection.js','wallet-session.js','wallet-discovery.js','wallet-header.css','wallet.js','workspace.html','commerce-ui.js','purchase.js','proof.html']){
  const path='/'+(file.endsWith('.html')?file.slice(0,-5):file);
  const response=await fetch(origin+path,{signal:AbortSignal.timeout(15000),redirect:'error'});
  assert.equal(response.status,200);
  assert.equal(await response.text(),await readFile(new URL('../ui/'+file,import.meta.url),'utf8'));
  checks.push({path,status:200,exact_asset:true});
}
const reviewConfig=await request('/api/provider-review',200,{op:'config'});
assert.equal(reviewConfig.chain_id,61999);
assert.equal(reviewConfig.version,3);
assert.equal(reviewConfig.source_sha256,createHash('sha256').update(await readFile(new URL('../contracts/provider_review.py',import.meta.url))).digest('hex'));
assert.match(reviewConfig.notice,/still needs wallet-approved live validation/);
const legacyReview=await request('/api/provider-review',200,{op:'inspect',deployment:'0x1167f2cb913367d073d3e41ddfb8f613b55091c8bdc6830107a8f79191f34d8d'});
assert.equal(legacyReview.state.version,1);
assert.equal(legacyReview.state.digest,'f15993d352e5e0b9108054383d28560bdb97cfc99c58ae1e7097dcbeff289972');
const rejectedReview=await request('/api/provider-review',200,{op:'receipt',hash:'0x77b9f044eb9a2740ec0adeb30781fce5ce7f26431e6efaf11fb23c72857d3329'});
assert.equal(rejectedReview.status,'FINALIZED');assert.equal(rejectedReview.execution,'ERROR');
assert.equal(rejectedReview.consensus_result,'MAJORITY_DISAGREE');assert.equal(rejectedReview.value_wei,'0');
assert.equal(createHash('sha256').update(rejectedReview.args[0]).digest('hex'),'4f78608d2fbafda2deff2fb1778efcbb592b374f27c08e227bc1e0b43f146b17');
await request('/api/provider-review',403,{op:'config'},true);
await request('/api/provider-review',400,{op:'capture',request:{planId:'unlisted',requirements:{hours:100,budget:50,noTraining:true,speakers:false}}});
await request('/api/provider-review',400,{op:'submit'});
const catalog=await request("/service-catalog.json",200);
const localCatalog=JSON.parse(await readFile(new URL('../ui/service-catalog.json',import.meta.url),'utf8'));
assert.deepEqual(catalog,localCatalog);
await request("/api/catalog/check",403,{provider:"assembly"},true);
await request("/api/catalog/check",400,{provider:"assembly",url:"https://foreign.invalid"});
const sources=await request("/api/catalog/check",200,{provider:"assembly"});
assert.equal(sources.provider,"assembly");
assert.deepEqual(Object.keys(sources.sources).sort(),["assembly-price","assembly-training"]);
for(const provider of ['speechmatics','soniox','aws']) {
  const result=await request('/api/catalog/check',200,{provider});
  assert.equal(result.provider,provider);
  assert.deepEqual(Object.keys(result.sources).sort(),Object.keys(catalog.sources).filter(k=>catalog.sources[k].provider===provider).sort());
  Object.assign(sources.sources,result.sources);
}
for(const source of Object.values(sources.sources)){
  assert.ok(["retrieved","unavailable"].includes(source.status));
  if(source.status==="retrieved")assert.match(source.sha256,/^[a-f0-9]{64}$/);
}
assert.equal(proof.report.source_sha256,saved.source_sha256);
assert.equal(proof.report.receipts.length,11);
assert.equal(proof.capabilities.scripted_demo,false);
assert.equal((await request("/api/session/config",200)).chain_id,61999);
assert.equal((await request("/wallet-run.json",200)).session.contract,saved.session.contract);
await request("/api/run",404,{});
await request("/api/session/inspect",403,{deployment:saved.session.deployment},true);
const session=await request("/api/session/inspect",200,{deployment:saved.session.deployment});
assert.equal(session.contract,saved.session.contract);
const permit=session.snapshot.permits.find(p=>p.id==="p-inference-replacement");
const receipt=await request("/api/session/receipt",200,{hash:saved.receipts.at(-1).hash});
assert.ok(recordedPayment({session,receipts:[receipt]},permit));
assert.equal(receipt.child.to_address.toLowerCase(),permit.recipient.toLowerCase());
assert.equal(BigInt(receipt.child.value),40000000000000000n);
console.log(JSON.stringify({origin,observed_at:new Date().toISOString(),checks,contract:session.contract,payment:receipt.hash,child_transfer:receipt.child.hash,amount_wei:String(receipt.child.value),result:"matched"},null,2));
