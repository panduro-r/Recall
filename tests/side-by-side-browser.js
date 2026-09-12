// Run only in an isolated localhost context. No wallet requests or provider API calls.
async function testSideBySideComparison(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/compare')throw Error('Isolated local comparison required');
  const checks=[],assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const form=document.querySelector('#requirements'),panel=document.querySelector('#pair-comparison'),cards=document.querySelector('#results');
  const before=JSON.stringify(Object.entries(localStorage)),originalFetch=window.fetch;let apiCalls=0;
  window.fetch=(...args)=>{if(String(args[0]).includes('/api/'))apiCalls++;return originalFetch(...args);};
  const setHash=async value=>{location.hash=value;await new Promise(r=>setTimeout(r,50));};
  const change=(index,id)=>{const select=document.querySelector('#compare-plan-'+index);select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));};
  try{
    await setHash('');document.querySelector('#browse-view').click();
    assert(panel.hidden&&!cards.hidden,'fresh visit can browse all plans');
    form.hours.value='100';form.budget.value='50';form.noTraining.checked=true;form.speakers.checked=false;
    form.querySelector('button[type=submit]').click();
    assert(!panel.hidden&&cards.hidden,'Compare options opens a distinct side-by-side view');
    assert(document.activeElement===panel&&panel.getBoundingClientRect().top<80,'comparison receives focus and scrolls into view');
    assert(panel.querySelector('table')&&panel.querySelectorAll('select').length===2,'two selectable plans in an aligned comparison');
    assert(panel.innerText.includes('Speechmatics vs Soniox')&&panel.innerText.includes('≈ $10.00')&&panel.innerText.includes('Confirmation needed'),'default alternatives retain price uncertainty');
    form.requestSubmit();assert(panel.innerText.includes('Requirements are unchanged'),'repeated click gives explicit unchanged-input feedback');
    const first=document.querySelector('#compare-plan-0').value;
    assert([...document.querySelector('#compare-plan-1').options].find(o=>o.value===first).disabled,'same plan cannot be selected twice');
    change(1,'gladia-growth');assert(panel.innerText.includes('Quote needed')&&panel.innerText.includes('Minimum commitment not included'),'from-rate remains quote-needed');
    change(1,'assembly-pro');assert(panel.innerText.includes('Paid opt-out')&&panel.innerText.includes('Final cost not confirmed'),'privacy exception is not treated as a confirmed match');
    form.hours.value='200';form.budget.value='100';form.noTraining.checked=false;form.speakers.checked=true;
    form.dispatchEvent(new Event('input',{bubbles:true}));
    assert(panel.innerText.includes('This view still uses the values shown above')&&panel.innerText.includes('100 hours'),'unapplied changes are clearly distinguished');
    form.requestSubmit();assert(panel.innerText.includes('200 hours')&&panel.innerText.includes('$46.00')&&panel.innerText.includes('Speaker labels required'),'comparison updates cost and all conditions together');
    const {comparisonLink}=await import('/compare-model.js');
    await setHash(comparisonLink({hours:237,budget:151.23,noTraining:true,speakers:false},'soniox-async').split('#')[1]);
    assert(!panel.hidden&&document.querySelector('#compare-plan-0').value==='soniox-async'&&panel.innerText.includes('From your review'),'review handoff opens side-by-side with the original provider retained');
    assert(form.hours.value==='237'&&form.budget.value==='151.23'&&form.noTraining.checked&&!form.speakers.checked,'review handoff preserves exact requirements');
    assert(panel.innerText.includes('No review saved for these requirements yet.'),'catalog comparison is not a fabricated GenLayer review');
    await setHash(comparisonLink({hours:100,budget:50,noTraining:true,speakers:false}).split('#')[1]);
    assert(!panel.hidden&&form.hours.value==='100','older requirement-only handoff also opens side-by-side');
    await setHash(comparisonLink({hours:100,budget:50,noTraining:true,speakers:false},'retired-plan').split('#')[1]);
    assert(panel.hidden&&document.querySelector('#form-status').textContent.includes('no longer in this catalog'),'unknown source plan fails visibly rather than substituting silently');
    form.requestSubmit();assert(!panel.hidden&&panel.querySelectorAll('select').length===2,'user can recover by explicitly comparing available plans');
    document.querySelector('#browse-view').click();assert(!cards.hidden&&panel.hidden&&cards.children.length===7,'return to all seven catalog plans');
    document.querySelector('#side-by-side-view').click();assert(!panel.hidden&&cards.hidden,'view selector also opens comparison');
    assert(JSON.stringify(Object.entries(localStorage))===before,'comparison does not alter saved reviews, wallet state or shortlist');
    assert(apiCalls===0,'no API requests or assessments triggered');
    assert(document.documentElement.scrollWidth<=innerWidth,'no page horizontal overflow');
    await wait(()=>!panel.innerText.includes('Checking reviews saved'));
    return{passed:true,checks,apiCalls};
  }finally{window.fetch=originalFetch;}
}
