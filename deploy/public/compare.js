import {SAVED_KEY,requirements,ranked,assess,isStale,readSaved,brief,nextStep,reviewDate,validateCatalog} from './compare-model.js';
const $ = selector => document.querySelector(selector);
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2),value);
    else if (key in node && !['class','role'].includes(key)) node[key] = value;
    else node.setAttribute(key,value);
  }
  node.append(...children.filter(c=>c !== null)); return node;
}
const dollars = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const form = $('#requirements'), dialog = $('#option-dialog');
let catalog, req, saved = [], storageProblem = '', activeTrigger;
const checks = {};
function fromForm() {return requirements({hours:form.hours.value,budget:form.budget.value,noTraining:form.noTraining.checked,speakers:form.speakers.checked});}
function updateCount() {$('#saved-count').textContent = saved.length;}
function persist(next) {
  if (storageProblem) throw Error(storageProblem);
  localStorage.setItem(SAVED_KEY,JSON.stringify(next)); saved = next; updateCount();
}
function savePlan(plan, selectedReq, status) {
  const restore = document.activeElement;
  try {
    const next = [{planId:plan.id,requirements:{...selectedReq},savedAt:new Date().toISOString()},...saved.filter(s=>s.planId !== plan.id)];
    persist(next); renderResults(); status.textContent = `${plan.name} saved in this browser. No order has been placed.`;
    if (!restore?.isConnected && !dialog.open) document.querySelector(`[aria-label="${CSS.escape(`Save ${plan.name} ${plan.plan}`)}"]`)?.focus();
  } catch {status.textContent = 'Could not save the shortlist. Allow site storage, or use Copy buying brief. Existing purchases are unchanged.';}
}
function openDialog(title, body, trigger = document.activeElement) {
  if (!dialog.open) activeTrigger = trigger;
  const close = el('button',{class:'close-dialog',type:'button','aria-label':'Close',onclick:()=>dialog.close()},'×');
  $('#dialog-content').replaceChildren(el('div',{class:'dialog-header'},el('h2',{id:'dialog-title'},title),close),body);
  if (!dialog.open) dialog.showModal();
  close.focus();
}
dialog.addEventListener('close',()=>activeTrigger?.isConnected && activeTrigger.focus());
function costBlock(plan,result) {
  return el('div',{},el('div',{class:'cost-label'},result.costLabel),
    el('div',{class:'cost'},el('strong',{},plan.pricing === 'from' ? 'Quote needed' : `${plan.pricing === 'estimated' ? '≈ ' : ''}${dollars(result.estimate)}`),el('span',{},plan.pricing === 'from' ? '' : '/ month')),
    el('p',{class:'price-explanation'},plan.pricing === 'from' ? `From-rate calculation: ${dollars(result.estimate)}/month. Excludes any minimum commitment.` : `${plan.pricing === 'estimated' ? 'About ' : ''}${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(result.rate)} / audio hour${result.labelsUnknown ? ' · speaker-label cost unknown' : ''}${req.speakers && !result.labelsUnknown ? ' · speaker labels included' : ''}`),
    plan.estimateNote ? el('p',{class:'price-explanation'},plan.estimateNote) : null);
}
function renderResults() {
  const rows = ranked(catalog,req), stale = rows.every(r=>r.result.stale), fit = rows.filter(r=>r.result.status === 'fit').length;
  const dates = [...new Set(catalog.plans.map(p=>reviewDate(catalog,p)))].sort();
  $('#results-title').textContent = `${rows.length} plans, ${new Set(rows.map(r=>r.plan.provider)).size} providers`;
  $('#review-date').textContent = dates.length === 1 ? `Catalog reviewed ${dates[0]}` : 'Catalog review dates shown with each plan';
  $('#result-summary').replaceChildren(el('strong',{},stale ? 'These source reviews need updating.' : fit ? `${fit} ${fit === 1 ? 'plan has' : 'plans have'} a published estimate within your budget.` : 'No fully priced match for these conditions yet.'),
    el('p',{},stale ? 'The catalog review is over seven days old. Confirm current prices and policies before choosing; a page check does not refresh this review.' : fit ? 'Review the terms and test your audio before committing. Lowest price is not an accuracy ranking.' : 'See what needs confirmation below. A privacy exception or a “from” price is not a confirmed match.'));
  $('#results').replaceChildren(...rows.map(({plan,result})=>{
    const savedRow = saved.find(s=>s.planId === plan.id), isSaved = savedRow && JSON.stringify(savedRow.requirements) === JSON.stringify(req);
    const sourceLabel = plan.training === 'excluded' ? '✓' : '◦';
    return el('article',{class:'plan-card','aria-label':`${plan.name} ${plan.plan}`},
      el('div',{class:'plan-top'},el('span',{class:'provider-mark','aria-hidden':'true'},plan.initials),el('div',{},el('h3',{},plan.name),el('small',{},plan.plan))),
      el('span',{class:`status-badge ${result.status}`},result.label),costBlock(plan,result),
      el('div',{class:'plan-condition'},el('span',{class:'condition-icon','aria-hidden':'true'},sourceLabel),el('div',{},el('strong',{},plan.trainingLabel),el('p',{},plan.training === 'excluded' ? 'Documented for this configuration. Check account settings and retention before use.' : plan.training === 'default-training' ? 'Does not meet a no-training condition by default.' : 'Configuration and any price impact must be confirmed.'))),
      el('div',{class:'plan-condition'},el('span',{class:'condition-icon','aria-hidden':'true'},'↳'),el('strong',{},result.budgetLabel)),
      el('div',{class:'plan-bottom'},el('button',{class:'button',type:'button',onclick:()=>showOption(plan,req)},'Review evidence',' →'),
        el('button',{class:'button save-option',type:'button','aria-pressed':String(Boolean(isSaved)),'aria-label':`Save ${plan.name} ${plan.plan}`,onclick:()=>savePlan(plan,req,$('#form-status'))},isSaved ? '✓ Saved' : savedRow ? 'Update saved' : '+ Save option')));
  }));
}
function showOption(plan, selectedReq) {
  const result = assess(plan,selectedReq,isStale({reviewedAt:reviewDate(catalog,plan)})), status = el('p',{class:'status-message',role:'status'});
  const sourceList = el('div',{});
  const renderSources = () => sourceList.replaceChildren(...plan.sources.map(key=>{
    const source = catalog.sources[key], reading = checks[key];
    return el('div',{class:'source-row'},el('a',{href:source.url,target:'_blank',rel:'noopener noreferrer'},source.label,' ↗'),
      el('small',{},reading ? `${reading.status === 'retrieved' ? 'Page fetched' : 'Could not retrieve'} · ${new Date(reading.checkedAt).toLocaleString()}${reading.reason ? ' · '+reading.reason : ''}` : 'Not checked during this visit.'),
      reading?.sha256 ? el('small',{},'Fetched document SHA-256: ',el('code',{},reading.sha256)) : null);
  }));
  renderSources();
  const sourceStatus = el('p',{class:'status-message',role:'status'});
  const sourceButton = el('button',{class:'button',type:'button',onclick:async()=>{
    sourceButton.disabled = true; sourceStatus.textContent = 'Reading the provider’s source pages…';
    try {
      const response = await fetch('/api/catalog/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:plan.provider}),signal:AbortSignal.timeout(35000)});
      const data = await response.json();
      if (!response.ok || data.provider !== plan.provider || !data.sources) throw Error(data.error || 'Source check unavailable.');
      let fetched = 0;
      for (const key of plan.sources) { const r = data.sources[key];
        if (!r || !['retrieved','unavailable'].includes(r.status) || !Number.isFinite(Date.parse(r.checkedAt))) throw Error('Source check returned an incomplete result.');
        if (r.status === 'retrieved' && !/^[a-f0-9]{64}$/.test(r.sha256)) throw Error('Source fingerprint missing.');
        checks[key] = r; if (r.status === 'retrieved') fetched++;
      }
      renderSources(); sourceStatus.textContent = `${fetched} of ${plan.sources.length} pages fetched${data.cached ? ' · cached check (up to 10 minutes)' : ''}. This checks availability, not whether the price or policy interpretation is still correct.`;
    } catch { sourceStatus.textContent = 'Could not complete the source check. Open the official sources above; the saved review has not been refreshed.'; }
    finally {sourceButton.disabled = false;}
  }},'Check source pages');
  const copy = el('button',{class:'button',type:'button',onclick:async()=>{
    const text = brief(catalog,plan,selectedReq,result,checks);
    try {await navigator.clipboard.writeText(text);status.textContent = 'Buying brief copied, including requirements, caveats and source links.';}
    catch {const fallback = el('textarea',{class:'copy-fallback',value:text,readOnly:true,'aria-label':'Buying brief to copy'});body.append(fallback);fallback.focus();fallback.select();status.textContent = 'Automatic copying was blocked. Select and copy the brief below.';}
  }},'Copy buying brief');
  const body = el('div',{class:'dialog-body'},el('span',{class:`status-badge ${result.status}`},result.label),
    el('p',{},plan.plan),el('p',{class:'cost-label'},result.costLabel),el('div',{class:'cost'},el('strong',{},`${plan.pricing === 'estimated' ? '≈ ' : ''}${dollars(result.estimate)}`),el('span',{},'/ month')),
    el('p',{},`${selectedReq.hours} audio hours · ${dollars(selectedReq.budget)} monthly budget · ${selectedReq.speakers ? 'speaker labels required' : 'no speaker-label requirement'} · ${selectedReq.noTraining ? 'no model training required' : 'no training restriction selected'}`),
    el('h3',{},'What the price includes'),el('p',{},plan.priceNote),
    el('h3',{},'What the data policy says'),el('p',{},plan.trainingNote),
    el('div',{class:'dialog-callout'},el('strong',{},'Before you commit'),el('p',{},nextStep(plan,selectedReq)),el('p',{},'Test transcription accuracy with representative, non-sensitive audio. A policy statement does not prove real-world behavior.')),
    el('h3',{},'First-party evidence'),el('p',{},`Catalog pricing and policy reviewed ${reviewDate(catalog,plan)}${result.stale ? ' · review is out of date' : ''}. Adding technical documentation does not renew that review. Read the plan-specific terms before buying.`),sourceList,
    el('div',{class:'source-live'},sourceButton,sourceStatus),
    el('h3',{},'Go beyond the catalog'),el('p',{},'Capture this provider’s current public evidence, optionally assess it with GenLayer, and save a baseline for later comparison. No supplier outreach or reply links needed.'),
    el('a',{class:'button primary',href:'/review#'+new URLSearchParams({plan:plan.id,...selectedReq})},'Review this provider →'),
    el('h3',{},'Your next step'),el('p',{},'Save this option or copy a buying brief for your team. If you proceed, set up the service with the provider. Recall has no checkout integration with these providers; this does not create a protected purchase.'),
    el('div',{class:'actions'},el('button',{class:'button primary',type:'button',onclick:()=>savePlan(plan,selectedReq,status)},'Save option'),copy,el('a',{class:'button',href:plan.url,target:'_blank',rel:'noopener noreferrer'},'Visit provider ↗')),status);
  openDialog(`${plan.name} · Evidence review`,body);
}
function showSaved() {
  const body = el('div',{class:'dialog-body'},el('p',{},'Saved only in this browser. These are research choices, not orders or accepted supplier offers. Your requirements are saved; evidence uses the current catalog review, not a locked quote.'));
  if (storageProblem) body.append(el('p',{role:'alert'},storageProblem));
  if (!saved.length) body.append(el('div',{class:'dialog-callout'},el('strong',{},'Your shortlist is empty'),el('p',{},'Save an option from the comparison. You can return to its requirements and evidence here.')));
  for (const row of saved) {
    const plan = catalog.plans.find(p=>p.id === row.planId);
    body.append(el('div',{class:'saved-row'},el('h3',{},`${plan.name} · ${plan.plan}`),el('p',{},`${row.requirements.hours} hours/month · ${dollars(row.requirements.budget)} budget · Saved ${new Date(row.savedAt).toLocaleDateString()}`),
      el('div',{class:'actions'},el('button',{class:'button',type:'button',onclick:()=>showOption(plan,row.requirements)},'Review saved option'),
        el('button',{class:'text-button',type:'button',onclick:()=>{
          try {persist(saved.filter(s=>s.planId !== row.planId));renderResults();showSaved();} catch {body.append(el('p',{role:'alert'},'Could not update the shortlist. Nothing was removed.'));}
        }},'Remove from shortlist'))));
  }
  openDialog('Your saved options',body);
}
form.addEventListener('input',()=>{$('#form-status').textContent = 'Requirements changed. Compare again to update the results.';});
form.addEventListener('submit',event=>{event.preventDefault();try {req = fromForm();renderResults();$('#form-status').textContent = 'Comparison updated. No provider was contacted.';if(matchMedia('(max-width:640px)').matches) $('#results-title').scrollIntoView({behavior:'auto',block:'start'});}catch(error){$('#form-status').textContent = error.message;}});
$('#saved-options').addEventListener('click',showSaved);
window.addEventListener('storage',event=>{if(event.key === SAVED_KEY || event.key === null){try{saved = readSaved(localStorage.getItem(SAVED_KEY),catalog);storageProblem = '';updateCount();renderResults();if(dialog.open)dialog.close();$('#form-status').textContent = 'Your shortlist was updated in another tab.';}catch{storageProblem = 'The shortlist changed and could not be read. Reload before saving.';}}});
async function start() {
  try {
    const response = await fetch('/service-catalog.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('catalog'); catalog = await response.json();
    validateCatalog(catalog);
    try {saved = readSaved(localStorage.getItem(SAVED_KEY),catalog);}catch{storageProblem = 'The saved shortlist could not be read. Copy a buying brief instead; existing purchases are unchanged.';}
    req = fromForm();renderResults();updateCount();$('#saved-options').disabled = false;$('#comparison').hidden = false;$('#load-status').hidden = true;
    if (storageProblem) $('#form-status').textContent = storageProblem;
  } catch {$('#load-status').replaceChildren('The provider catalog could not load. Your existing purchases are unchanged. ',el('button',{class:'button',type:'button',onclick:start},'Try again'));}
}
start();
