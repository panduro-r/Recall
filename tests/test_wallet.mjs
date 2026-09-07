import test from "node:test";
import assert from "node:assert/strict";
import {Wallet, validatePrepared, receiptMatches, verifiedPermitPayment, paymentWindow, ZERO, CHAIN_ID} from "../ui/wallet.js";
const account="0x"+"1".repeat(40), recipient="0x"+"2".repeat(40), contract="0x"+"3".repeat(40), hash="0x"+"a".repeat(64);
function paidCase(){
  const permit={id:"p-storage-v1",status:"SCHEDULED",recipient,amount_wei:"20000000000000000"};
  const session={contract,snapshot:{agreement:{buyer:account}}};
  const review=plan().review;
  const receipt={hash,status:"FINALIZED",execution:"SUCCESS",from:account,to:contract,value_wei:review.value_wei,method:review.action,args:review.args,settlement:"child-finalized",child:{status:"FINALIZED",triggered_by:hash,from_address:contract,to_address:recipient,value:review.value_wei}};
  return {permit,session,entries:[{hash,phase:"complete",review,receipt}]};
}
test("paid summary requires a matching finalized transfer, not just a scheduled permit",()=>{
  const c=paidCase();
  assert.equal(verifiedPermitPayment(c.permit,c.session,c.entries),true);
  assert.equal(verifiedPermitPayment(c.permit,c.session,[]),false);
  assert.equal(verifiedPermitPayment(c.permit,c.session,[{phase:"complete"}]),false);
});
for(const mutation of ["contract","buyer","recipient","amount","permit","link","finality","cancelled"])
test(`paid summary fails closed on mismatched ${mutation}`,()=>{
  const c=paidCase(),e=c.entries[0];
  if(mutation==="contract")c.session.contract=recipient;
  if(mutation==="buyer")c.session.snapshot.agreement.buyer=recipient;
  if(mutation==="recipient")c.permit.recipient=account;
  if(mutation==="amount")c.permit.amount_wei="1";
  if(mutation==="permit")c.permit.id="p-other";
  if(mutation==="link")e.receipt.child.triggered_by="0x"+"b".repeat(64);
  if(mutation==="finality")e.receipt.child.status="ACCEPTED";
  if(mutation==="cancelled")c.permit.status="CANCELLED";
  assert.equal(verifiedPermitPayment(c.permit,c.session,c.entries),false);
});
test("payment window includes safety margin and distinguishes expiry",()=>{
  const claim={review_until:100};
  assert.deepEqual(paymentWindow(claim,1000,104),{state:"waiting",opens:105});
  assert.equal(paymentWindow(claim,1000,105).state,"open");
  assert.equal(paymentWindow(claim,1000,994).state,"open");
  assert.equal(paymentWindow(claim,1000,995).state,"expired");
});
function plan(){return {prepared_at:Date.now()/1000,intent_id:"a".repeat(64),review:{action:"execute_purchase",account,contract,recipient,value_wei:"20000000000000000",chain_id:61999,args:["p-storage-v1"]},transaction:{chainId:CHAIN_ID,from:account,to:ZERO,data:"0x1234",gas:"0x5208",nonce:"0x0",gasPrice:"0x0",value:"0x470de4df820000"}};}
function provider(overrides={}){const calls=[];return {calls,async request(request){calls.push(request);if(overrides[request.method])return overrides[request.method](request);return {eth_chainId:CHAIN_ID,eth_accounts:[account],eth_requestAccounts:[account],eth_sendTransaction:hash}[request.method];}};}
test("valid request is sent exactly once after fresh preparation",async()=>{const p=provider(),w=new Wallet(p);await w.connect();let prepared=0,persisted=0;assert.equal(await w.approve(plan(),async()=>{prepared++;return plan();},()=>persisted++),hash);assert.equal(prepared,1);assert.equal(persisted,1);assert.equal(p.calls.filter(c=>c.method==="eth_sendTransaction").length,1);});
for(const [field,value] of [["chainId","0x1"],["to",recipient],["gasPrice","0x1"],["from",recipient],["value","0x1"]])test(`reject unsafe transaction ${field}`,()=>{const p=plan();p.transaction[field]=value;assert.throws(()=>validatePrepared(p,account));});
test("expired and non-payment value requests are refused",()=>{let p=plan();p.prepared_at-=60;assert.throws(()=>validatePrepared(p,account),/expired/);p=plan();p.review.action="cancel_purchase";assert.throws(()=>validatePrepared(p,account),/value/);p=plan();delete p.prepared_at;assert.throws(()=>validatePrepared(p,account),/Incomplete/);p=plan();p.transaction.maxFeePerGas="0x1";assert.throws(()=>validatePrepared(p,account),/Unexpected/);});
test("wrong wallet network never signs",async()=>{const p=provider({eth_chainId:()=>"0x1"}),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>plan()),/Switch/);assert.equal(p.calls.some(c=>c.method==="eth_sendTransaction"),false);});
test("account change while refreshing never signs",async()=>{let current=account;const p=provider({eth_accounts:()=>[current]}),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>{current=recipient;return plan();}),/account changed/);assert.equal(p.calls.some(c=>c.method==="eth_sendTransaction"),false);});
test("intent change during preflight never signs",async()=>{const p=provider(),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>({...plan(),intent_id:"b".repeat(64)})),/action changed/);assert.equal(p.calls.some(c=>c.method==="eth_sendTransaction"),false);});
test("wallet rejection does not retry",async()=>{const p=provider({eth_sendTransaction:()=>{throw Object.assign(new Error("Rejected"),{code:4001});}}),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>plan()),e=>e.code===4001);assert.equal(p.calls.filter(c=>c.method==="eth_sendTransaction").length,1);assert.equal(w.busy,false);});
test("unknown wallet outcome does not retry",async()=>{const p=provider({eth_sendTransaction:()=>{throw new Error("Connection lost");}}),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>plan()),/Connection lost/);assert.equal(p.calls.filter(c=>c.method==="eth_sendTransaction").length,1);});
test("recovery persistence failure prevents signing",async()=>{const p=provider(),w=new Wallet(p);await w.connect();await assert.rejects(w.approve(plan(),async()=>plan(),()=>{throw new Error("storage full");}),/storage/);assert.equal(p.calls.some(c=>c.method==="eth_sendTransaction"),false);});
test("concurrent wallet requests are blocked",async()=>{let done;const p=provider({eth_sendTransaction:()=>new Promise(resolve=>done=resolve)}),w=new Wallet(p);await w.connect();const first=w.approve(plan(),async()=>plan());await assert.rejects(w.approve(plan(),async()=>plan()),/already/);while(!done)await new Promise(resolve=>setImmediate(resolve));done(hash);await first;assert.equal(p.calls.filter(c=>c.method==="eth_sendTransaction").length,1);});
test("finalized execution alone is not a verified payment",()=>{const review=plan().review;const row={status:"FINALIZED",execution:"SUCCESS",from:account,to:contract,value_wei:review.value_wei,method:review.action,args:review.args};assert.equal(receiptMatches(row,review),false);row.settlement="child-finalized";row.child={to_address:recipient,value:review.value_wei};assert.equal(receiptMatches(row,review),true);row.child.to_address=account;assert.equal(receiptMatches(row,review),false);row.child.to_address=recipient;row.method="cancel_purchase";assert.equal(receiptMatches(row,review),false);});
test("network switch never submits a transaction",async()=>{const p=provider(),w=new Wallet(p);await w.switchNetwork();assert.equal(p.calls.some(c=>c.method==="eth_sendTransaction"),false);assert.equal(w.account,account);});
test("deployment receipt must match the reviewed parties and constructor arguments",()=>{const review={...plan().review,action:"deploy",value_wei:"0",source_sha256:"source",args:[recipient,contract,account]};const row={status:"FINALIZED",execution:"SUCCESS",from:account,value_wei:"0",source_sha256:"source",args:[recipient,contract,account]};assert.equal(receiptMatches(row,review),true);row.args=[account,recipient,contract];assert.equal(receiptMatches(row,review),false);});
