import {Wallet, receiptMatches, verifiedPermitPayment, paymentWindow} from "./wallet.js";
import {amount, humanize, displayName} from "./model.js";

const $ = id => document.getElementById(id);
const KEY = "recall.studio.wallet-run.v1";
const actionNames = {
  accept_terms:["Accept agreement", "Seller", "Accept the buyer's fixed EU-only criterion."],
  publish_claim:["Publish an offer", "Seller", "Choose a pinned offer and its payment recipient."],
  evaluate_claim:["Evaluate evidence", "Buyer or agent", "Ask Studio validators to evaluate the published evidence."],
  queue_purchase:["Reserve purchase", "Buyer or agent", "Reserve budget. This sends no funds."],
  challenge_claim:["Challenge the original offer", "Challenger", "Submit the applicable amendment before the ten-minute review window closes."],
  resolve_challenge:["Resolve challenge", "Any agreement role", "Evaluate the original evidence and amendment together."],
  cancel_purchase:["Cancel reserved purchase", "Buyer", "Cancel this permit permanently and release its reserved budget. No refund is needed because it has not been paid."],
  execute_purchase:["Execute payment", "Buyer", "Send the exact permit amount after review, only while the claim is valid."]
};
let cfg=null, wallet=null, session=null, draft=null, busy=false, receiptBusy=false, pollTimer=null, pollCount=0;
let journal={deployment:"",entries:[]}, storageUsable=true;
const providers=new Map();
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const stamp=value=>new Date(value*1000).toLocaleString();
function message(text){$("flow-message").textContent=text;}
function error(text){$("flow-error").textContent=text;$("flow-error").hidden=!text;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(journal));}catch{storageUsable=false;throw new Error("Browser storage is unavailable. Enable it before requesting a transaction so an uncertain submission can be recovered.");}}
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||"null");
  if(saved && typeof saved.deployment==="string" && Array.isArray(saved.entries) && saved.entries.length<=100 && saved.entries.every(e=>e&&typeof e.action==="string"&&["awaiting-wallet","submitted","complete","failed","uncertain","not-sent"].includes(e.phase)))journal=saved;
}catch{storageUsable=false;}
for(const entry of journal.entries)if(entry.phase==="awaiting-wallet")entry.phase="uncertain";
function unfinished(){return journal.entries.find(e=>!["complete","failed","not-sent"].includes(e.phase));}
function invalidate(){draft=null;$("review-section").hidden=true;}
function controls(){
  const blocked=busy||!!unfinished()||!storageUsable;
  $("connect-wallet").disabled=busy||!providers.size;
  $("wallet-provider").disabled=busy;
  $("switch-network").disabled=busy||!wallet;
  $("deploy-fields").disabled=!cfg||!wallet?.account||blocked||!!session||!!journal.deployment;
  $("action-fields").disabled=!cfg||!wallet?.account||!session||blocked;
  const action=$("action").value;
  const noChoice=action!=="accept_terms" && !$( ["cancel_purchase","execute_purchase"].includes(action)?"permit-choice":"claim-choice").value;
  $("action-form").querySelector("button[type=submit]").disabled=noChoice;
  $("approve-wallet").disabled=!draft||blocked||!wallet?.account;
  $("discard-review").disabled=busy;
  $("refresh-session").disabled=busy||!journal.deployment;
  $("new-agreement").disabled=blocked;
  $("refresh-receipts").disabled=busy||receiptBusy||!journal.entries.some(e=>e.hash);
  $("wallet-badge").textContent=wallet?.account?"Account connected":"Disconnected";
  $("wallet-account").textContent=wallet?.account||"";
  $("wallet-shortcut").textContent=wallet?.account?'Wallet · '+wallet.account.slice(0,6)+'…'+wallet.account.slice(-4):'Connect wallet';
  $("uncertain-section").hidden=!journal.entries.some(e=>e.phase==="uncertain");
}
async function api(path, data){
  const response=await fetch(path,{...(data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Studio request unavailable. Refresh before continuing.");
  return result;
}
async function task(fn){if(busy)return;busy=true;error("");controls();try{await fn();}catch(e){error(e.name==="TimeoutError"?"The read request timed out. No transaction was submitted by the server. Try refreshing.":e.message);}finally{busy=false;controls();}}
function addProvider(id,name,provider){
  if(!provider?.request||providers.has(id))return;
  providers.set(id,{name,provider});const selected=$("wallet-provider").value;
  $("wallet-provider").replaceChildren(...[...providers].map(([id,w])=>{const option=node("option",w.name);option.value=id;return option;}));
  if(providers.has(selected))$("wallet-provider").value=selected;
  controls();
}
window.addEventListener("eip6963:announceProvider",event=>{const info=event.detail?.info;if(typeof info?.uuid==="string"&&typeof info.name==="string")addProvider(info.uuid,info.name.slice(0,80),event.detail.provider);});
window.dispatchEvent(new Event("eip6963:requestProvider"));
if(window.ethereum)addProvider("injected","Browser wallet",window.ethereum);
$("connect-wallet").onclick=()=>task(async()=>{
  const selected=providers.get($("wallet-provider").value);if(!selected)throw new Error("Open this page in a browser with your wallet extension.");
  wallet?.dispose();invalidate();wallet=new Wallet(selected.provider,()=>{invalidate();message("Wallet account or network changed. Reconnect before reviewing another action.");controls();});
  await wallet.connect();message("Account connected. Use Switch to Studio before approving a transaction.");
});
$("switch-network").onclick=()=>task(async()=>{await wallet.switchNetwork();message("Wallet connected to Studio. Select the appropriate account for each role.");});
$("wallet-provider").onchange=()=>{wallet?.dispose();wallet=null;invalidate();controls();};

function renderSession(){
  $("session-empty").hidden=!!session;$("session-content").hidden=!session;
  if(!session){controls();return;}
  const state=session.snapshot, agreement=state.agreement;
  $("session-status").textContent=`Finalized state read ${stamp(session.observed_at)}. ${Date.now()/1000>=agreement.expires_at?"Agreement expired; no new purchases or payments.":"Refresh to check changes made by another role."}`;
  const fields=[["Contract",session.contract],["Buyer",agreement.buyer],["Seller",agreement.seller],["Agent",agreement.agent],["Challenger",agreement.challenger],["Terms",agreement.accepted?"Accepted":"Awaiting seller acceptance"],["Buyer balance",amount(session.buyer_balance_wei)],["Reserved limit",amount(agreement.reserved_wei)],["Scheduled amount",amount(agreement.spent_wei)],["Expires",stamp(agreement.expires_at)]];
  $("session-summary").replaceChildren(...fields.flatMap(([k,v])=>[node("dt",k),node("dd",v)]));
  $("live-claims").replaceChildren(...state.claims.map(claim=>{
    const section=node("section",undefined,"live-claim"), permit=state.permits.find(p=>p.claim_id===claim.id);
    const paid=verifiedPermitPayment(permit,session,journal.entries);
    section.append(node("h3",displayName(claim)[0]),node("p",paid?`Paid · Recipient transfer verified · ${amount(permit.amount_wei)}`:`Claim: ${claim.status} · Permit: ${permit?.status||"Not reserved"} · ${amount(claim.amount_wei)}`,paid?"good":""),node("p",claim.judgment?.reason||"Evidence has not been evaluated.","small"));
    if(paid)section.append(node("p",`Claim: ${claim.status} · Contract permit: SCHEDULED (consumed). The matching finalized transfer confirms payment; do not pay again.`,"small"));
    else if(permit?.status==="SCHEDULED")section.append(node("p","Payment submitted · transfer not verified here. If its transaction is listed below, use Check receipts. Otherwise inspect the original payment hash in Studio. Do not send another payment.","small"));
    else if(permit?.status==="CANCELLED")section.append(node("p","Reservation cancelled. No payment or refund; this permit cannot be reused.","small"));
    else if(claim.status==="DISPUTED")section.append(node("p",`Payment blocked by dispute. Resolve before ${stamp(claim.resolve_until-5)}, including the safety margin, or the buyer can cancel an unpaid reservation.`,"small"));
    else if(claim.status==="VALID"){
      const timing=paymentWindow(claim,agreement.expires_at);
      const help=timing.state==="expired"?"Agreement expired or too close to expiry. Payment is blocked; the buyer can cancel an unpaid reservation."
        :timing.state==="waiting"?`Payment review opens ${stamp(timing.opens)} (your local time; includes a five-second safety margin). ${permit?"Refresh state then; nothing is paid automatically.":"Reserve this offer first; reservation sends no funds."}`
        :permit?"Review period elapsed. Refresh state, then the buyer can review the exact payment. Nothing is paid automatically.":"Review period elapsed. Reserve this offer before reviewing payment.";
      section.append(node("p",help,"small"));
    }
    section.append(node("p",`Claim ID: ${claim.id}`,"small"));
    const link=node("a","Read pinned offer ↗","source-link");link.href=cfg.source_root+cfg.evidence[claim.id]?.path;link.target="_blank";link.rel="noopener noreferrer";
    if(cfg.evidence[claim.id])section.append(link);
    return section;
  }));
  actionFields();controls();
}
function actionFields(){
  const action=$("action").value, needsPermit=["cancel_purchase","execute_purchase"].includes(action);
  $("action-help").textContent=actionNames[action]?.[2]||"";
  $("claim-row").hidden=needsPermit||action==="accept_terms";
  $("permit-row").hidden=!needsPermit;
  $("recipient-row").hidden=action!=="publish_claim";
  $("recipient").required=action==="publish_claim";
  const oldClaim=$("claim-choice").value, oldPermit=$("permit-choice").value;
  const offers=action==="publish_claim"?cfg?.offers.filter(o=>!session?.snapshot.claims.some(c=>c.id===o.id)):session?.snapshot.claims;
  $("claim-choice").replaceChildren(...(offers||[]).map(c=>{const option=node("option",`${displayName(c)[0]} · ${c.id}`);option.value=c.id;return option;}));
  if([...$("claim-choice").options].some(o=>o.value===oldClaim))$("claim-choice").value=oldClaim;
  $("permit-choice").replaceChildren(...(session?.snapshot.permits||[]).filter(p=>p.status==="RESERVED").map(p=>{const option=node("option",`${p.id} · ${amount(p.amount_wei)}`);option.value=p.id;return option;}));
  if([...$("permit-choice").options].some(o=>o.value===oldPermit))$("permit-choice").value=oldPermit;
  for(const [id,label] of [["claim-choice",action==="publish_claim"?"No unpublished offers":"No published claims"],["permit-choice","No reserved permits — paid and cancelled permits cannot be reused"]]){
    if(!$(id).options.length){const option=node("option",label);option.value="";option.disabled=true;$(id).replaceChildren(option);$(id).value="";}
  }
  controls();
}
async function inspect(){
  if(!journal.deployment)return;
  session=await api("/api/session/inspect",{deployment:journal.deployment});
  renderSession();message("Fresh finalized agreement state loaded. Contract rules are checked again before every wallet request.");
}
async function reviewRequest(request){
  if(unfinished())throw new Error("Resolve the current wallet request or pending transaction first.");
  await wallet.assertIdentity(wallet.account);
  const result=await api("/api/session/prepare",request);
  draft={request,plan:result};
  const r=result.review;
  const fields=[["Action",r.action==="deploy"?"Deploy Recall agreement":actionNames[r.action][0]],["Network","GenLayer Studio · 61999 · Test GEN"],["Signing account",r.account],["Recall contract",r.action==="deploy"?"New deployment":r.contract],["Payment recipient",r.recipient||"No payment in this action"],["Value sent",amount(r.value_wei)],["Transport gas price","0 · Refuses paid transport"],["Source SHA-256",r.source_sha256]];
  $("review-fields").replaceChildren(...fields.flatMap(([k,v])=>[node("dt",k),node("dd",v)]));
  $("review-args").textContent=JSON.stringify(r.args,null,2);$("review-section").hidden=false;
  $("review-section").scrollIntoView({block:"start"});message("Review prepared. Nothing has been signed or submitted.");
}
$("deploy-form").onsubmit=e=>{
  e.preventDefault();
  // Capture enabled controls before task() disables the fieldset while busy.
  const request={account:wallet.account,action:"deploy",fields:Object.fromEntries(
    [...new FormData(e.currentTarget)].map(([name,value])=>[name,value.trim()])
  )};
  return task(()=>reviewRequest(request));
};
$("action-form").onsubmit=e=>{e.preventDefault();task(()=>{
  const action=$("action").value, fields={};
  if(action!=="accept_terms"){
    if(["cancel_purchase","execute_purchase"].includes(action))fields.permit_id=$("permit-choice").value;
    else fields.claim_id=$("claim-choice").value;
    if(action==="publish_claim")fields.recipient=$("recipient").value.trim();
  }
  return reviewRequest({account:wallet.account,action,fields,deployment:journal.deployment});
});};
for(const id of ["deploy-form","action-form"]){$(id).addEventListener("input",invalidate);$(id).addEventListener("change",invalidate);}
$("action").onchange=actionFields;
$("discard-review").onclick=()=>{invalidate();message("Review discarded. Nothing was submitted.");};
$("resume-form").onsubmit=e=>{e.preventDefault();task(async()=>{
  if(unfinished())throw new Error("Resolve the pending wallet request before changing agreements.");
  const hash=$("deployment-hash").value.trim();const next=await api("/api/session/inspect",{deployment:hash});
  invalidate();journal.deployment=hash;session=next;save();renderSession();message("Verified Recall agreement loaded.");
});};
$("refresh-session").onclick=()=>task(async()=>{invalidate();await inspect();});
$("new-agreement").onclick=()=>{if(busy||unfinished())return;try{invalidate();session=null;journal.deployment="";save();$("deployment-hash").value="";renderSession();message("Ready for a new agreement. Previous contracts and transaction history are unchanged.");$("wallet-section").scrollIntoView({block:"start"});}catch(e){error(e.message);}};

function renderHistory(){
  if(!journal.entries.length){$("flow-history").replaceChildren(node("p","No transactions requested from this browser yet.","muted"));controls();return;}
  $("flow-history").replaceChildren(...journal.entries.slice().reverse().map(entry=>{
    const section=node("section",undefined,"flow-event");section.append(node("strong",entry.action==="deploy"?"Deploy Recall":actionNames[entry.action]?.[0]||entry.action));
    const row=entry.receipt;
    let status={"awaiting-wallet":"Awaiting wallet approval",submitted:"Submitted · waiting for network",complete:"Finalized · verified execution",failed:"Finalized · execution failed",uncertain:"Submission uncertain · inspect wallet", "not-sent":"Not submitted"}[entry.phase];
    if(row&&entry.phase!=="complete")status=`${row.status} · Execution: ${row.execution}${row.status==="FINALIZED"&&row.execution==="SUCCESS"?" · Request or recipient transfer not yet verified":""}`;
    if(entry.phase==="complete"&&BigInt(entry.review?.value_wei||0)>0)status="Finalized · recipient transfer verified";
    section.append(node("p",status,entry.phase==="complete"?"good":entry.phase==="failed"?"bad":"muted"));
    if(entry.hash)section.append(node("code",entry.hash));
    section.append(node("p",`Requested ${stamp(entry.created_at)}${row?.observed_at?" · Checked "+stamp(row.observed_at):""}`));
    if(row?.child)section.append(node("p",`Child transfer ${row.child.hash} · Recipient ${row.child.to_address} · ${amount(row.child.value)}`));
    return section;
  }));controls();
}
async function refreshReceipts(){
  if(receiptBusy)return;receiptBusy=true;controls();
  try{
    for(const entry of journal.entries.filter(e=>e.hash&&!["complete","failed","not-sent"].includes(e.phase)).slice(0,4)){
      const row=await api("/api/session/receipt",{hash:entry.hash});entry.receipt=row;
      if(receiptMatches(row,entry.review))entry.phase="complete";
      else if(row.status==="FINALIZED"&&row.execution==="ERROR")entry.phase="failed";
      if(entry.phase==="complete"&&entry.action==="deploy")journal.deployment=entry.hash;
      save();
    }
    renderHistory();if(journal.deployment)await inspect();
  }catch(e){error("Could not refresh network progress: "+e.message+" Existing results may be stale. Do not resend a pending transaction.");}
  finally{receiptBusy=false;controls();}
}
function schedulePoll(){
  clearTimeout(pollTimer);
  if(!unfinished()?.hash)return;
  if(pollCount++>=12){message("Automatic checking paused. Use Check receipts to continue; no transaction will be resent.");return;}
  pollTimer=setTimeout(async()=>{if(document.hidden){message("Automatic checking paused while this page was hidden. Use Check receipts when ready.");return;}await refreshReceipts();schedulePoll();},6000);
}
$("refresh-receipts").onclick=()=>task(refreshReceipts);
$("approve-wallet").onclick=()=>task(async()=>{
  const current=draft;if(!current||unfinished())throw new Error("Prepare a new review first.");
  let entry=null;
  message("Rechecking network and eligibility. Then approve or reject the request in your wallet.");
  try{
    const hash=await wallet.approve(current.plan,()=>api("/api/session/prepare",current.request),()=>{
      entry={action:current.plan.review.action,review:current.plan.review,phase:"awaiting-wallet",created_at:Date.now()/1000};
      journal.entries.push(entry);save();renderHistory();message("Waiting for your wallet. Do not open another request.");
    });
    entry.hash=hash;entry.phase="submitted";save();invalidate();renderHistory();
    message("Transaction submitted. Waiting for finalized execution; accepted is not the same as paid.");
    await refreshReceipts();pollCount=0;schedulePoll();
  }catch(e){
    if(entry){entry.phase=e.code===4001?"not-sent":"uncertain";try{save();}catch{}invalidate();renderHistory();}
    throw new Error(e.code===4001?"Wallet request rejected. No automatic retry was made.":e.message);
  }
});
$("recover-form").onsubmit=e=>{e.preventDefault();task(async()=>{
  const entry=journal.entries.find(e=>e.phase==="uncertain");if(!entry)return;
  entry.hash=$("recover-hash").value.trim();entry.phase="submitted";save();await refreshReceipts();pollCount=0;schedulePoll();
});};
$("confirm-not-sent").onclick=()=>{const entry=journal.entries.find(e=>e.phase==="uncertain");if(!entry)return;entry.phase="not-sent";try{save();error("");message("Marked not submitted based on your wallet check. A new review is required.");}catch(e){error(e.message);}renderHistory();};
window.addEventListener("storage",event=>{if(event.key===KEY){invalidate();error("This run changed in another tab. Reload before submitting anything else.");storageUsable=false;controls();}});
async function init(){
  try{
    cfg=await api("/api/session/config");$("flow-criterion").textContent=cfg.criterion;
    $("action").replaceChildren(...Object.entries(actionNames).map(([id,[label,role]])=>{const option=node("option",`${label} · ${role}`);option.value=id;return option;}));
    $("retry-config").hidden=true;actionFields();controls();renderHistory();
    message(providers.size?"Connect your wallet to begin, or resume a verified deployment.":"No wallet detected here. Open this URL in a browser with your wallet extension to begin.");
    if(!storageUsable)error("Browser storage could not be read safely. Transactions are disabled until storage is available.");
    if(journal.deployment){$("deployment-hash").value=journal.deployment;await inspect();}
    if(unfinished())message("A previous request needs attention. Check transaction progress before making another request.");
  }catch(e){error(e.message);$("retry-config").hidden=false;}
}
$("retry-config").onclick=()=>task(init);
init();
