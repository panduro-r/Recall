// Run only on an isolated localhost comparison page; all storage below is test data.
async function testRecallComparison() {
  if(location.hostname !== '127.0.0.1' || location.pathname !== '/compare') throw Error('Isolated local comparison required');
  const assert = (condition,label) => {if(!condition)throw Error(label);};
  const find = label => [...document.querySelectorAll('button')].find(b=>b.textContent.trim() === label);
  const wait = async predicate => {for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const dialog=document.querySelector('dialog'),form=document.querySelector('#requirements');
  const otherStorage=Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='recall.shortlist.v1'));
  dialog.close();form.hours.value='100';form.budget.value='50';form.noTraining.checked=true;form.speakers.checked=false;form.requestSubmit();
  document.querySelector('#browse-view').click();
  assert(document.querySelector('#results-title').textContent==='7 plans, 6 providers','expanded catalog count');
  assert(document.querySelector('#result-summary').textContent.includes('1 plan has'),'default no-training match');
  const soniox=document.querySelector('[aria-label="Soniox Async API · Token based"]');
  assert(soniox.textContent.includes('Confirmation needed') && soniox.textContent.includes('≈ $10.00'),'token estimate is not a firm quote');
  soniox.querySelector('.save-option').click();
  assert(JSON.parse(localStorage.getItem('recall.shortlist.v1')).some(r=>r.planId==='soniox-async'),'new provider can be saved');
  soniox.querySelector('button').click();
  assert(dialog.textContent.includes('2026-09-09') && dialog.textContent.includes('million input tokens'),'new provider evidence');
  dialog.close();
  form.noTraining.checked=false;form.speakers.checked=true;form.requestSubmit();
  document.querySelector('#browse-view').click();
  const assembly=document.querySelector('[aria-label="AssemblyAI Universal-3.5 Pro · Pay as you go"]');
  assert(assembly.textContent.includes('$23.00'),'selected add-on arithmetic');
  assembly.querySelector('.save-option').click();
  assert(JSON.parse(localStorage.getItem('recall.shortlist.v1')).find(r=>r.planId==='assembly-pro').requirements.speakers,'saved requirements');
  const storageSet=Storage.prototype.setItem;
  try {
    Storage.prototype.setItem=function(){throw Error('fixture quota');};
    document.querySelector('[aria-label="Save Deepgram Nova-3 monolingual · Pay as you go"]').click();
    assert(document.querySelector('#form-status').textContent.includes('Could not save'),'storage failure visible');
  } finally {Storage.prototype.setItem=storageSet;}
  const evidenceTrigger=document.querySelector('[aria-label="AssemblyAI Universal-3.5 Pro · Pay as you go"] button');
  // Programmatic click does not focus like a real keyboard/pointer interaction.
  evidenceTrigger.focus();evidenceTrigger.click();
  assert(dialog.open && document.activeElement.getAttribute('aria-label')==='Close','modal focus');
  assert(!dialog.textContent.includes('Obtain opt-out confirmation'),'next step follows selected requirement');
  const originalFetch=window.fetch;
  try {
    window.fetch=async()=>{throw Error('fixture offline');};
    find('Check source pages').click();await wait(()=>!find('Check source pages').disabled);
    assert(dialog.textContent.includes('Could not complete the source check'),'source failure visible');
    window.fetch=async()=>new Response(JSON.stringify({provider:'assembly',cached:true,sources:Object.fromEntries(['assembly-price','assembly-training'].map(k=>[k,{status:'retrieved',checkedAt:'2026-09-08T20:00:00Z',sha256:'a'.repeat(64)}]))}),{status:200});
    find('Check source pages').click();await wait(()=>!find('Check source pages').disabled);
    assert(dialog.textContent.includes('cached check'),'cache is not presented as fresh');
  } finally {window.fetch=originalFetch;}
  const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');
  try {
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('fixture clipboard denied');}}});
    find('Copy buying brief').click();await wait(()=>dialog.querySelector('.copy-fallback'));
    const brief=dialog.querySelector('.copy-fallback').value;
    assert(brief.includes('USD 23.00') && brief.includes('No order, provider contact, payment'),'usable and honest brief fallback');
  } finally {if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else delete navigator.clipboard;}
  assert(dialog.scrollWidth<=dialog.clientWidth,'modal no horizontal overflow');
  dialog.close();await new Promise(r=>setTimeout(r,30));
  assert(document.activeElement.textContent.includes('Review evidence'),'focus restored');
  assert(document.documentElement.scrollWidth<=innerWidth,'page no horizontal overflow');
  assert(JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='recall.shortlist.v1')))===JSON.stringify(otherStorage),'other storage preserved');
  return {passed:true,checks:['expanded catalog count','conditional matching','token estimate','new provider save and evidence','USD conversion and add-ons','shortlist save','blocked storage','modal focus','offline source check','cached source label','clipboard fallback','horizontal overflow','existing storage preservation']};
}
