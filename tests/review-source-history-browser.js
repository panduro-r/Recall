// Run only in a fresh isolated localhost browser context. All assessment API
// calls are blocked. These are synthetic records, never a real network result.
async function testReviewSourceHistory(planId='speechmatics-standard'){
  if(location.hostname!=='127.0.0.1'||!['/review','/review.html'].includes(location.pathname))throw Error('Isolated local review required');
  const assert=(ok,text)=>{if(!ok)throw Error(text);};
  const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
  const wait=async predicate=>{for(let i=0;i<250;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+predicate.toString());};
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  assert(!localStorage.getItem(REVIEWS)&&!localStorage.getItem(TRANSACTIONS),'Use a fresh isolated context');
  const catalog=await (await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id===planId);
  const account='0x'+'7'.repeat(40),hash='0x'+'8'.repeat(64),source='a'.repeat(64),ZERO='0x'+'0'.repeat(40);
  const req={hours:100,budget:50,noTraining:true,speakers:false};
  const text='Synthetic QA evidence, not a provider claim. Customer audio and transcripts are never used to train models. This is a fixture for record preservation.';
  const docs=await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64),checkedAt:new Date().toISOString()})));
  const evidence={version:1,plan:{...plan,sources:plan.sources.slice(0,2)},requirements:req,capturedAt:new Date().toISOString(),documents:docs.slice(0,2)};
  const payload=JSON.stringify(evidence),row={id:'history-fixture',evidence,payload,digest:await sha(payload)};
  const review={action:'deploy',account,contract:ZERO,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',consensus_result:'MAJORITY_AGREE',from:account,value_wei:'0',args:[payload],source_sha256:source};
  row.session={deployment:hash,receipt,state:{version:3,review_status:'completed',kind:'provider-review',account,digest:row.digest,evidence_json:payload,complete:true,results:[
    {id:'service',verdict:'INCONCLUSIVE',reason:'Fixture: older evidence did not establish the full service condition.',citations:[]},
    {id:'training',verdict:'SUPPORTED',reason:'Fixture: an explicit training commitment was captured.',citations:[{source:docs[0].id,quote:'Customer audio and transcripts are never used to train models.'}]}
  ]}};
  const entry={id:'fixture-tx',requestId:row.id,hash,review,phase:'complete'};
  const original=JSON.stringify(row),originalFetch=window.fetch,calls=[];
  window.fetch=async(url,options)=>{
    if(url==='/api/provider-review'){
      const data=JSON.parse(options.body);calls.push(data.op);
      assert(data.op==='capture','No prepare, inspect, receipt or submission in this fixture');
      const e={...evidence,plan,documents:docs,capturedAt:new Date().toISOString()},p=JSON.stringify(e);
      return new Response(JSON.stringify({evidence:e,payload:p,digest:await sha(p)}),{headers:{'Content-Type':'application/json'}});
    }
    assert(!options?.method||options.method==='GET','Non-read request blocked');
    return originalFetch(url,options);
  };
  try{
    localStorage.setItem(REVIEWS,JSON.stringify([row]));localStorage.setItem(TRANSACTIONS,JSON.stringify([entry]));
    location.hash=new URLSearchParams({id:row.id});
    await wait(()=>button('Capture updated evidence'));
    assert(document.body.innerText.includes('Updated evidence sources available'),'old source list explained');
    assert(document.body.innerText.includes('Needs clarification'),'saved finding is unchanged');
    assert(document.body.innerText.includes('Transaction confirmed'),'old receipt remains valid');
    assert(!calls.length&&!document.querySelector('dialog').open,'opening historical record does not contact Studio or prompt wallet');
    assert(!document.querySelector('#wallet-settings').hidden,'wallet remains visible');
    button('Capture updated evidence').click();
    await wait(()=>button('Review with GenLayer')&&document.body.innerText.includes('Evidence coverage expanded'));
    const rows=JSON.parse(localStorage.getItem(REVIEWS)),current=rows.find(r=>r.id!==row.id);
    assert(rows.length===2&&JSON.stringify(rows.find(r=>r.id===row.id))===original,'old snapshot, assessment and receipt stay intact');
    assert(current.evidence.documents.length===4&&!current.session,'new four-source capture has no automatic assessment');
    assert(current.baselineId===row.id,'new capture links its original evidence');
    assert(!document.body.innerText.includes('source texts changed'),'new documents are not called changed policies');
    assert(calls.join(',')==='capture','capture only, no Studio interaction');
    assert(JSON.stringify(JSON.parse(localStorage.getItem(TRANSACTIONS)))===JSON.stringify([entry]),'transaction journal preserved');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
    location.hash=new URLSearchParams({id:row.id});
    await wait(()=>button('Capture updated evidence'));
    assert(document.querySelector('#review-notice').textContent==='','new capture notice does not follow navigation into an assessed historical record');
    // Unassessed historical evidence must route to an updated capture as well.
    const draft={...row,id:'historical-draft'};delete draft.session;
    localStorage.setItem(REVIEWS,JSON.stringify([...rows,draft]));location.hash=new URLSearchParams({id:draft.id});
    await wait(()=>button('Capture updated evidence'));
    assert(!button('Review with GenLayer'),'outdated source sets cannot enter new assessment flow');
    assert(calls.length===1,'viewing historical draft remains local');
    return {passed:true,fixtureOnly:true,checks:18,apiOperations:calls,realWalletCalls:0};
  }finally{window.fetch=originalFetch;}
}
