"use strict";
const $ = (id) => document.getElementById(id);
let result = null, index = 0, selected = "inference-v1";
const names = {inference:"Inference · Northstar Basic", storage:"Storage · Harbor", monitoring:"Monitoring · Beacon", "inference-repaired":"Inference · EU Pro alternative"};
function amount(wei) { return (Number(BigInt(wei)) / 1e18).toFixed(3) + " test GEN"; }
function node(tag, text, cls) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; }
function badge(text, type) { return node("span", text, "badge " + type); }
function gate(permit, claim, snapshot) {
  if (permit.status === "CANCELLED") return ["Cancelled", ""];
  if (permit.status === "SCHEDULED") return ["Scheduled", "good"];
  if (claim.status === "DISPUTED") return ["On hold", "warn"];
  if (claim.status === "INVALID") return ["Blocked", "bad"];
  if (claim.status === "UNKNOWN") return ["Unverified", "warn"];
  // Snapshots record contract state, not an invented live chain clock.
  return ["Reserved", ""];
}
function evidence(snapshot) {
  const claim = snapshot.claims.find(c => c.id === selected) || snapshot.claims[0];
  if (!claim) return;
  selected = claim.id;
  $("evidence-title").textContent = "Evidence · " + claim.id;
  $("claim-state").textContent = claim.status;
  $("claim-state").className = "badge " + ({VALID:"good", INVALID:"bad", UNKNOWN:"warn", DISPUTED:"warn"}[claim.status] || "");
  $("claim-text").textContent = claim.statement;
  const fields = [["Source file", claim.url.split("/").pop()], ["SHA-256", claim.sha256], ["Recipient", claim.recipient]];
  if (claim.challenge) fields.push(["Counter-evidence", claim.challenge.url.split("/").pop()], ["Counter hash", claim.challenge.sha256]);
  if (claim.supersedes) fields.push(["Supersedes", claim.supersedes + " (original remains unchanged)"]);
  fields.push(["Review closes", new Date(claim.review_until * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")]);
  $("evidence-fields").replaceChildren(...fields.flatMap(([key,value]) => [node("dt",key),node("dd",value)]));
  $("judgment").textContent = claim.status === "DISPUTED" ? "Challenge pending. The original supporting judgment does not authorize payment while this claim is disputed." : claim.judgment?.reason || "Not evaluated.";
}
function render() {
  const step = result.steps[index], snapshot = step.snapshot, agreement = snapshot.agreement;
  $("cap").textContent = amount(agreement.budget_wei);
  $("reserved").textContent = amount(agreement.reserved_wei);
  $("spent").textContent = amount(agreement.spent_wei);
  $("available").textContent = amount((BigInt(agreement.budget_wei)-BigInt(agreement.spent_wei)-BigInt(agreement.reserved_wei)).toString());
  $("step-position").textContent = `Step ${index+1} of ${result.steps.length} · Local execution replay`;
  $("step-title").textContent = step.title;
  $("step-detail").textContent = step.detail;
  $("criterion").textContent = agreement.criterion;
  $("next").textContent = index === result.steps.length-1 ? "Back to start ↶" : "Next step →";
  $("steps").replaceChildren(...result.steps.map((s,i) => {
    const li = node("li"), button = node("button", undefined, "step-button");
    button.append(node("span", String(i+1).padStart(2,"0"), "step-num"), node("span",s.title));
    if (i===index) button.setAttribute("aria-current","step");
    button.addEventListener("click", () => { index=i; render(); });
    li.append(button); return li;
  }));
  if (!snapshot.claims.some(c=>c.id===selected)) selected = "inference-v1";
  $("purchases").replaceChildren(...snapshot.permits.map(p => {
    const claim = snapshot.claims.find(c=>c.id===p.claim_id), tr=node("tr"), first=node("td"), button=node("button",undefined,"purchase-link");
    button.append(node("span",names[p.id]||p.id),node("small",p.claim_id));
    button.setAttribute("aria-pressed",String(p.claim_id===selected));
    button.addEventListener("click",()=>{selected=p.claim_id; render();});
    first.append(button); const status=node("td"); status.append(badge(...gate(p,claim,snapshot)));
    tr.append(first,node("td",amount(p.amount_wei)),status); return tr;
  }));
  evidence(snapshot);
  $("raw").textContent = JSON.stringify(snapshot,null,2);
}
async function run() {
  $("run").disabled=true; $("scenario").disabled=true; $("error").hidden=true; $("workspace").hidden=true;
  $("run-status").textContent="Executing contract methods and assertions…";
  try {
    const response = await fetch("/api/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:$("scenario").value}),signal:AbortSignal.timeout(25000)});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not run the contract.");
    result=payload; index=0; selected="inference-v1";
    $("empty").hidden=true; $("workspace").hidden=false;
    $("checks").replaceChildren(...result.checks.map(c=>node("li",c.name)));
    $("check-count").textContent=result.checks.filter(c=>c.passed).length + " passed";
    $("run-status").textContent="Run complete. Inspect each step below. No transactions sent.";
    render();
  } catch(error) {
    $("error").textContent=error.name==="TimeoutError" ? "The local run timed out. Please try again." : error.message;
    $("error").hidden=false; $("run-status").textContent="Run failed. No transactions were sent.";
    $("workspace").hidden=true; $("empty").hidden=false;
  } finally { $("run").disabled=false; $("scenario").disabled=false; }
}
$("run").addEventListener("click",run);
$("next").addEventListener("click",()=>{index=(index+1)%result.steps.length;render();});
$("scenario").addEventListener("change",()=>{$("run-status").textContent="Selection changed. Run it to replace the previous replay.";});
