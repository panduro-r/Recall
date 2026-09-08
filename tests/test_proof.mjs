import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {recordedPayment,recordedOutcome} from "../ui/proof-model.js";
const source=await readFile(new URL("../live/wallet-run-2026-09-07.json",import.meta.url),"utf8");
const record=()=>JSON.parse(source);
test("archived original and replacement remain separate",()=>{
  const r=record(),[original,replacement]=r.session.snapshot.claims;
  assert.equal(recordedOutcome(r,original).label,"Canceled · not paid");
  assert.equal(recordedOutcome(r,replacement).label,"Paid · transfer verified");
});
test("recorded example shares product styling and routes back to current purchases",async()=>{
  const html=await readFile(new URL("../ui/proof.html",import.meta.url),"utf8");
  assert.ok(html.includes('href="/workspace.css"'));
  assert.ok(!html.includes('href="/style.css"'));
  assert.ok(!html.includes('href="/purchase"'));
  assert.ok(html.includes('not your current purchase'));
  assert.ok(html.includes('No transactions are sent from this page'));
  assert.ok(html.includes('id="proof-content" class="example-surface" hidden'));
  for(const tab of ["terms","activity","details"]){
    assert.ok(html.includes(`id="example-tab-${tab}" role="tab" aria-controls="example-panel-${tab}"`));
    assert.ok(html.includes(`role="tabpanel" aria-labelledby="example-tab-${tab}"`));
  }
});
for(const mutation of ["parent","child","recipient","amount","permit","execution","sender","contract","method"]){
  test(`archive withholds payment for changed ${mutation}`,()=>{
    const r=record(),p=r.session.snapshot.permits[1],row=r.receipts.at(-1);
    if(mutation==="parent")row.child.triggered_by="0xbad";
    if(mutation==="child")row.child.status="PENDING";
    if(mutation==="recipient")p.recipient=r.session.snapshot.agreement.buyer;
    if(mutation==="amount")p.amount_wei="1";
    if(mutation==="permit")p.status="RESERVED";
    if(mutation==="execution")row.execution="ERROR";
    if(mutation==="sender")row.from=p.recipient;
    if(mutation==="contract")row.child.from_address=p.recipient;
    if(mutation==="method")row.method="other";
    assert.equal(recordedPayment(r,p),null);
  });
}
