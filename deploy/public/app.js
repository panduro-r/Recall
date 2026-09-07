import {amount, paymentState, transferFor, safeSource, displayName, fileName, humanize, shortHash} from "./model.js";
const $ = id => document.getElementById(id);
const tabs = ["overview", "evidence", "transactions", "technical"];
let mode = "recorded", bundle = null, demo = null, stepIndex = 0, selected = "inference-v1", canceledOnly = false, currentTab = "overview", requestId = 0;
let networkResult = null, networkBusy = false, networkError = "";
const fixtureDocs = {
  "inference.txt":"Northstar Basic quote v1: processing and storage of all customer logs is EU-only.",
  "storage.txt":"Harbor Storage signed plan: all customer log processing and storage occurs in the EU only.",
  "monitoring.txt":"Beacon Monitoring signed plan: customer logs are stored and processed only within the EU.",
  "correction.txt":"Northstar Basic order amendment v2 supersedes quote v1 for this purchase: logs may be processed in the US. EU-only processing is not guaranteed.",
  "irrelevant.txt":"An unrelated vendor offers a US-only plan. This does not amend Northstar's purchase terms.",
  "replacement.txt":"Northstar EU Pro alternative order: binding EU-only processing and storage of customer logs, without US failover."
};
const summaries = {
  "inference-v1.txt":"Customer data stays in the EU. Processing, storage, failover and support access are EU-only.",
  "inference-amendment.txt":"US failover processing and US support access are now permitted for this same order.",
  "inference-replacement.txt":"A separate EU Dedicated offer. Customer data, processing, storage and support remain in the EU, with no non-EU failover.",
  "storage-v1.txt":"The storage order commits to EU-only processing and storage of customer data, with no non-EU support or failover.",
  "monitoring-v1.txt":"The monitoring order commits to EU-only processing and storage of customer data, with no non-EU support or failover."
};
function el(tag, text, cls) {const n = document.createElement(tag); if(text !== undefined) n.textContent = text; if(cls) n.className = cls; return n;}
function button(text, fn, cls="text-button") {const b=el("button",text,cls);b.addEventListener("click",fn);return b;}
function report() {return mode === "recorded" ? bundle?.report : null;}
function snapshot() {return mode === "recorded" ? bundle?.report.final_state : demo?.steps[stepIndex]?.snapshot;}
function tell(text, settled=false) {$("message").textContent=text;$("message").classList.toggle("settled",settled);}
function setTab(name, focus=false) {currentTab=name;for(const id of tabs){const active=id===name;$("tab-"+id).setAttribute("aria-selected",String(active));$("tab-"+id).tabIndex=active?0:-1;$("panel-"+id).hidden=!active;}if(focus)$("tab-"+name).focus();}
function sourceControl(url, label) {const valid=safeSource(url);if(!valid)return button(label,()=>setTab("evidence",true),"source-link text-button");const a=el("a",label+" ↗","source-link");a.href=valid;a.target="_blank";a.rel="noopener noreferrer";return a;}
function date(seconds) {return new Date(seconds*1000).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});}
function documentsFor(claim) {const docs=[{label:"Original offer",url:claim.url,hash:claim.sha256}];if(claim.supersedes)docs[0].label="Replacement offer";if(claim.challenge)docs.push({label:"Counter-evidence",url:claim.challenge.url,hash:claim.challenge.sha256});return docs;}
function events() {return mode === "recorded" ? bundle?.report.steps || [] : (demo?.steps || []).map((s,i)=>({...s,step:s.title,execution:"LOCAL",localIndex:i}));}
function eventRow(event) {
  const details=el("details",undefined,"event"), summary=el("summary"), failed=event.execution!=="SUCCESS" && event.execution!=="LOCAL";
  summary.append(el("span",failed?"⊗":"✓","event-dot "+(failed?"warn":"good")),el("span",humanize(event.step),"event-name"));
  if(event.transaction_hash)summary.append(el("span",shortHash(event.transaction_hash),"mono"));
  const body=el("div",undefined,"event-body");
  if(event.execution==="LOCAL") {body.append(el("p",event.detail));body.append(button("Inspect this step →",()=>{stepIndex=event.localIndex;$("step").value=String(stepIndex);render();setTab("overview",true);}));}
  else {body.append(el("p",`Execution: ${event.execution} · Transaction: ${event.status}`),el("p","Observed in recorded run: "+date(event.observed_at)),el("code",event.transaction_hash));if(event.rejection)body.append(el("p",typeof event.rejection==="string"?event.rejection:JSON.stringify(event.rejection)));if(failed)body.append(el("p","Expected rejection in this test run; finality does not mean successful application execution."));}
  details.append(summary,body);return details;
}
function renderHistory() {
  const all=events(), filter=$("history-filter").value;
  const rows=all.filter(s=>filter==="all"||(filter==="success"?["SUCCESS","LOCAL"].includes(s.execution):!["SUCCESS","LOCAL"].includes(s.execution)));
  $("transaction-count").textContent=String(all.length);
  $("history-scope").textContent=mode==="recorded"?`${rows.length} of ${all.length} recorded transactions. These are historical receipts, not a fresh network check.`:`${rows.length} local execution steps. No blockchain transactions were sent.`;
  $("history-events").replaceChildren(...rows.map(eventRow));if(!rows.length)$("history-events").append(el("p","No events match this filter.","muted"));
  const recent=mode==="recorded" ? all.slice(-3) : all.slice(Math.max(0,stepIndex-2),stepIndex+1);
  $("recent-events").replaceChildren(...recent.map(eventRow));$("activity-scope").textContent=mode==="recorded"?"Latest events across the entire recorded run.":"Local steps up to the selected snapshot.";
}
function renderEvidence(claim) {
  const docs=documentsFor(claim), sourceMap=mode==="recorded"?bundle.documents:fixtureDocs;
  $("comparison-title").textContent=docs.length>1?"Evidence comparison":"Evidence supporting this offer";
  $("comparison").replaceChildren(...docs.map((doc,i)=>{
    const column=el("div",undefined,"evidence-column"), title=el("div",undefined,"document-label");title.append(el("span","▱","file-icon"),el("span",doc.label));
    const text=mode==="recorded"?summaries[fileName(doc.url)]:sourceMap[fileName(doc.url)];const excerpt=el("p",undefined,"excerpt");
    if(mode==="demo"&&demo.mode==="missing"&&i===1)excerpt.textContent="The fetch failed in this scenario. The contract cannot establish what the document says.";
    else if(i===1 && claim.status==="INVALID")excerpt.append(el("mark",text||"Counter-evidence refuted this claim."));
    else excerpt.textContent=text||claim.statement;
    column.append(title,excerpt,sourceControl(doc.url,fileName(doc.url)));return column;
  }));
  $("source-scope").textContent=mode==="recorded"?"Full fictional test documents. Local bytes match the SHA-256 hashes in the exported report. Summaries in Overview are editorial, not separately consensus-verified.":"Scripted fixture content. These example URLs are not live sources; no web or AI network calls were made.";
  $("source-documents").replaceChildren(...docs.map((doc,i)=>{
    const section=el("section",undefined,"document"), header=el("header");header.append(el("h3",doc.label),sourceControl(doc.url,fileName(doc.url)));
    section.append(header,el("p","SHA-256 · "+doc.hash,"hash mono"));
    section.append(el("pre",mode==="demo"&&demo.mode==="missing"&&i===1?"Unavailable to the contract in this scenario (scripted HTTP 404).":sourceMap[fileName(doc.url)]||"Source text unavailable."));return section;
  }));
  $("source-links").replaceChildren(...docs.map(doc=>sourceControl(doc.url,doc.label)));
}
function render() {
  const state=snapshot();$("record-content").hidden=!state;$("empty").hidden=!!state;
  if(!state){$("purchases").replaceChildren();$("purchase-count").textContent="0";for(const id of ["cap","spent","reserved","balance","claim-status","permit-status","payment-status"])$(id).textContent="—";$("source-links").replaceChildren();return;}
  const sorted=[...state.permits].sort((a,b)=>{const order=id=>id.includes("inference")?(id.includes("replacement")||id.includes("repaired")?1:0):id.includes("storage")?2:3;return order(a.id)-order(b.id);});
  const filtered=sorted.filter(p=>!canceledOnly||p.status==="CANCELLED");
  if(!state.claims.some(c=>c.id===selected))selected=state.claims[0]?.id;
  const claim=state.claims.find(c=>c.id===selected), permit=state.permits.find(p=>p.claim_id===selected);if(!claim||!permit)return;
  const [name,meta]=displayName(claim), [payment,tone]=paymentState(report(),permit,claim), confirmed=transferFor(report(),permit);
  $("purchase-count").textContent=String(sorted.length);$("recalled-count").textContent=String(sorted.filter(p=>p.status==="CANCELLED").length);$("no-purchases").hidden=filtered.length>0;
  $("purchases").replaceChildren(...filtered.map(p=>{const c=state.claims.find(c=>c.id===p.claim_id), [label,supplier]=displayName(c), [status,cls]=paymentState(report(),p,c);const b=button("",()=>{selected=c.id;render();tell(`Selected ${label}. ${status}.`,true);},"purchase");b.setAttribute("aria-current",String(selected===c.id));const compact=status==="Transfer verified"?"Paid":status==="Scheduled · unverified"?"Scheduled":status;const stateLabel=el("span",compact,"payment-label "+cls);stateLabel.title=status;b.append(el("strong",label),el("span",amount(p.amount_wei),"mono"),el("span",supplier,"supplier"),stateLabel);return b;}));
  $("cap").textContent=amount(state.agreement.budget_wei);$("reserved").textContent=amount(state.agreement.reserved_wei);
  $("spent").textContent=amount(mode==="recorded"?state.permits.reduce((n,p)=>n+BigInt(transferFor(report(),p)?.value||0),0n):state.agreement.spent_wei);
  $("balance").textContent=amount(mode==="recorded"?report().final_balances.buyer:BigInt(state.agreement.budget_wei)-BigInt(state.agreement.spent_wei)-BigInt(state.agreement.reserved_wei));
  $("record-id").textContent=claim.id;$("record-name").textContent=name;$("record-meta").textContent=`${meta} · ${amount(permit.amount_wei)}`;
  $("claim-badge").textContent="Claim "+claim.status.toLowerCase();$("claim-badge").className="badge "+({VALID:"good",INVALID:"bad",DISPUTED:"warn",UNKNOWN:"warn"}[claim.status]||"neutral");
  $("decision").textContent=claim.status==="DISPUTED"?"This claim is under challenge. The original judgment does not authorize payment while the dispute is unresolved.":claim.status==="INVALID"?"The applicable amendment contradicts the buyer’s EU-only rule.":claim.status==="UNKNOWN"?"The evidence could not establish the guarantee. Authorization is not automatically restored.":claim.supersedes?"This replacement uses separate evidence and its own review window.":"The recorded judgment supports this offer under the buyer’s rule.";
  $("claim-status").textContent=humanize(claim.status);$("claim-status").className=claim.status==="INVALID"?"bad":claim.status==="VALID"?"good":"warn";
  $("permit-status").textContent=humanize(permit.status);$("payment-status").textContent=payment;$("payment-status").className=tone;$("criterion").textContent=state.agreement.criterion;
  $("outcome-title").textContent=permit.status==="CANCELLED"?"Permit canceled":confirmed?"Transfer verified":permit.status==="SCHEDULED"?"Transfer scheduled":"Permit "+permit.status.toLowerCase();
  $("outcome-detail").textContent=permit.status==="CANCELLED"?"No payment sent":confirmed?"Finalized child transfer in recorded report":permit.status==="SCHEDULED"?"Recipient payment not established":payment;$("outcome-amount").textContent=amount(permit.amount_wei);
  renderEvidence(claim);
  const related=state.claims.find(c=>c.supersedes===claim.id)||state.claims.find(c=>c.id===claim.supersedes);$("replacement-section").hidden=!related;
  if(related){$("relationship-title").textContent=claim.supersedes?"Original purchase":"Replacement";$("replacement-name").textContent=displayName(related)[0];$("replacement-meta").textContent=claim.supersedes?"Original record remains unchanged":"Separate evidence · New review window";$("replacement").onclick=()=>{selected=related.id;canceledOnly=false;setFilter(false);render();};}
  const fields=[["Claim ID",claim.id],["Permit ID",permit.id],["Permit state",permit.status],["Exact amount (wei)",permit.amount_wei],["Recipient",claim.recipient],["Evidence SHA-256",claim.sha256],["Review closes",date(claim.review_until)],["Agreement expires",date(state.agreement.expires_at)],["Judgment",claim.judgment?.reason||"Not evaluated"]];
  if(confirmed)fields.push(["Finalized transfer",confirmed.hash],["Transfer parent",confirmed.triggered_by]);
  $("technical-fields").replaceChildren(...fields.flatMap(([k,v])=>[el("dt",k),el("dd",v)]));$("raw").textContent=JSON.stringify(state,null,2);
  $("checks-section").hidden=mode!=="demo";if(demo&&mode==="demo"){$("checks").replaceChildren(...demo.checks.map(c=>el("li",`${c.passed?"Passed":"Failed"}: ${c.name}`)));$("check-count").textContent=`(${demo.checks.filter(c=>c.passed).length} passed)`;}
  renderHistory();setTab(currentTab);
}
function setFilter(value){canceledOnly=value;$("all").setAttribute("aria-pressed",String(!value));$("recalled").setAttribute("aria-pressed",String(value));}
function configureMode(){
  $("environment").textContent=mode==="recorded"?"Studio sandbox":"Local direct VM";$("detail-environment").textContent=$("environment").textContent;
  const scripted=bundle?.capabilities?.scripted_demo!==false;
  $("demo-controls").hidden=mode!=="demo"||!scripted;$("open-demo").hidden=mode==="demo"||!scripted;$("studio").hidden=mode==="demo";
  $("mode").disabled=!scripted;
  $("spent-label").textContent=mode==="recorded"?"Transferred":"Scheduled · unverified";$("balance-label").textContent=mode==="recorded"?"Buyer balance":"Uncommitted limit";
  $("verification-scope").textContent=mode==="recorded"?"Historical sandbox token transfers. Not proof of service delivery, source authenticity or a fresh network result.":"Scripted web and AI fixtures. Scheduled messages are intercepted; recipient payments are not established.";
  renderNetwork();
  $("observed-at").textContent=mode==="recorded"&&bundle?"Report verified "+date(bundle.report.independent_verification.observed_at):"";
  $("history-filter").value="all";setFilter(false);setTab("overview");render();
}
function renderNetwork(){
  $("network-check").hidden=mode!=="recorded";
  $("check-studio").disabled=!bundle||networkBusy;
  $("check-studio").textContent=networkBusy?"Checking…":networkResult||networkError?"Check again":"Check Studio";
  const copy=networkResult?{
    matched:`All ${networkResult.checks.length} checks matched at ${date(networkResult.observed_at)}. The view below remains the recorded run.`,
    mismatch:"Studio differs from the recorded run. Inspect the differences below; the recorded view has not been updated.",
    unavailable:"Some Studio data could not be checked. No complete match was established; the recorded view is unchanged."
  }[networkResult.status]:"Not checked this session. The view below uses the recorded run.";
  $("network-status").textContent=networkBusy?"Reading public contract state, balances and payment receipts. No wallet or transactions required.":networkError||copy;
  $("network-status").className=networkBusy?"muted":networkError?"warn":({matched:"good",mismatch:"bad",unavailable:"warn"}[networkResult?.status]||"muted");
  $("network-details").hidden=!networkResult||networkBusy||!!networkError;
  if(networkResult){
    $("network-time").textContent=`Observed ${date(networkResult.started_at)}–${date(networkResult.observed_at)} · Studio sandbox · Chain 61999 expected.`;
    $("network-results").replaceChildren(...networkResult.checks.map(row=>{const item=el("li");item.append(el("strong",row.label),el("span",humanize(row.status),{matched:"good",mismatch:"bad",unavailable:"warn"}[row.status]),el("p",row.detail,"small muted"));return item;}));
  }
  $("footer-scope").textContent=mode==="demo"?"Local replay · No network transactions":networkBusy?"Recorded view · Checking Studio":networkError?"Recorded view · Check unavailable":networkResult?`Recorded view · Last check: ${networkResult.status}`:"Recorded data · No fresh network check";
}
async function checkStudio(){
  if(networkBusy||!bundle||mode!=="recorded")return;
  networkBusy=true;networkError="";renderNetwork();
  try{
    const response=await fetch("/api/check-studio",{method:"POST",signal:AbortSignal.timeout(30000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Studio check unavailable. Try again; the recorded run is unchanged.");
    if(!["matched","mismatch","unavailable"].includes(data.status)||!Array.isArray(data.checks)||!data.checks.length)throw new Error("Studio returned an incomplete check. Try again.");
    networkResult=data;$("network-details").open=data.status!=="matched";
  }catch(e){networkError=e.name==="TimeoutError"?"Studio check timed out. Try again; the recorded run is unchanged.":"Studio check unavailable. Try again; the recorded run is unchanged.";}
  finally{networkBusy=false;renderNetwork();}
}
async function loadRecorded(){const id=++requestId;$("error").hidden=true;tell("Loading the recorded Studio report…");try{const response=await fetch("/api/recorded",{signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Recorded report could not be loaded.");if(id!==requestId)return;bundle=data;configureMode();tell("Recorded Studio report loaded. No network check or transactions performed.",true);}catch(e){if(id!==requestId)return;$("error-text").textContent=e.name==="TimeoutError"?"The local report took too long to load. Try again.":e.message;$("error").hidden=false;tell("Recorded report unavailable.");}}
async function runDemo(){const id=++requestId;$("run").disabled=true;$("scenario").disabled=true;$("step").disabled=true;$("next").disabled=true;$("error").hidden=true;tell("Executing local contract methods and assertions…");try{const response=await fetch("/api/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:$("scenario").value}),signal:AbortSignal.timeout(25000)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Local execution failed.");if(id!==requestId)return;demo=data;stepIndex=0;selected="inference-v1";$("step").replaceChildren(...demo.steps.map((s,i)=>{const option=el("option",`${i+1}. ${s.title}`);option.value=String(i);return option;}));render();tell("Local run complete. Select a step to inspect it. No transactions sent.",true);}catch(e){if(id!==requestId)return;$("error-text").textContent=e.name==="TimeoutError"?"The local run timed out. Try again; no network transaction was sent.":e.message;$("error").hidden=false;tell("Local run failed. Any previous replay remains unchanged.");}finally{if(id===requestId){$("run").disabled=false;$("scenario").disabled=false;$("step").disabled=!demo;$("next").disabled=!demo;}}}
for(const [i,name] of tabs.entries()){$("tab-"+name).onclick=()=>setTab(name);$("tab-"+name).onkeydown=e=>{let next;if(e.key==="ArrowRight")next=tabs[(i+1)%tabs.length];if(e.key==="ArrowLeft")next=tabs[(i+tabs.length-1)%tabs.length];if(e.key==="Home")next=tabs[0];if(e.key==="End")next=tabs.at(-1);if(next){e.preventDefault();setTab(next,true);}};}
$("all").onclick=()=>{setFilter(false);render();};$("recalled").onclick=()=>{setFilter(true);render();};$("read-sources").onclick=()=>setTab("evidence",true);$("all-history").onclick=()=>{$("history-filter").value="all";renderHistory();setTab("transactions",true);};$("history-filter").onchange=renderHistory;
$("mode").onchange=()=>{++requestId;mode=$("mode").value;$("error").hidden=true;$("run").disabled=false;$("scenario").disabled=false;$("step").disabled=!demo;$("next").disabled=!demo;configureMode();if(mode==="recorded"&&!bundle)loadRecorded();else tell(mode==="recorded"?"Recorded report selected.":"Scripted local demo selected. Choose a scenario.",!!snapshot());};
$("open-demo").onclick=()=>{$("mode").value="demo";$("mode").dispatchEvent(new Event("change"));$("scenario").focus();};$("run").onclick=runDemo;$("retry").onclick=()=>mode==="recorded"?loadRecorded():runDemo();$("step").onchange=()=>{stepIndex=Number($("step").value);render();tell(demo.steps[stepIndex].title,true);};$("next").onclick=()=>{stepIndex=(stepIndex+1)%demo.steps.length;$("step").value=String(stepIndex);render();tell(demo.steps[stepIndex].title,true);};$("scenario").onchange=()=>tell("Scenario selection changed. Run it to replace the current replay.");
$("check-studio").onclick=checkStudio;
loadRecorded();
