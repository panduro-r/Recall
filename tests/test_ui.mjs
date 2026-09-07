import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {amount, paymentState, transferFor, safeSource} from "../ui/model.js";
const report=JSON.parse(readFileSync(new URL("../live/full-flow-report.json",import.meta.url),"utf8"));
const state=report.final_state;
test("wei formatting is exact, including small and large values",()=>{
  assert.equal(amount("1"),"0.000000000000000001 GEN");
  assert.equal(amount("100000000000000000"),"0.100 GEN");
  assert.equal(amount("123456789012345678901234567890"),"123456789012.34567890123456789 GEN");
});
test("recorded transfers require finalized parent and matching child",()=>{
  for(const p of state.permits){const c=state.claims.find(c=>c.id===p.claim_id);assert.equal(paymentState(report,p,c)[0],p.status==="CANCELLED"?"Not paid":"Transfer verified");}
  const p=state.permits.find(p=>p.status==="SCHEDULED");
  for(const key of ["triggered_by","to_address","from_address","value","status"]){const changed=structuredClone(report);const child=changed.independent_verification.child_transfers.find(t=>t.to_address===p.recipient);child[key]=key==="value"?"1":"wrong";assert.equal(transferFor(changed,p),null,key);}
  const changed=structuredClone(report);changed.steps.find(s=>s.step===`pay-${p.claim_id}`).execution="ERROR";assert.equal(transferFor(changed,p),null);
});
test("local scheduled messages never claim payment",()=>{const p=state.permits.find(p=>p.status==="SCHEDULED");assert.equal(paymentState(null,p,{status:"VALID"})[0],"Scheduled · unverified");});
test("source links only expose the recorded repository's HTTPS documents",()=>{
  assert.ok(safeSource(state.claims[0].url));
  for(const url of ["javascript:alert(1)","https://evil.test/panduro-r/Recall/x","https://raw.githubusercontent.com/example/recall-fixtures/a","http://raw.githubusercontent.com/panduro-r/Recall/x"]){assert.equal(safeSource(url),null);}
});
