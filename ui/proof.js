import {amount,displayName,safeSource,humanize} from "./model.js";
import {recordedOutcome} from "./proof-model.js";
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
let bundle=null,selected="inference-v1";
const tabs=["terms","activity","details"];
function setTab(name,focus=false){
  for(const key of tabs){const active=key===name,tab=$("example-tab-"+key);tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;$("example-panel-"+key).hidden=!active;}
  if(focus)$("example-tab-"+name).focus();
}
for(const [index,key] of tabs.entries()){
  const tab=$("example-tab-"+key);
  tab.onclick=()=>setTab(key);
  tab.onkeydown=event=>{
    const next=event.key==="ArrowRight"?(index+1)%tabs.length:event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:event.key==="Home"?0:event.key==="End"?tabs.length-1:null;
    if(next!==null){event.preventDefault();setTab(tabs[next],true);}
  };
}
function fields(target,rows){
  $(target).replaceChildren(...rows.flatMap(([name,value])=>[el("dt",name),el("dd",value,/^(0x|[a-f0-9]{64}$)/i.test(String(value))?"reference":"")]));
}
function documentIcon(){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.5");svg.setAttribute("aria-hidden","true");svg.classList.add("example-icon");
  const path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d","M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5M8 12h8M8 16h6");svg.append(path);return svg;
}
function documentView(name,title){
  const doc=bundle.report.evidence[name],section=el("details",undefined,"proof-document"),summary=el("summary"),label=el("span",undefined,"document-title"),plus=el("span","+");
  plus.setAttribute("aria-hidden","true");label.append(documentIcon(),document.createTextNode(title));summary.append(label,plus);section.append(summary);
  section.append(el("pre",bundle.documents[name+".txt"]||"Document unavailable."));
  section.append(el("p","SHA-256 · "+doc.sha256,"hash"));
  const url=safeSource(bundle.report.session.snapshot.agreement.source_root+doc.path);
  if(url){const a=el("a","Open pinned source ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";section.append(a);}
  return section;
}
const actionNames={deploy:"Agreement created",accept_terms:"Supplier accepted the conditions",publish_claim:"Supplier proposal published",evaluate_claim:"Terms assessed",challenge_claim:"Changed terms submitted",resolve_challenge:"Amendment assessed",cancel_purchase:"Purchase canceled",queue_purchase:"Budget reserved",execute_purchase:"Payment requested"};
function receiptView(row){
  const complete=row.status==="FINALIZED"&&row.execution==="SUCCESS";
  const details=el("details",undefined,"example-event"+(complete?" complete":"")),summary=el("summary"),title=el("span");
  const subject=String(row.args?.[0]||"");
  const context=subject.includes("inference-replacement")?"Replacement purchase":subject.includes("inference-v1")?"Original purchase":"Shared agreement";
  title.append(el("strong",actionNames[row.method||"deploy"]||humanize(row.method.replaceAll("_"," "))),el("small",context));
  summary.append(title,el("span",complete?"Completed":row.status+" · "+row.execution,"event-state"));
  const body=el("div",undefined,"event-body");
  body.append(el("p",row.hash),el("pre",JSON.stringify(row,null,2)));details.append(summary,body);return details;
}
function render(){
  const report=bundle.report,state=report.session.snapshot,claim=state.claims.find(c=>c.id===selected);
  const outcome=recordedOutcome(report,claim),original=claim.id==="inference-v1",canceled=outcome.permit?.status==="CANCELLED",paid=Boolean(outcome.payment);
  $("purchases").replaceChildren(...state.claims.map(c=>{
    const o=recordedOutcome(report,c),button=el("button",undefined,"example-choice");
    button.type="button";button.dataset.claim=c.id;button.setAttribute("aria-current",String(c.id===selected));
    const status=o.payment?"Transfer verified":o.permit?.status==="CANCELLED"?"Canceled · not paid":"Payment unverified";
    button.append(el("span",c.id==="inference-v1"?"Original purchase":"Replacement purchase","choice-label"),el("strong",displayName(c)[0]),el("span",amount(c.amount_wei).replace(" GEN"," test GEN"),"choice-amount"),el("span",status,"choice-status "+o.tone));
    button.onclick=()=>{selected=c.id;render();setTab("terms");document.querySelector('[data-claim="'+selected+'"]').focus({preventScroll:true});$("proof-message").textContent=displayName(c)[0]+". "+o.label;};
    return button;
  }));
  $("proof-selection").textContent=original?"ORIGINAL PURCHASE":"SEPARATELY REVIEWED REPLACEMENT";
  $("proof-title").textContent=displayName(claim)[0];
  $("proof-status").textContent=outcome.label;$("proof-status").className="tag "+(paid?"green":canceled?"red":"");
  $("proof-raw").textContent="Recorded contract state · Claim: "+claim.status+" · Permit: "+(outcome.permit?.status||"Not reserved")+" · Claim ID: "+claim.id;
  const supported=claim.status==="VALID";
  $("proof-assessment").className="example-assessment "+(supported?"good":claim.status==="INVALID"?"bad":"neutral");
  $("proof-assessment-title").textContent=supported?"The terms support the condition":claim.status==="INVALID"?"The amended terms no longer qualify":"Assessment not established";
  $("proof-explanation").textContent=original
    ?"The original offer committed to EU-only data handling. A later binding amendment allowed US processing. GenLayer assessed both documents together; the saved judgment no longer supported the buyer’s condition."
    :"The supplier offered a separate EU-dedicated service. Its terms committed to EU-only processing, storage and support access. It went through its own assessment and ten-minute review window.";
  $("proof-judgment").textContent=claim.judgment?.reason||"No recorded explanation.";
  $("proof-criterion").textContent=state.agreement.criterion;
  $("proof-documents").replaceChildren(...(original?[documentView("inference-v1","Original order · EU-only commitments"),documentView("inference-amendment","Binding amendment · US processing permitted")]:[documentView("inference-replacement","Replacement order · EU-dedicated commitments")]));
  $("proof-amount-label").textContent=paid?"Paid to supplier":canceled?"Canceled purchase amount":"Proposed amount";
  $("proof-amount").replaceChildren(document.createTextNode(amount(paid?outcome.payment.child.value:claim.amount_wei).replace(" GEN","")),el("span","test GEN"));
  $("proof-outcome-title").textContent=paid?"Supplier paid":canceled?"Canceled before payment":"Payment not verified";
  $("proof-outcome-title").className="example-outcome-title "+outcome.tone;
  $("proof-outcome-copy").textContent=paid?"The saved receipt verifies the exact recipient transfer. The original purchase stayed canceled."
    :canceled?"The buyer canceled the reservation. No payment was sent for this purchase, so no refund was needed."
    :"A contract status alone is not enough. This record does not establish a matching recipient transfer.";
  $("proof-transfer").hidden=!paid;$("proof-view-receipt").hidden=!paid;
  $("proof-transfer-fields").replaceChildren();
  if(paid)fields("proof-transfer-fields",[["Amount",amount(outcome.payment.child.value).replace(" GEN"," test GEN")],["Recipient",outcome.payment.child.to_address],["Payment hash",outcome.payment.hash],["Child transfer",outcome.payment.child.hash]]);
  $("proof-receipts").replaceChildren(...report.receipts.map(receiptView));
  $("proof-coverage").textContent=report.coverage.receipt_count+" saved receipts, shown in order. The original reservation receipt was not captured; its canceled permit is recorded in finalized state.";
  fields("proof-properties",[["Network","GenLayer Studio · 61999"],["Contract",report.session.contract],["Test budget",amount(state.agreement.budget_wei).replace(" GEN"," test GEN")],["Source SHA-256",report.source_sha256]]);
  $("proof-observed").textContent="Public receipts last checked "+new Date(report.observed_at_utc).toLocaleString()+" (your local time).";
  $("proof-studio").href="https://studio.genlayer.com/?import-contract="+encodeURIComponent(report.session.contract);
}
$("proof-view-receipt").onclick=()=>{setTab("activity",true);$("proof-transfer").scrollIntoView({block:"nearest"});};
async function load(){
  $("proof-error").hidden=true;$("proof-retry").disabled=true;$("proof-content").hidden=true;
  $("proof-message").className="example-loading";$("proof-message").textContent="Loading the saved evidence…";
  try{
    const response=await fetch("/api/proof",{signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!response.ok)throw Error(data.error||"The saved report is unavailable.");
    bundle=data;render();$("proof-content").hidden=false;$("proof-message").className="example-sr-only";$("proof-message").textContent="Recorded example loaded. Original canceled; replacement reviewed separately. No fresh network check.";
  }catch(error){
    bundle=null;$("proof-content").hidden=true;
    $("proof-error-text").textContent=error.name==="TimeoutError"?"The report took too long to load. Try again.":"The saved evidence could not be loaded. Try again.";
    $("proof-error").hidden=false;$("proof-message").textContent="Recorded evidence unavailable. No payment outcome established on this page.";
  }finally{$("proof-retry").disabled=false;}
}
$("proof-retry").onclick=load;
load();
