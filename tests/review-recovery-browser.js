// Fresh isolated localhost only, served by the API-disabled QA server.
// Synthetic receipts are never live provider verdicts or wallet submissions.
async function testReviewRecovery(mode){
  if(location.origin!=='http://127.0.0.1:4203'||localStorage.length)throw Error('Fresh isolated QA origin required');
  const {sha,REVIEWS,TRANSACTIONS,SERVICE_CHECKS}=await import('/review-model.js');
  const nativeFetch=window.fetch,calls=[];let responseMode=mode;
  const catalog=await(await nativeFetch('/service-catalog.json')).json();
  const plan=structuredClone(catalog.plans.find(p=>p.id==='assembly-pro'));plan.reviewedAt??=catalog.reviewedAt;
  const text='Synthetic recovery fixture. English pre-recorded single-channel transcription API. A documented opt-out requires confirmation; no actual provider result or account action is represented.';
  const source='a'.repeat(64),account='0x'+'7'.repeat(40),hash='0x'+'6'.repeat(64);
  const evidence={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:source,checkedAt:new Date().toISOString()})))};
  const payload=JSON.stringify(evidence),digest=await sha(payload),row={id:'recovery-test',payload,evidence,digest};
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',consensus_result:'MAJORITY_AGREE',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const review={action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
  const session={deployment:hash,receipt,state:{version:4,kind:'provider-review',account,digest,evidence_json:payload,complete:true,review_status:'completed',results:[...SERVICE_CHECKS,'training'].map(id=>({id,verdict:id==='training'?'CONDITIONAL':'SUPPORTED',reason:'Synthetic recovery fixture, not live inference.',citations:[{source:plan.sources[0],quote:text}],...(id==='training'?{required_actions:['Obtain provider confirmation before use.']}:{})}))}};
  const entry={id:'existing-transaction',requestId:row.id,hash,review,phase:'complete',receipt};
  const saved=JSON.stringify([row]),journal=JSON.stringify([entry]);
  localStorage.setItem(REVIEWS,saved);localStorage.setItem(TRANSACTIONS,journal);localStorage.setItem('qa.unrelated','preserve');
  window.fetch=async(url,options)=>{
    if(!String(url).includes('/api/'))return nativeFetch(url,options);
    const data=JSON.parse(options?.body||'{}');calls.push(data.op);
    if(data.op!=='inspect')throw Error('Unexpected API operation: '+data.op);
    if(responseMode==='unavailable')return new Response(JSON.stringify({error:'Fixture unavailable'}),{status:503});
    const result=structuredClone(session);
    if(responseMode==='update')result.state.version=5;
    if(responseMode==='mismatch')result.state.digest='b'.repeat(64);
    return new Response(JSON.stringify(result),{status:200});
  };
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+fn);};
  let checks=0;const assert=(ok,label)=>{if(!ok)throw Error(label);checks++;};
  location.hash='id='+row.id;
  await wait(()=>document.querySelector('.review-sidebar h2')?.textContent==='Retrieving your result');
  document.querySelector('.review-sidebar button.primary').click();
  const title=mode==='update'?'Update Recall to view this result':mode==='mismatch'?'Result needs verification':'Your result is not available yet';
  await wait(()=>document.querySelector('.review-sidebar h2')?.textContent===title&&!document.querySelector('.review-sidebar button.primary').disabled);
  assert(!document.body.innerText.includes('Your review is processing'),'Finalized review is not labelled processing');
  assert(![...document.querySelectorAll('button')].some(b=>b.textContent==='Review with GenLayer'),'No resubmit button for unresolved result');
  assert(!document.body.innerText.includes('Ask GenLayer to assess it'),'No misleading invitation to reassess');
  assert(!document.body.innerText.includes('Capture new evidence'),'No competing fresh capture action');
  assert(document.body.innerText.includes(hash),'Existing transaction reference visible');
  assert(document.body.innerText.includes('Export saved review'),'Export remains available');
  assert(localStorage.getItem(REVIEWS)===saved&&localStorage.getItem(TRANSACTIONS)===journal,'Original evidence and journal unchanged');
  assert(!document.querySelector('#wallet-settings').hidden,'Wallet stays available');
  assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  if(mode==='update'){
    assert(document.querySelector('.review-sidebar button.primary').textContent==='Reload Recall','Page update has explicit reload action');
    // The caller may click this real reload button. The API-disabled server then
    // guarantees that even discarded fetch mocks cannot contact Studio.
    window.resumeRecoveryFixture=()=>{responseMode='valid';};
  }else{
    responseMode='valid';document.querySelector('.review-sidebar button.primary').click();
    await wait(()=>!!JSON.parse(localStorage.getItem(REVIEWS))[0].session);
    assert(JSON.parse(localStorage.getItem(REVIEWS))[0].payload===payload,'Recovery preserves exact submitted evidence');
    assert(localStorage.getItem(TRANSACTIONS)===journal,'Recovery never rewrites the finalized transaction');
    assert(document.querySelectorAll('.review-finding').length===5,'Recovered result renders all five findings');
  }
  assert(calls.every(op=>op==='inspect'),'Read-only inspection, no prepare or submit');
  assert(localStorage.getItem('qa.unrelated')==='preserve','Other storage untouched');
  window.recoveryQA={session,saved,journal,calls};
  return {mode,checks,apiOperations:calls,syntheticOnly:true};
}

