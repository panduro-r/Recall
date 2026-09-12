import {SAVED_KEY,requirements,ranked,assess,isStale,readSaved,withSavedOption,comparisonLink,comparisonContext,comparisonPair,comparisonViewLink,withComparisonReturn,brief,nextStep,reviewDate,validateCatalog} from './compare-model.js';
import {readReviewIndex,matchingReview,REVIEWS,TRANSACTIONS} from './review-index.js';
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
let catalog, req, saved = [], storageProblem = '', activeTrigger, reviewIndex, indexVersion=0;
let view='browse',pair=[],originPlan=null,originKind='review',comparisonNotice='',invalidComparisonLink=false;
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
    const next = withSavedOption(localStorage.getItem(SAVED_KEY),catalog,plan.id,selectedReq);
    persist(next); renderResults(); status.textContent = `${plan.name} saved in this browser. No order has been placed.`;
    if (!restore?.isConnected && !dialog.open) document.querySelector(`${view==='compare'?'#pair-comparison':'#results'} [aria-label="${CSS.escape(`Save ${plan.name} ${plan.plan}`)}"]`)?.focus();
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
  $('#results').hidden=view==='compare';$('#pair-comparison').hidden=view!=='compare';
  $('#browse-view').setAttribute('aria-pressed',String(view==='browse'));
  $('#side-by-side-view').setAttribute('aria-pressed',String(view==='compare'));
  if(view==='compare')renderPair();
}
function renderPair(){
  pair=comparisonPair(catalog,req,pair.length?pair:originPlan?[originPlan]:[]);
  const plans=pair.map(id=>catalog.plans.find(p=>p.id===id)),results=plans.map(p=>assess(p,req,isStale({reviewedAt:reviewDate(catalog,p)})));
  const section=$('#pair-comparison');
  const heading=el('div',{class:'pair-heading'},el('h3',{id:'pair-title'},plans.map(p=>p.name).join(' vs ')),
    el('p',{},`${req.hours.toLocaleString()} hours / month · ${dollars(req.budget)} budget · ${req.noTraining?'No model training':'No training restriction'} · ${req.speakers?'Speaker labels required':'No speaker-label requirement'}`),
    el('p',{id:'pair-status',role:'status'},comparisonNotice||`Your ${originKind==='saved'?'saved option’s':'review’s'} requirements are applied. Choose another plan below to compare alternatives.`));
  const headers=plans.map((plan,index)=>{
    const select=el('select',{id:`compare-plan-${index}`,'aria-label':index===0?'Starting plan':'Alternative plan',onchange:()=>{
      pair[index]=select.value;originPlan=null;originKind='comparison';comparisonNotice='Comparison updated. Your selection stays in this page’s address.';renderPair();syncComparisonAddress();$(`#compare-plan-${index}`).focus();
    }},...ranked(catalog,req).map(({plan:p})=>el('option',{value:p.id,selected:p.id===plan.id,disabled:p.id===pair[1-index]},`${p.name} · ${p.plan}`)));
    return el('th',{scope:'col'},el('label',{htmlFor:select.id},plan.id===originPlan?(originKind==='saved'?'From your shortlist':'From your review'):index===0?'Starting option':'Alternative'),
      el('div',{class:'pair-provider'},el('span',{class:'provider-mark','aria-hidden':'true'},plan.initials),el('strong',{},plan.name)),select,el('small',{class:'pair-plan-name'},plan.plan));
  });
  const tbody=el('tbody');
  const row=(title,cells)=>tbody.append(el('tr',{},el('th',{scope:'row'},title),...cells.map(c=>el('td',{},c))));
  row('Monthly cost',plans.map((p,i)=>el('div',{},el('strong',{class:'pair-price'},p.pricing==='from'?'Quote needed':`${p.pricing==='estimated'?'≈ ':''}${dollars(results[i].estimate)}`),
    el('small',{},results[i].costLabel),p.pricing==='from'?el('small',{},`From-rate calculation: ${dollars(results[i].estimate)}. Minimum commitment not included.`):null,
    el('details',{class:'pair-price-details'},el('summary',{},'Price details'),el('p',{},p.priceNote)))));
  row('Budget & conditions',results.map(r=>el('div',{},el('span',{class:`status-badge ${r.status}`},r.label),el('p',{},r.budgetLabel),r.stale?el('small',{},'Catalog review is out of date. Confirm the current terms.'):null)));
  row('Model training',plans.map(p=>el('div',{},el('strong',{},p.trainingLabel),el('p',{},p.trainingNote))));
  row('Speaker labels',plans.map((p,i)=>el('div',{},el('strong',{},!req.speakers?'Not selected':results[i].labelsUnknown?'Cost needs confirmation':'Included in this estimate'),
    el('small',{},!req.speakers?'Excluded from the calculation. Select “Identify each speaker” if needed.':results[i].labelsUnknown?'The catalog does not confirm the add-on price.':p.diarization===0?'No separate per-hour surcharge in the catalog.':`${dollars(p.diarization)} extra per audio hour.`))));
  row('Your saved assessment',plans.map(p=>savedReviewBlock(p,req)));
  row('Catalog reviewed',plans.map(p=>el('span',{},reviewDate(catalog,p))));
  row('Explore this option',plans.map(p=>{
    const savedRow=saved.find(s=>s.planId===p.id),isSaved=savedRow&&JSON.stringify(savedRow.requirements)===JSON.stringify(req);
    return el('div',{class:'pair-actions'},el('button',{class:'button',type:'button',onclick:()=>showOption(p,req)},'Review evidence →'),
      el('button',{class:'button save-option',type:'button','aria-pressed':String(Boolean(isSaved)),'aria-label':`Save ${p.name} ${p.plan}`,onclick:()=>savePlan(p,req,$('#form-status'))},isSaved?'✓ Saved':savedRow?'Update saved option':'+ Save option'));
  }));
  const table=el('table',{class:'pair-table'},el('caption',{class:'sr-only'},'Provider plans compared using the same requirements'),el('thead',{},el('tr',{},el('th',{scope:'col'},'Compare'),...headers)),tbody);
  section.replaceChildren(heading,table,el('p',{class:'pair-disclaimer'},'Prices and policy summaries use the catalog; they are not new GenLayer assessments. Saved assessments apply only to their dated evidence. No provider was contacted and nothing was submitted.'));
}
function focusComparison(){
  if($('#pair-comparison').hidden)return;
  $('#pair-comparison').focus({preventScroll:true});$('#pair-comparison').scrollIntoView({behavior:'auto',block:'start'});
}
function syncComparisonAddress(){
  pair=comparisonPair(catalog,req,pair);
  try{history.replaceState(history.state,'',comparisonViewLink(req,pair,view));}
  catch{$('#form-status').textContent='Comparison updated, but this browser could not preserve it in the page address.';}
}
function reviewWithReturn(href,selectedReq){
  if(JSON.stringify(selectedReq)!==JSON.stringify(req))return href;
  return withComparisonReturn(href,comparisonViewLink(req,comparisonPair(catalog,req,pair),view));
}
function compareSaved(event,row){
  event.preventDefault();
  const href=comparisonLink(row.requirements,row.planId,'saved');
  if(location.pathname+location.hash!==href)history.pushState(null,'',href);
  applyComparisonLink();
  dialog.addEventListener('close',focusComparison,{once:true});dialog.close();
}
function compareOptions(){
  try{
    const next=fromForm(),unchanged=view==='compare'&&JSON.stringify(next)===JSON.stringify(req);
    comparisonNotice=unchanged?'Requirements are unchanged. Choose a different plan below to explore more alternatives.':'Comparison updated. Change either plan below to explore more alternatives.';
    if(!unchanged){originPlan=null;originKind='comparison';}
    req=next;view='compare';renderResults();invalidComparisonLink=false;
    $('#form-status').textContent='Side-by-side comparison is open. No provider was contacted.';
    syncComparisonAddress();
    focusComparison();
  }catch(error){$('#form-status').textContent=error.message;}
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
    savedReviewBlock(plan,selectedReq),
    el('h3',{},'Your next step'),el('p',{},'Save this option or copy a buying brief for your team. If you proceed, set up the service with the provider. Recall has no checkout integration with these providers; this does not create a protected purchase.'),
    el('div',{class:'actions'},el('button',{class:'button primary',type:'button',onclick:()=>savePlan(plan,selectedReq,status)},'Save option'),copy,el('a',{class:'button',href:plan.url,target:'_blank',rel:'noopener noreferrer'},'Visit provider ↗')),status);
  openDialog(`${plan.name} · Evidence review`,body);
}
function savedReviewBlock(plan,selectedReq){
  const section=el('section',{class:'saved-review'});
  section.dataset.planId=plan.id;section.dataset.requirements=JSON.stringify(selectedReq);
  fillSavedReview(section,plan,selectedReq);
  return section;
}
function fillSavedReview(section,plan,selectedReq){
  const match=matchingReview(reviewIndex,plan.id,selectedReq),different=reviewIndex?.entries.some(r=>r.planId===plan.id);
  section.replaceChildren(el('p',{class:'saved-review-label'},'YOUR PROVIDER REVIEW'));
  if(!reviewIndex){section.append(el('p',{role:'status'},'Checking reviews saved in this browser…'));return;}
  if(reviewIndex.unavailable){section.append(el('p',{},'Saved review status is unavailable. Your records have not been changed.'),el('a',{class:'button',href:'/review'},'Open provider reviews →'));return;}
  if(match){
    section.append(el('span',{class:`status-badge ${match.tone}`},match.label),el('p',{},`Captured ${new Date(match.capturedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · Same requirements${match.count>1?' · Latest of '+match.count+' captures':''}`),el('a',{class:'button primary',href:reviewWithReturn(match.href,selectedReq)},'Open saved review →'),el('small',{},'Saved evidence, not a fresh network check. The review keeps its own findings and dated estimate.'));
  }else{
    section.append(el('p',{},different?'Your saved reviews for this plan use different requirements. They do not assess this selection.':'No review saved for these requirements yet.'),el('a',{class:'button',href:reviewWithReturn('/review#'+new URLSearchParams({plan:plan.id,...selectedReq}),selectedReq)},'Review this provider →'),el('small',{},'Capture public evidence without a wallet. A GenLayer assessment is optional.'));
  }
}
async function refreshReviewIndex(){
  const version=++indexVersion;
  let result;try{result=await readReviewIndex(localStorage,catalog);}catch{result={entries:[],unavailable:true};}
  if(version!==indexVersion)return;
  reviewIndex=result;
  for(const section of document.querySelectorAll('.saved-review')){
    const plan=catalog.plans.find(p=>p.id===section.dataset.planId);
    if(plan)fillSavedReview(section,plan,JSON.parse(section.dataset.requirements));
  }
}
function showSaved() {
  const body = el('div',{class:'dialog-body'},el('p',{},'Your shortlist, with a direct path back to any matching review. Saved only in this browser; no orders have been placed.'));
  if (storageProblem) body.append(el('p',{role:'alert'},storageProblem));
  if (!saved.length) body.append(el('div',{class:'dialog-callout'},el('strong',{},'Your shortlist is empty'),el('p',{},'Save an option from the comparison. You can return to its requirements and evidence here.')));
  for (const row of saved) {
    const plan = catalog.plans.find(p=>p.id === row.planId);
    const estimate=assess(plan,row.requirements,isStale({reviewedAt:reviewDate(catalog,plan)}));
    body.append(el('div',{class:'saved-row'},el('div',{class:'saved-option-heading'},el('span',{class:'provider-mark','aria-hidden':'true'},plan.initials),el('div',{},el('h3',{},plan.name),el('p',{},plan.plan))),
      el('div',{class:'saved-requirements'},el('span',{},`${row.requirements.hours} hours / month`),el('span',{},`${dollars(row.requirements.budget)} budget`),el('span',{},row.requirements.noTraining?'No model training':'No training restriction'),el('span',{},row.requirements.speakers?'Speaker labels required':'No speaker-label requirement')),
      el('p',{class:'saved-estimate'},`${estimate.costLabel}: ${dollars(estimate.estimate)} / month · Current catalog${estimate.stale?' (out of date)':''}. Not a locked price.`),
      savedReviewBlock(plan,row.requirements),
      el('div',{class:'actions'},el('a',{class:'button',href:comparisonLink(row.requirements,plan.id,'saved'),onclick:event=>compareSaved(event,row)},'Compare alternatives →'),el('button',{class:'text-button',type:'button',onclick:()=>showOption(plan,row.requirements)},'View catalog details'),
        el('button',{class:'text-button',type:'button',onclick:()=>{
          try {persist(readSaved(localStorage.getItem(SAVED_KEY),catalog).filter(s=>s.planId !== row.planId));renderResults();showSaved();} catch {body.append(el('p',{role:'alert'},'Could not update the shortlist. Nothing was removed.'));}
        }},'Remove from shortlist'))));
  }
  openDialog('Your saved options',body);
  refreshReviewIndex();
}
form.addEventListener('input',()=>{$('#form-status').textContent = 'Requirements changed. Compare again to update the results.';if($('#pair-status'))$('#pair-status').textContent='Requirements changed. This view still uses the values shown above. Press Compare options to update it.';});
form.addEventListener('submit',event=>{event.preventDefault();compareOptions();});
$('#side-by-side-view').addEventListener('click',()=>{if(form.reportValidity())compareOptions();});
$('#browse-view').addEventListener('click',()=>{view='browse';renderResults();$('#form-status').textContent='Browsing all plans using the last compared requirements.';syncComparisonAddress();});
$('#saved-options').addEventListener('click',showSaved);
window.addEventListener('storage',event=>{if(catalog&&(event.key === SAVED_KEY || event.key === null)){try{saved = readSaved(localStorage.getItem(SAVED_KEY),catalog);storageProblem = '';updateCount();renderResults();if(dialog.open)dialog.close();$('#form-status').textContent = 'Your shortlist was updated in another tab.';}catch{storageProblem = 'The shortlist changed and could not be read. Reload before saving.';}}});
window.addEventListener('storage',event=>{if(catalog&&[REVIEWS,TRANSACTIONS,null].includes(event.key))refreshReviewIndex();});
function applyComparisonLink() {
  try {
    const context=comparisonContext(location.hash),carried=context?.requirements;
    if(context&&(context.plans??[context.planId]).filter(Boolean).some(id=>!catalog.plans.some(p=>p.id===id)))throw Error('A selected plan is no longer in this catalog. Check your requirements to compare available alternatives.');
    invalidComparisonLink=false;originPlan=context?.from==='comparison'?null:context?.planId??null;originKind=context?.from??'comparison';pair=context?.plans??(originPlan?[originPlan]:[]);comparisonNotice=context?.from==='comparison'?'Your comparison is restored. Change either plan to explore other alternatives.':'';view=context?.view??(carried?'compare':'browse');
    if(carried){
      form.hours.value=carried.hours;form.budget.value=carried.budget;
      form.noTraining.checked=carried.noTraining;form.speakers.checked=carried.speakers;
      $('#form-status').textContent=`Requirements from your ${originKind==='saved'?'saved option':originKind==='comparison'?'comparison':'review'} are applied. This comparison uses catalog estimates, not GenLayer assessments.`;
    }
    req=fromForm();renderResults();
  }catch(error){
    invalidComparisonLink=true;
    $('#form-status').textContent=error.message;
    $('#results').replaceChildren();$('#pair-comparison').replaceChildren();$('#pair-comparison').hidden=true;pair=[];originPlan=null;$('#results-title').textContent='Check your requirements';
    $('#result-summary').textContent='The link could not be applied. Confirm the form values and choose Compare options.';
  }
}
window.addEventListener('hashchange',()=>{if(catalog){applyComparisonLink();focusComparison();}});
async function start() {
  try {
    const response = await fetch('/service-catalog.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('catalog'); catalog = await response.json();
    validateCatalog(catalog);
    try {saved = readSaved(localStorage.getItem(SAVED_KEY),catalog);}catch{storageProblem = 'The saved shortlist could not be read. Copy a buying brief instead; existing purchases are unchanged.';}
    req = fromForm();applyComparisonLink();updateCount();$('#saved-options').disabled = false;$('#comparison').hidden = false;$('#load-status').hidden = true;
    if(view==='compare')focusComparison();
    refreshReviewIndex();
    if (storageProblem) $('#form-status').textContent = storageProblem;
  } catch {$('#load-status').replaceChildren('The provider catalog could not load. Your existing purchases are unchanged. ',el('button',{class:'button',type:'button',onclick:start},'Try again'));}
}
start();
