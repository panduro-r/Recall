// Public HTTPS reads only. POST endpoints below inspect state/receipts; no preparation or signing.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
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