async function testReviewConfigGuard(mode='newer'){
  if(location.origin!=='http://127.0.0.1:4203'||localStorage.length)throw Error('Fresh isolated QA origin required');
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js'),nativeFetch=window.fetch,calls=[],walletCalls=[];
  const catalog=await(await nativeFetch('/service-catalog.json')).json(),plan=structuredClone(catalog.plans.find(p=>p.id==='assembly-pro'));
  const text='Synthetic public evidence used only for browser validation. No provider action, live model review or actual wallet submission is represented.';
  const source='a'.repeat(64),account='0x'+'7'.repeat(40);
  const evidence={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:source,checkedAt:new Date().toISOString()})))};
  const payload=JSON.stringify(evidence),row={id:'config-guard',evidence,payload,digest:await sha(payload)},saved=JSON.stringify([row]);
  localStorage.setItem(REVIEWS,saved);
  window.fetch=async(url,options)=>{
    if(!String(url).includes('/api/'))return nativeFetch(url,options);
    const data=JSON.parse(options?.body||'{}');calls.push(data.op);
    if(data.op==='config')return new Response(JSON.stringify({version:mode==='supported'||mode==='changed'&&calls.length===1?4:5,chain_id:61999,source_sha256:source}),{status:200});
    if(data.op==='prepare'&&mode==='supported')return new Response(JSON.stringify({review:{action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source}}),{status:200});
    throw Error('Unexpected API operation: '+data.op);
  };
  const provider={on(){},removeListener(){},async request({method}){walletCalls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return [account];if(method==='eth_chainId')return '0xf22f';throw Error('Unexpected wallet operation: '+method);}};
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'qa-provider',name:'QA wallet',rdns:'test.qa'},provider}}));
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+fn);};
  location.hash='id='+row.id;await wait(()=>document.querySelector('.review-sidebar'));
  document.querySelector('#wallet-settings').click();
  document.querySelector('button.review-wallet[aria-label="QA wallet"]').click();
  await wait(()=>document.querySelector('#wallet-settings').classList.contains('is-connected')&&!document.querySelector('#wallet-settings').disabled);
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Review with GenLayer').click();
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Continue with public evidence').click();
  await wait(()=>(mode==='supported'?document.querySelector('#dialog-title')?.textContent==='Review before submitting':document.body.innerText.includes('A Recall update is available'))&&!document.querySelector('#wallet-settings').disabled);
  let checks=0;const assert=(ok,label)=>{if(!ok)throw Error(label);checks++;};
  assert(JSON.stringify(calls)===JSON.stringify(mode==='supported'?['config','config','prepare']:mode==='changed'?['config','config']:['config']),'Version checks gate initial and refreshed preparation');
  assert(!walletCalls.some(m=>['eth_sendTransaction','personal_sign','wallet_switchEthereumChain'].includes(m)),'No signing or switching');
  assert(localStorage.getItem(REVIEWS)===saved&&!localStorage.getItem(TRANSACTIONS),'No journal or evidence changes');
  assert([...document.querySelectorAll('button')].find(b=>b.textContent==='Review with GenLayer').disabled===(mode!=='supported'),'Only unsupported formats block submission');
  assert(mode==='supported'||[...document.querySelectorAll('button')].some(b=>b.textContent==='Reload Recall'),'Explicit update action');
  assert(document.body.innerText.includes('Export saved review'),'Export still available');
  assert(document.querySelector('dialog').open===(mode==='supported'),'Only a supported format opens the review modal');
  return {mode,checks,calls,walletCalls,syntheticOnly:true};
}
