// Isolated localhost only: synthetic evidence, fake wallet, fake receipt.
async function testReviewHeaderRecovery(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/review')throw Error('Isolated review required');
  const $=s=>document.querySelector(s),checks=[];
  const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+fn);};
  $('#review-dialog').close();
  const trigger=$('#wallet-settings');
  assert(!trigger.hidden&&trigger.textContent==='Connect wallet','Connect wallet visible on empty reviews page');
  const calls=[],listeners={},account='0x'+'7'.repeat(40);
  const provider={request:async({method})=>{calls.push(method);if(method==='eth_requestAccounts')return [account];throw Error('Unexpected wallet call: '+method);},on:(e,f)=>listeners[e]=f,removeListener:(e,f)=>{if(listeners[e]===f)delete listeners[e];}};
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider,info:{uuid:'header-test',name:'Header test wallet'}}}));
  trigger.focus();trigger.click();
  $('[aria-label="Header test wallet"]').click();await wait(()=>trigger.textContent.includes('0x7777'));
  assert(calls.join(',')==='eth_requestAccounts','Header connection does not prepare, sign, or switch networks');
  assert(!$('#review-dialog').open,'Header connection does not open a review');
  listeners.accountsChanged([]);
  assert(!trigger.hidden&&trigger.textContent==='Connect wallet','Account change leaves reconnection visible');
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  const catalog=await(await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
  const text='Synthetic fixture: this English pre-recorded single-channel transcription API never uses customer audio or transcripts for model training.';
  const evidence={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(evidence),id='header-recovery-fixture',hash='0x'+'8'.repeat(64),source='a'.repeat(64);
  const row={id,evidence,payload,digest:await sha(payload)},review={action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
  localStorage.setItem(REVIEWS,JSON.stringify([row]));localStorage.setItem(TRANSACTIONS,JSON.stringify([{id:'entry',requestId:id,hash,review,phase:'pending'}]));
  const originalFetch=window.fetch,ops=[];
  window.fetch=async(url,options)=>{
    if(url!=='/api/provider-review')return originalFetch(url,options);
    const request=JSON.parse(options.body);ops.push(request.op);
    if(request.op!=='receipt')throw Error('Only a receipt check is allowed');
    return new Response(JSON.stringify({hash,status:'FINALIZED',execution:'ERROR',consensus_result:'MAJORITY_DISAGREE',from:account,value_wei:'0',args:[payload],source_sha256:source}),{headers:{'Content-Type':'application/json'}});
  };
  try{
    location.hash=new URLSearchParams({id});await wait(()=>$('.review-sidebar h2')?.textContent==='Review processing');
    assert(!trigger.hidden&&!trigger.disabled,'Wallet remains available while review is pending');
    [...document.querySelectorAll('button')].find(b=>b.textContent==='Check status now').click();
    await wait(()=>$('.review-sidebar h2')?.textContent==='Review couldn’t complete');
    assert(document.body.textContent.includes('validators did not reach agreement'),'Consensus failure is explained without blaming provider');
    assert(!document.body.textContent.includes('Your review is processing'),'Finalized rejection is no longer stuck processing');
    assert($('.review-sidebar .primary').textContent==='Export saved review','Failure offers preservation, not immediate resubmission');
    assert(JSON.parse(localStorage.getItem(REVIEWS))[0].payload===payload,'Original evidence is unchanged');
    assert(JSON.parse(localStorage.getItem(TRANSACTIONS))[0].hash===hash&&JSON.parse(localStorage.getItem(TRANSACTIONS))[0].phase==='failed','Failed receipt stays in journal');
    let blob;const originalCreate=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;
    try{
      URL.createObjectURL=value=>{blob=value;return originalCreate(value);};HTMLAnchorElement.prototype.click=function(){};
      $('.review-sidebar .primary').click();const exported=JSON.parse(await blob.text());
      assert(exported.transactions[0].hash===hash&&exported.transactions[0].receipt.consensus_result==='MAJORITY_DISAGREE','Export includes transaction and consensus outcome');
    }finally{URL.createObjectURL=originalCreate;HTMLAnchorElement.prototype.click=originalClick;}
    assert(ops.every(op=>op==='receipt'),'Recovery never prepares, submits, or reads nonexistent contract');
    assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
    return {passed:true,checks,walletCalls:calls,apiCalls:ops};
  }finally{window.fetch=originalFetch;}
}
