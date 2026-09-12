// Isolated localhost only. QA sessionStorage keeps test expectations, not product state.
async function prepareComparisonReturn(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/compare')throw Error('Isolated local comparison required');
  const f=document.querySelector('#requirements');f.hours.value='237';f.budget.value='151.23';f.noTraining.checked=false;f.speakers.checked=true;f.requestSubmit();
  for(const [index,id] of [[1,'assembly-pro'],[0,'soniox-async']]){const s=document.querySelector('#compare-plan-'+index);s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));}
  const {comparisonContext}=await import('/compare-model.js'),context=comparisonContext(location.hash);
  if(JSON.stringify(context.plans)!==JSON.stringify(['soniox-async','assembly-pro'])||context.requirements.hours!==237)throw Error('Address does not reflect the visible comparison');
  sessionStorage.setItem('recall.qa.returnExpected',JSON.stringify({url:location.href,storage:JSON.stringify(Object.entries(localStorage))}));
  f.hours.value='999';f.dispatchEvent(new Event('input',{bubbles:true}));
  if(comparisonContext(location.hash).requirements.hours!==237)throw Error('Unapplied edits leaked into comparison address');
  return{passed:true,preparedUrl:location.href,unappliedEditNotSaved:true};
}

async function checkRestoredComparison(){
  const e=JSON.parse(sessionStorage.getItem('recall.qa.returnExpected')),f=document.querySelector('#requirements'),panel=document.querySelector('#pair-comparison');
  const checks=[],assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  assert(location.href===e.url,'Exact comparison address restored');
  assert(!panel.hidden&&document.querySelector('#results').hidden,'Side-by-side view restored');
  assert(f.hours.value==='237'&&f.budget.value==='151.23'&&!f.noTraining.checked&&f.speakers.checked,'Applied requirements restored, not abandoned edits');
  assert(document.querySelector('#compare-plan-0').value==='soniox-async'&&document.querySelector('#compare-plan-1').value==='assembly-pro','Both selected alternatives restored');
  assert(JSON.stringify(Object.entries(localStorage))===e.storage,'Wallet, review and shortlist storage unchanged');
  assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  const link=[...panel.querySelectorAll('.saved-review a')].find(a=>new URLSearchParams(new URL(a.href).hash.slice(1)).get('plan')==='assembly-pro');
  assert(link&&new URLSearchParams(new URL(link.href).hash.slice(1)).get('back')===new URL(e.url).pathname+new URL(e.url).hash,'Review link carries exact local return context');
  return{passed:true,checks,reviewHref:link.href};
}

async function checkReviewReturn(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/review')throw Error('Isolated local review required');
  const e=JSON.parse(sessionStorage.getItem('recall.qa.returnExpected')),back=document.querySelector('.review-back');
  if(back.href!==e.url||!back.textContent.includes('Back to your comparison'))throw Error('Matching review return missing');
  if(JSON.stringify(Object.entries(localStorage))!==e.storage)throw Error('Navigation changed saved data');
  if(!document.body.innerText.includes('Capture evidence'))throw Error('Expected an unsubmitted preview, not an automatic capture');
  return{passed:true,backHref:back.href,recordsUnchanged:true,noCaptureSubmitted:true};
}
