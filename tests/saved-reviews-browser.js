// Only a fresh isolated localhost context. Synthetic reviews, no real wallet/RPC.
async function testSavedReviewNavigation(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/compare')throw Error('Fresh isolated local comparison required');
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  const wait=async fn=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+fn);};
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  const {SAVED_KEY}=await import('/compare-model.js');
  assert(!localStorage.length,'Fresh fixture storage required');
  const catalog=await(await fetch('/service-catalog.json')).json(),req={hours:100,budget:50,noTraining:true,speakers:false},time=new Date(Date.now()-60000).toISOString();
  const evidence=async(planId,selected=req,capturedAt=time)=>{
    const plan={...catalog.plans.find(p=>p.id===planId)};plan.reviewedAt??=catalog.reviewedAt;
    const text='Synthetic fixture. English prerecorded single-channel transcription is supported. Customer data is never used to train models by default.';
    const documents=await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],text,textSha256:await sha(text),sha256:'a'.repeat(64),status:'retrieved',complete:true,checkedAt:capturedAt})));
    const e={version:1,plan,requirements:selected,documents,capturedAt},payload=JSON.stringify(e);
    return {evidence:e,payload,digest:await sha(payload)};
  };
  const row={id:'saved-reviewed-option',...await evidence('speechmatics-standard')},account='0x'+'7'.repeat(40),hash='0x'+'8'.repeat(64),source='a'.repeat(64);
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',consensus_result:'MAJORITY_AGREE',from:account,value_wei:'0',args:[row.payload],source_sha256:source};
  row.session={deployment:hash,receipt,state:{version:3,kind:'provider-review',account,digest:row.digest,evidence_json:row.payload,review_status:'completed',complete:true,results:['service','training'].map(id=>({id,verdict:'SUPPORTED',reason:'Synthetic fixture, not a real provider finding.',citations:[{source:row.evidence.plan.sources[0],quote:row.evidence.documents[0].text}]}))}};
  const entry={id:'saved-reviewed-tx',requestId:row.id,hash,phase:'complete',review:{action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[row.payload],chain_id:61999,source_sha256:source}};
  const different={id:'different-requirements',...await evidence('assembly-pro',{...req,noTraining:false})};
  const storedRows=JSON.stringify([row,different]),storedJournal=JSON.stringify([entry]);
  localStorage.setItem(REVIEWS,storedRows);localStorage.setItem(TRANSACTIONS,storedJournal);
  localStorage.setItem(SAVED_KEY,JSON.stringify(['speechmatics-standard','soniox-async','assembly-pro'].map(planId=>({planId,requirements:req,savedAt:time}))));
  localStorage.setItem('recall.qa.unrelated','preserve');
  let apiCalls=0;const nativeFetch=window.fetch;
  window.fetch=(url,options)=>{if(String(url).includes('/api/')||options?.method&&options.method!=='GET'){apiCalls++;throw Error('No API calls allowed');}return nativeFetch(url,options);};
  window.dispatchEvent(new StorageEvent('storage',{key:SAVED_KEY}));window.dispatchEvent(new StorageEvent('storage',{key:REVIEWS}));
  document.querySelector('#saved-options').click();
  const dialog=document.querySelector('#option-dialog'),block=id=>dialog.querySelector(`.saved-review[data-plan-id="${id}"]`);
  await wait(()=>block('speechmatics-standard')?.textContent.includes('Documented terms support'));
  assert(dialog.open&&dialog.querySelectorAll('.saved-row').length===3,'Three options displayed');
  assert(new URLSearchParams(new URL(block('speechmatics-standard').querySelector('a').href).hash.slice(1)).get('id')===row.id,'Exact saved review linked');
  assert(block('speechmatics-standard').textContent.includes('Same requirements'),'Exact match disclosed');
  assert(block('soniox-async').textContent.includes('No review saved'),'Unreviewed option is not marked assessed');
  assert(block('assembly-pro').textContent.includes('different requirements'),'Different requirement review not reused');
  assert(dialog.textContent.includes('No model training')&&dialog.textContent.includes('No speaker-label requirement'),'Saved requirements visible');
  assert(dialog.textContent.includes('Current catalog'),'Current estimate distinguished from saved review');
  // A newer capture must supersede the old positive summary without any submission.
  const draft={id:'new-unassessed-capture',...await evidence('speechmatics-standard',req,new Date().toISOString())};
  localStorage.setItem(REVIEWS,JSON.stringify([row,different,draft]));window.dispatchEvent(new StorageEvent('storage',{key:REVIEWS}));
  await wait(()=>block('speechmatics-standard')?.textContent.includes('Evidence saved · Not assessed'));
  assert(block('speechmatics-standard').textContent.includes('Latest of 2 captures'),'Latest capture selected, not favorable result');
  assert(new URLSearchParams(new URL(block('speechmatics-standard').querySelector('a').href).hash.slice(1)).get('id')===draft.id,'New unassessed capture is the open target');
  assert(dialog.open,'Read-only update does not close the shortlist');
  // Invalid review storage must not erase data or block catalog details.
  localStorage.setItem(REVIEWS,'broken');window.dispatchEvent(new StorageEvent('storage',{key:REVIEWS}));
  await wait(()=>block('speechmatics-standard')?.textContent.includes('status is unavailable'));
  assert(!dialog.querySelector('.saved-review .fit'),'No positive status from invalid records');
  assert(localStorage.getItem(REVIEWS)==='broken','Damaged bytes preserved');
  const details=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='View catalog details');details.click();
  assert(dialog.textContent.includes('What the price includes'),'Catalog details still available');
  localStorage.setItem(REVIEWS,storedRows);window.dispatchEvent(new StorageEvent('storage',{key:REVIEWS}));
  await wait(()=>dialog.querySelector('.saved-review .fit'));
  assert(dialog.querySelector('.saved-review a').textContent==='Open saved review →','Catalog detail also returns to existing assessment');
  assert(localStorage.getItem(REVIEWS)===storedRows&&localStorage.getItem(TRANSACTIONS)===storedJournal,'Review and receipt remain byte-for-byte unchanged');
  assert(localStorage.getItem('recall.qa.unrelated')==='preserve'&&!apiCalls,'No unrelated storage or API actions');
  dialog.close();document.querySelector('#saved-options').click();await wait(()=>block('speechmatics-standard')?.querySelector('.fit'));
  assert(dialog.scrollWidth<=dialog.clientWidth&&document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  sessionStorage.setItem('recall.qa.savedReturn',JSON.stringify({rows:storedRows,journal:storedJournal,href:block('speechmatics-standard').querySelector('a').href}));
  return {passed:true,checks:17,apiCalls,fixtureOnly:true,href:block('speechmatics-standard').querySelector('a').href};
}
