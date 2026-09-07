import {amount,displayName,safeSource,humanize} from "./model.js";
import {recordedOutcome} from "./proof-model.js";
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
let bundle=null,selected="inference-v1";
function fields(target,rows){$(target).replaceChildren(...rows.flatMap(([name,value])=>[el("dt",name),el("dd",value)]));}
function documentView(name,title){
  const doc=bundle.report.evidence[name],section=el("details",undefined,"proof-document");
  section.append(el("summary",title));
  section.append(el("pre",bundle.documents[name+".txt"]||"Document unavailable."));
  section.append(el("p","SHA-256 · "+doc.sha256,"hash"));
  const url=safeSource(bundle.report.session.snapshot.agreement.source_root+doc.path);
  if(url){const a=el("a","Open pinned source ↗","source-link");a.href=url;a.target="_blank";a.rel="noopener noreferrer";section.append(a);}
  return section;
}
function render(){
  const report=bundle.report,state=report.session.snapshot,claim=state.claims.find(c=>c.id===selected);
  const outcome=recordedOutcome(report,claim);
  $("purchases").replaceChildren(...state.claims.map(c=>{
    const o=recordedOutcome(report,c),button=el("button",undefined,"purchase");
    button.setAttribute("aria-current",String(c.id===selected));
    button.append(el("strong",displayName(c)[0]),el("span",amount(c.amount_wei),"mono"),el("span",o.label,"payment-label "+o.tone));
    button.onclick=()=>{selected=c.id;render();};return button;
  }));
  $("proof-title").textContent=displayName(claim)[0];
  $("proof-status").textContent=outcome.label;$("proof-status").className="badge "+outcome.tone;
  $("proof-raw").textContent=`Claim: ${claim.status} · Permit: ${outcome.permit?.status||"Not reserved"} · ${amount(claim.amount_wei)} (test tokens)`;
  $("proof-explanation").textContent=claim.id==="inference-v1"
    ?"The original terms passed the EU-only rule. A later binding amendment permitted US processing, invalidating the claim. The buyer then canceled its reserved purchase before payment; no refund was needed."
    :"The seller published a separate EU-dedicated offer. It passed its own evidence review and review window. The buyer then approved the exact replacement payment. The canceled original stayed canceled.";
  $("proof-judgment").textContent=claim.judgment?.reason||"No recorded explanation.";
  $("proof-documents").replaceChildren(...(claim.id==="inference-v1"?[documentView("inference-v1","Original order · EU-only commitments"),documentView("inference-amendment","Binding amendment · US processing permitted")]:[documentView("inference-replacement","Replacement order · EU-dedicated commitments")]));
  $("proof-transfer").hidden=!outcome.payment;
  if(outcome.payment)fields("proof-transfer-fields",[["Amount",amount(outcome.payment.child.value)+" (test tokens)"],["Recipient",outcome.payment.child.to_address],["Payment hash",outcome.payment.hash],["Child transfer",outcome.payment.child.hash]]);
  $("proof-receipts").replaceChildren(...report.receipts.map(row=>{
    const details=el("details",undefined,"event"),summary=el("summary");
    summary.append(el("span",humanize((row.method||"deploy").replaceAll("_"," ")),"event-name"),el("span",row.status+" · "+row.execution,"small muted"));
    const body=el("div",undefined,"event-body");body.append(el("p",row.hash,"mono"),el("pre",JSON.stringify(row,null,2)));details.append(summary,body);return details;
  }));
  $("proof-coverage").textContent=`${report.coverage.receipt_count} known receipts across this run. Original reservation receipt missing; see the scope note.`;
  fields("proof-properties",[["Network","Studio · 61999"],["Contract",report.session.contract],["Test budget",amount(state.agreement.budget_wei)],["Source SHA",report.source_sha256]]);
  $("proof-criterion").textContent=state.agreement.criterion;
  $("proof-observed").textContent="Public receipts checked "+new Date(report.observed_at_utc).toLocaleString()+" (your local time).";
  $("proof-studio").href="https://studio.genlayer.com/?import-contract="+encodeURIComponent(report.session.contract);
}
async function load(){
  $("proof-error").hidden=true;$("proof-retry").disabled=true;
  try{
    const response=await fetch("/api/proof",{signal:AbortSignal.timeout(10000)}),data=await response.json();
    if(!response.ok)throw Error(data.error||"The saved report is unavailable.");
    bundle=data;render();$("proof-message").textContent="Recorded wallet run · Original canceled, replacement reviewed separately. No fresh network check.";
  }catch(error){$("proof-error-text").textContent=error.name==="TimeoutError"?"The report took too long to load. Try again.":error.message;$("proof-error").hidden=false;$("proof-message").textContent="Recorded evidence unavailable. No payment outcome established on this page.";}
  finally{$("proof-retry").disabled=false;}
}
$("proof-retry").onclick=load;
load();
