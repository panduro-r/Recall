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
