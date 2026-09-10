// Isolated localhost only. Injected fixture wallet and RPC; never a real signature.
async function testProviderReview(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/review')throw Error('Isolated local review required');
  const assert=(ok,text)=>{if(!ok)throw Error(text);};
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
  const wait=async predicate=>{for(let i=0;i<250;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+predicate.toString());};
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  const originalFetch=window.fetch,other=JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>![REVIEWS,TRANSACTIONS].includes(k))));
  let sends=0,finalized=false,latestPlan,payload;
  const account='0x'+'7'.repeat(40),hash='0x'+'8'.repeat(64),source='a'.repeat(64),ZERO='0x'+'0'.repeat(40),calls=[];
  const provider={request:async({method})=>{
    calls.push(method);if(method==='eth_chainId')return '0xf22f';if(['eth_accounts','eth_requestAccounts'].includes(method))return [account];
    if(method==='eth_sendTransaction'){sends++;return hash;}throw Error('Unexpected fixture wallet call '+method);
  }};
  const makeReceipt=()=>({hash,status:finalized?'FINALIZED':'ACCEPTED',execution:finalized?'SUCCESS':'UNKNOWN',from:account,value_wei:'0',args:[payload],source_sha256:source});
  window.fetch=async(url,options)=>{
    if(url!=='/api/provider-review')return originalFetch(url,options);
    const data=JSON.parse(options.body);let body;
    if(data.op==='config')body={version:1,source_sha256:source,notice:'Explicit browser fixture, not a network assessment.'};
    else if(data.op==='prepare'){
      payload=data.request.payload;
      const review={action:'deploy',account,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
      latestPlan={review,transaction:{from:account,to:ZERO,chainId:'0xf22f',value:'0x0',data:'0x1234',gasPrice:'0x0',gas:'0xf4240',nonce:'0x0'},prepared_at:Date.now()/1000,intent_id:'b'.repeat(64)};body=latestPlan;
    }else if(data.op==='receipt')body=makeReceipt();
    else if(data.op==='inspect'){
      const evidence=JSON.parse(payload),doc=evidence.documents[0];
      body={deployment:hash,contract:'0x'+'9'.repeat(40),receipt:makeReceipt(),state:{version:2,review_status:'completed',kind:'provider-review',account,digest:await sha(payload),evidence_json:payload,complete:true,
        results:['service','training'].map(id=>({id,verdict:'SUPPORTED',reason:'Explicit browser fixture only; no real model verdict.',citations:[{source:doc.id,quote:doc.text.slice(0,100)}]}))}};
    }else if(data.op==='capture'){
      const row=JSON.parse(localStorage.getItem(REVIEWS))[0],e=structuredClone(row.evidence);e.capturedAt=new Date().toISOString();
      e.documents[0].text+='\nChanged policy: customer audio may be used for model training.';e.documents[0].textSha256=await sha(e.documents[0].text);
      body={evidence:e,payload:JSON.stringify(e),digest:await sha(JSON.stringify(e))};
    }else throw Error('Unexpected fixture API operation');
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    assert(button('Review with GenLayer'),'saved capture offers assessment');assert(!sends,'no automatic wallet submission');
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'review-fixture',name:'QA fixture wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'},provider}}));
    button('Review with GenLayer').click();await wait(()=>button('Continue with public evidence'));
    assert(!calls.length,'no wallet call before data-sharing confirmation');button('Continue with public evidence').click();await wait(()=>button('QA fixture wallet'));
    assert(document.querySelector('dialog').open,'wallet choice modal');button('QA fixture wallet').click();await wait(()=>document.querySelector('dialog').open&&button('Approve in wallet'));
    assert(sends===0&&document.querySelector('dialog').textContent.includes('0 test GEN'),'connect and prepare do not submit');
    button('Not now').click();assert(!document.querySelector('dialog').open,'review can be discarded');
    button('Review with GenLayer').click();await wait(()=>button('Continue with public evidence'));button('Continue with public evidence').click();await wait(()=>document.querySelector('dialog').open&&button('Approve in wallet'));button('Approve in wallet').click();
    await wait(()=>JSON.parse(localStorage.getItem(TRANSACTIONS)||'[]').some(e=>e.hash===hash));
    await wait(()=>!document.querySelector('#wallet-settings').disabled);
    assert(sends===1&&document.body.innerText.includes('Your review is processing'),'pending request saved and visible');
    assert(button('Review with GenLayer').disabled,'duplicate review blocked');
    document.querySelector('#wallet-settings').click();await wait(()=>button('Disconnect wallet'));button('Disconnect wallet').click();
    assert(document.querySelector('#wallet-settings').hidden,'disconnect works while receipt pending');
    assert(JSON.parse(localStorage.getItem(TRANSACTIONS)).some(e=>e.phase==='pending'),'disconnect preserves recovery');
    finalized=true;button('Check status now').click();await wait(()=>button('Capture a new review'));
    const savedPlan=JSON.parse(payload).plan;
    assert(document.body.innerText.includes(savedPlan.pricing==='estimated'?'Needs clarification':'Documented terms support your conditions'),'successful matching result shown without promoting uncertain prices');
    assert(sends===1,'polling never resubmits');
    const old=JSON.parse(localStorage.getItem(REVIEWS))[0],beforeCount=JSON.parse(localStorage.getItem(REVIEWS)).length;
    button('Capture a new review').click();await wait(()=>JSON.parse(localStorage.getItem(REVIEWS)).length===beforeCount+1);
    await wait(()=>document.body.innerText.includes('1 source text changed'));
    const rows=JSON.parse(localStorage.getItem(REVIEWS));assert(rows.find(r=>r.id===old.id).payload===old.payload,'old snapshot preserved');
    assert(document.body.innerText.includes('Not assessed yet'),'changed text is not an automatic verdict');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
    assert(JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>![REVIEWS,TRANSACTIONS].includes(k))))===other,'purchase and shortlist storage unchanged');
    return {passed:true,fixtureOnly:true,sends,checks:14};
  }finally{window.fetch=originalFetch;}
}
